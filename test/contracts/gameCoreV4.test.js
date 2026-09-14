import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;

async function readyV4Farm() {
  const [admin, player] = await ethers.getSigners();
  const currency = await ethers.deployContract('MockBurnableToken');
  const stock = await ethers.deployContract('MockBurnableToken');
  const adapter = await ethers.deployContract('MockSwapAdapter');
  const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
  const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
  const core = await ethers.deployContract('StockdealerGameCoreV4', [admin.address, await router.getAddress()]);
  const ticker = ethers.encodeBytes32String('MSFT');
  await (await router.configureCurrency(await currency.getAddress())).wait();
  await (await router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress())).wait();
  await (await router.configureGameCore(await core.getAddress())).wait();
  await (await vault.configureGameCore(await core.getAddress())).wait();
  await (await core.configureSeedSku(ticker, 100n, 4, await vault.getAddress())).wait();
  await (await core.configureHouseBasket([ticker], [10_000])).wait();
  await (await core.configureHouse(1, 100n, 4)).wait();
  await (await router.activate()).wait();
  await (await core.enablePurchases()).wait();
  await (await core.enableGameplay()).wait();
  await (await core.enableClaims()).wait();
  await (await currency.mint(player.address, 200n)).wait();
  await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
  await (await currency.connect(player).approve(await router.getAddress(), 200n)).wait();
  await (await core.connect(player).buySeedPacks(ticker, 1, 100n, 60n, 9_999_999_999n)).wait();
  return { player, core, ticker };
}

describe('StockdealerGameCoreV4 automatic growth', () => {
  it('starts warehouse growth in the planting transaction without an onchain watering method', async () => {
    const { player, core, ticker } = await readyV4Farm();
    await (await core.connect(player).plantWarehouse(0, ticker)).wait();
    const planted = await core.warehousePlants(player.address, 0);
    assert.ok(planted.plantedAt > 0n);
    assert.equal(planted.wateredAt, planted.plantedAt);
    assert.equal(await core.warehousePlantStage(player.address, 0), 1n);
    const abiNames = core.interface.fragments.filter(fragment => fragment.type === 'function').map(fragment => fragment.name);
    assert.equal(abiNames.includes('waterWarehouse'), false);
    await connection.provider.request({ method: 'evm_setNextBlockTimestamp', params: [Number(planted.plantedAt) + 8 * 3600] });
    await connection.provider.request({ method: 'evm_mine', params: [] });
    assert.equal(await core.warehousePlantStage(player.address, 0), 5n);
  });

  it('starts house-plot growth in the planting transaction without an onchain watering method', async () => {
    const { player, core, ticker } = await readyV4Farm();
    await (await core.connect(player).buyHouse(1, 100n, [60n], 9_999_999_999n)).wait();
    await (await core.connect(player).plant(1, 0, ticker)).wait();
    const planted = await core.plants(1, 0);
    assert.ok(planted.plantedAt > 0n);
    assert.equal(planted.wateredAt, planted.plantedAt);
    const abiNames = core.interface.fragments.filter(fragment => fragment.type === 'function').map(fragment => fragment.name);
    assert.equal(abiNames.includes('water'), false);
    await connection.provider.request({ method: 'evm_setNextBlockTimestamp', params: [Number(planted.plantedAt) + 8 * 3600] });
    await connection.provider.request({ method: 'evm_mine', params: [] });
    assert.equal(await core.plantStage(1, 0), 5n);
  });
});
