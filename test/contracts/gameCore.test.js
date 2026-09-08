import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const { ethers } = await network.create('robinhoodMainnetSimulation');

describe('StockdealerGameCore seed purchases', () => {
  it('buys a funded four-seed pack through the atomic economy router', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockBurnableToken');
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    const core = await ethers.deployContract('StockdealerGameCore', [admin.address, await router.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');

    await (await router.configureCurrency(await currency.getAddress())).wait();
    await (await router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await (await core.configureSeedSku(ticker, 100n, 4, await vault.getAddress())).wait();
    await (await router.activate()).wait();
    await (await core.enablePurchases()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();

    await (await core.connect(player).buySeedPacks(ticker, 1, 100n, 60n, 9_999_999_999n)).wait();
    assert.equal(await vault.remainingSeeds(player.address), 4n);
    assert.equal(await vault.unassignedCredit(player.address), 60n);
    assert.equal(await vault.totalLiability(), 60n);
  });

  it('fails before payment on excessive price, unavailable SKU, or indivisible configuration', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockBurnableToken');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const core = await ethers.deployContract('StockdealerGameCore', [admin.address, await router.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    await assert.rejects(core.configureSeedSku(ticker, 101n, 4, await router.getAddress()));
    await assert.rejects(core.connect(player).buySeedPacks(ticker, 1, 100n, 1n, 9_999_999_999n));
    assert.equal(await currency.balanceOf(player.address), 0n);
  });
});

describe('StockdealerGameCore permanent houses', () => {
  it('assigns a house only after every basket swap succeeds', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockBurnableToken');
    const stockA = await ethers.deployContract('MockBurnableToken');
    const stockB = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const vaultA = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stockA.getAddress()]);
    const vaultB = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stockB.getAddress()]);
    const core = await ethers.deployContract('StockdealerGameCore', [admin.address, await router.getAddress()]);
    const aapl = ethers.encodeBytes32String('AAPL');
    const msft = ethers.encodeBytes32String('MSFT');
    await (await router.configureCurrency(await currency.getAddress())).wait();
    await (await router.configureRoute(aapl, await stockA.getAddress(), await vaultA.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureRoute(msft, await stockB.getAddress(), await vaultB.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await vaultA.configureGameCore(await core.getAddress())).wait();
    await (await vaultB.configureGameCore(await core.getAddress())).wait();
    await (await core.configureHouseBasket([aapl, msft], [5_000, 5_000])).wait();
    const [basketTickers, basketWeights] = await core.houseBasket();
    assert.deepEqual([...basketTickers], [aapl, msft]);
    assert.deepEqual([...basketWeights], [5_000n, 5_000n]);
    await (await core.configureHouse(3, 100n, 8)).wait();
    await (await router.activate()).wait();
    await (await core.enablePurchases()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stockA.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await stockB.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();

    await (await core.connect(player).buyHouse(3, 100n, [30n, 30n], 9_999_999_999n)).wait();
    assert.equal(await core.houseOwner(3), player.address);
    assert.equal((await core.houses(3)).capacity, 8n);
    assert.equal(await vaultA.protocolReserve(), 30n);
    assert.equal(await vaultB.protocolReserve(), 30n);
    assert.equal(await vaultA.availableSurplus(), 0n);
    assert.equal(await vaultB.availableSurplus(), 0n);
    await assert.rejects(core.connect(player).buyHouse(3, 100n, [30n, 30n], 9_999_999_999n));
  });

  it('does not assign a house if one basket route misses minimum output', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockBurnableToken');
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    const core = await ethers.deployContract('StockdealerGameCore', [admin.address, await router.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    await (await router.configureCurrency(await currency.getAddress())).wait();
    await (await router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await (await core.configureHouseBasket([ticker], [10_000])).wait();
    await (await core.configureHouse(4, 100n, 4)).wait();
    await (await router.activate()).wait();
    await (await core.enablePurchases()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();
    await assert.rejects(core.connect(player).buyHouse(4, 100n, [61n], 9_999_999_999n));
    assert.equal(await core.houseOwner(4), ethers.ZeroAddress);
    assert.equal(await currency.balanceOf(player.address), 100n);
  });
});
