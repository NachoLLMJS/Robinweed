import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;
const SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'MSTR', 'NVDA', 'QQQ', 'TSLA'];

async function foundationFixture({ configure = true } = {}) {
  const [admin, outsider] = await ethers.getSigners();
  const currency = await ethers.deployContract('MockBurnableToken');
  await (await currency.mint(admin.address, 1_000_000n)).wait();
  const pair = await ethers.deployContract('MockBurnableToken');
  const curve = await ethers.deployContract('MockPonsBondingCurve', [await currency.getAddress(), await pair.getAddress()]);
  const factory = await ethers.deployContract('MockPonsFactoryV4');
  await (await factory.setLaunch(await currency.getAddress(), await curve.getAddress(), await pair.getAddress(), 0)).wait();
  const controller = await ethers.deployContract('StockdealerFoundationControllerV4', [admin.address, await factory.getAddress()]);
  const router = await ethers.deployContract('StockdealerEconomyRouter', [await controller.getAddress()]);
  const adapter = await ethers.deployContract('MockFoundationAdapterV4', [await factory.getAddress()]);
  const stocks = [];
  const vaults = [];
  for (const _symbol of SYMBOLS) {
    const stock = await ethers.deployContract('MockBurnableToken');
    const vault = await ethers.deployContract('StockdealerRewardVault', [await controller.getAddress(), await stock.getAddress()]);
    stocks.push(await stock.getAddress());
    vaults.push(await vault.getAddress());
  }
  const core = await ethers.deployContract('StockdealerGameCoreV4', [await controller.getAddress(), await router.getAddress()]);
  const tickers = SYMBOLS.map(symbol => ethers.encodeBytes32String(symbol));
  if (configure) {
    await (await controller.configureFoundation(
      await router.getAddress(),
      await adapter.getAddress(),
      await core.getAddress(),
      tickers,
      stocks,
      vaults
    )).wait();
  }
  const curveAddress = await curve.getAddress();
  const pairAddress = await pair.getAddress();
  const paths = stocks.map(() => ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'bytes'],
    [curveAddress, pairAddress, '0x']
  ));
  const houses = Array.from({ length: 35 }, (_, index) => ({
    houseId: index + 1,
    price: BigInt((index + 1) * 100),
    capacity: index % 3 === 0 ? 4 : index % 3 === 1 ? 8 : 15
  }));
  const activation = {
    token: await currency.getAddress(),
    routeData: paths,
    seedPackPrice: 100n,
    seedsPerPack: 4,
    basketWeightsBps: [1429, 1429, 1429, 1429, 1428, 1428, 1428],
    houses
  };
  return { admin, outsider, currency, pair, curve, factory, controller, router, adapter, stocks, vaults, core, tickers, activation };
}

describe('StockdealerFoundationControllerV4', () => {
  it('rejects duplicate collateral and vaults whose immutable asset does not match the route', async () => {
    const first = await foundationFixture({ configure: false });
    const duplicateStocks = [...first.stocks];
    duplicateStocks[1] = duplicateStocks[0];
    const duplicateVaults = [...first.vaults];
    duplicateVaults[1] = duplicateVaults[0];
    await assert.rejects(first.controller.configureFoundation(
      await first.router.getAddress(), await first.adapter.getAddress(), await first.core.getAddress(),
      first.tickers, duplicateStocks, duplicateVaults
    ));
    assert.equal(await first.controller.foundationConfigured(), false);

    const second = await foundationFixture({ configure: false });
    const mismatchedVaults = [...second.vaults];
    [mismatchedVaults[0], mismatchedVaults[1]] = [mismatchedVaults[1], mismatchedVaults[0]];
    await assert.rejects(second.controller.configureFoundation(
      await second.router.getAddress(), await second.adapter.getAddress(), await second.core.getAddress(),
      second.tickers, second.stocks, mismatchedVaults
    ));
    assert.equal(await second.controller.foundationConfigured(), false);
  });

  it('activates token, seven routes, seed SKUs and 35 prices atomically in one call with purchases last', async () => {
    const { currency, controller, router, adapter, core, vaults, tickers, activation } = await foundationFixture();
    assert.equal(await router.paused(), true);
    assert.equal(await core.purchasesPaused(), true);
    assert.equal(await core.gameplayPaused(), true);
    assert.equal(await core.claimsPaused(), true);

    await (await controller.activateStockdealerEconomy(activation)).wait();

    assert.equal(await controller.activated(), true);
    assert.equal(await controller.stockdealerToken(), await currency.getAddress());
    assert.equal(await router.currency(), await currency.getAddress());
    assert.equal(await router.paused(), false);
    assert.equal(await adapter.configurationFrozen(), true);
    assert.equal(await adapter.configuredPaths(), 7n);
    assert.equal(await core.purchasesPaused(), false);
    assert.equal(await core.gameplayPaused(), false);
    assert.equal(await core.claimsPaused(), false);
    for (let index = 0; index < tickers.length; index++) {
      const sku = await core.seedSkus(tickers[index]);
      assert.equal(sku.packPrice, 100n);
      assert.equal(sku.seedsPerPack, 4n);
      assert.equal(sku.rewardVault, vaults[index]);
    }
    assert.equal((await core.houses(35)).configured, true);
  });

  it('rolls every module back and stays paused if any path configuration fails', async () => {
    const { controller, router, adapter, core, tickers, activation } = await foundationFixture();
    await (await adapter.setFailAt(4)).wait();
    await assert.rejects(controller.activateStockdealerEconomy(activation));
    assert.equal(await controller.activated(), false);
    assert.equal(await controller.stockdealerToken(), ethers.ZeroAddress);
    assert.equal(await router.currency(), ethers.ZeroAddress);
    assert.equal(await router.paused(), true);
    assert.equal(await adapter.configurationFrozen(), false);
    assert.equal(await adapter.configuredPaths(), 0n);
    assert.equal((await core.seedSkus(tickers[0])).configured, false);
    assert.equal(await core.purchasesPaused(), true);
    assert.equal(await core.gameplayPaused(), true);
    assert.equal(await core.claimsPaused(), true);
  });

  it('rejects duplicate or missing house IDs before irreversible activation', async () => {
    const { controller, router, core, activation } = await foundationFixture();
    const duplicated = {
      ...activation,
      houses: activation.houses.map(house => ({ ...house, houseId: 1 }))
    };
    await assert.rejects(controller.activateStockdealerEconomy(duplicated));
    assert.equal(await controller.activated(), false);
    assert.equal(await controller.stockdealerToken(), ethers.ZeroAddress);
    assert.equal(await router.currency(), ethers.ZeroAddress);
    assert.equal(await router.paused(), true);
    assert.equal((await core.houses(1)).configured, false);
    assert.equal((await core.houses(2)).configured, false);
  });

  it('rejects activation by anyone except the Safe owner', async () => {
    const { outsider, controller, activation } = await foundationFixture();
    await assert.rejects(controller.connect(outsider).activateStockdealerEconomy(activation));
  });
});
