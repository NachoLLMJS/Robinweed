import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;

async function readyFarm() {
  const [admin, player, outsider] = await ethers.getSigners();
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
  await (await core.configureHouseBasket([ticker], [10_000])).wait();
  await (await core.configureHouse(1, 100n, 4)).wait();
  await (await router.activate()).wait();
  await (await core.enablePurchases()).wait();
  await (await currency.mint(player.address, 200n)).wait();
  await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
  await (await currency.connect(player).approve(await router.getAddress(), 200n)).wait();
  await (await core.connect(player).buyHouse(1, 100n, [60n], 9_999_999_999n)).wait();
  await (await core.connect(player).buySeedPacks(ticker, 1, 100n, 60n, 9_999_999_999n)).wait();
  await (await core.enableGameplay()).wait();
  await (await core.enableClaims()).wait();
  return { admin, player, outsider, stock, vault, core, ticker };
}

describe('StockdealerGameCore cultivation', () => {
  it('consumes one funded seed, waters once, and derives four two-hour growth transitions', async () => {
    const { player, outsider, vault, core, ticker } = await readyFarm();
    await assert.rejects(core.connect(outsider).plant(1, 0, ticker));
    await (await core.connect(player).plant(1, 0, ticker)).wait();
    assert.equal(await vault.remainingSeeds(player.address), 3n);
    assert.equal(await core.plantStage(1, 0), 1n);
    await (await core.connect(player).water(1, 0)).wait();
    await assert.rejects(core.connect(player).water(1, 0));

    const plant = await core.plants(1, 0);
    for (const [hours, expected] of [[2, 2n], [4, 3n], [6, 4n], [8, 5n]]) {
      await connection.provider.request({ method: 'evm_setNextBlockTimestamp', params: [Number(plant.wateredAt) + hours * 3600] });
      await connection.provider.request({ method: 'evm_mine', params: [] });
      assert.equal(await core.plantStage(1, 0), expected);
    }
  });

  it('releases the funded stock entitlement exactly once after eight hours', async () => {
    const { player, stock, core, ticker } = await readyFarm();
    await (await core.connect(player).plant(1, 0, ticker)).wait();
    await (await core.connect(player).water(1, 0)).wait();
    await assert.rejects(core.connect(player).claimHarvest(1, 0, player.address));
    const plant = await core.plants(1, 0);
    await connection.provider.request({ method: 'evm_setNextBlockTimestamp', params: [Number(plant.wateredAt) + 8 * 3600] });
    await connection.provider.request({ method: 'evm_mine', params: [] });
    await (await core.connect(player).claimHarvest(1, 0, player.address)).wait();
    assert.equal(await stock.balanceOf(player.address), 15n);
    assert.equal((await core.plants(1, 0)).ticker, ethers.ZeroHash);
    await assert.rejects(core.connect(player).claimHarvest(1, 0, player.address));
  });
});
