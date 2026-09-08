import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;

describe('StockdealerEconomyRouter', () => {
  it('cannot deploy on a chain other than Robinhood Chain Mainnet 4663', async () => {
    const wrongChain = await network.create('wrongChainSimulation');
    const [admin] = await wrongChain.ethers.getSigners();
    await assert.rejects(wrongChain.ethers.deployContract('StockdealerEconomyRouter', [admin.address]));
  });

  it('deploys paused without a currency and configures a contract currency exactly once', async () => {
    const [admin, outsider] = await ethers.getSigners();
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const token = await ethers.deployContract('MockBurnableToken');

    assert.equal(await router.paused(), true);
    assert.equal(await router.currency(), ethers.ZeroAddress);
    await assert.rejects(router.connect(outsider).configureCurrency(await token.getAddress()));
    await (await router.configureCurrency(await token.getAddress())).wait();
    assert.equal(await router.currency(), await token.getAddress());
    await assert.rejects(router.configureCurrency(await token.getAddress()));
  });

  it('atomically burns 40 percent and swaps 60 percent directly into the reward vault', async () => {
    const [admin, player, vault, outsider] = await ethers.getSigners();
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const currency = await ethers.deployContract('MockBurnableToken');
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const core = await ethers.deployContract('MockGameCore', [await router.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    const purchase = ethers.encodeBytes32String('SEEDS');

    await (await router.configureCurrency(await currency.getAddress())).wait();
    const rewardVault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    await (await router.configureRoute(ticker, await stock.getAddress(), await rewardVault.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await router.activate()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();

    await assert.rejects(router.connect(outsider).spendFrom(player.address, 100n, ticker, purchase, 60n, 9_999_999_999n));
    await (await core.spend(player.address, 100n, ticker, purchase, 60n, 9_999_999_999n)).wait();

    assert.equal(await currency.balanceOf(player.address), 0n);
    assert.equal(await currency.totalSupply(), 60n);
    assert.equal(await stock.balanceOf(await rewardVault.getAddress()), 60n);
    assert.equal(await currency.balanceOf(await router.getAddress()), 0n);
    assert.equal(await currency.allowance(await router.getAddress(), await adapter.getAddress()), 0n);
  });

  it('reverts the payment and burn when the stock minimum cannot be met', async () => {
    const [admin, player, vault] = await ethers.getSigners();
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const currency = await ethers.deployContract('MockBurnableToken');
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const core = await ethers.deployContract('MockGameCore', [await router.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    await (await router.configureCurrency(await currency.getAddress())).wait();
    const rewardVault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    await (await router.configureRoute(ticker, await stock.getAddress(), await rewardVault.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await router.activate()).wait();
    await (await currency.mint(player.address, 101n)).wait();
    await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 101n)).wait();

    await assert.rejects(core.spend(player.address, 101n, ticker, ethers.encodeBytes32String('SEEDS'), 1n, 9_999_999_999n));
    await assert.rejects(core.spend(player.address, 100n, ticker, ethers.encodeBytes32String('SEEDS'), 61n, 9_999_999_999n));
    assert.equal(await currency.balanceOf(player.address), 101n);
    assert.equal(await currency.totalSupply(), 101n);
    assert.equal(await stock.balanceOf(await rewardVault.getAddress()), 0n);
  });

  it('atomically splits a house reward share across an exact configured basket', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockBurnableToken');
    const stockA = await ethers.deployContract('MockBurnableToken');
    const stockB = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const core = await ethers.deployContract('MockGameCore', [await router.getAddress()]);
    const vaultA = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stockA.getAddress()]);
    const vaultB = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stockB.getAddress()]);
    const aapl = ethers.encodeBytes32String('AAPL');
    const msft = ethers.encodeBytes32String('MSFT');
    await (await router.configureCurrency(await currency.getAddress())).wait();
    await (await router.configureRoute(aapl, await stockA.getAddress(), await vaultA.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureRoute(msft, await stockB.getAddress(), await vaultB.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await router.activate()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stockA.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await stockB.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();

    await (await core.spendBasket(player.address, 100n, [aapl, msft], [5_000, 5_000], [30n, 30n], 9_999_999_999n)).wait();
    assert.equal(await currency.totalSupply(), 60n);
    assert.equal(await stockA.balanceOf(await vaultA.getAddress()), 30n);
    assert.equal(await stockB.balanceOf(await vaultB.getAddress()), 30n);
  });

  it('rejects a token whose burn function succeeds without reducing balance and total supply', async () => {
    const [admin, player] = await ethers.getSigners();
    const currency = await ethers.deployContract('MockNoOpBurnToken');
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const core = await ethers.deployContract('MockGameCore', [await router.getAddress()]);
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    await (await router.configureCurrency(await currency.getAddress())).wait();
    await (await router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress())).wait();
    await (await router.configureGameCore(await core.getAddress())).wait();
    await (await router.activate()).wait();
    await (await currency.mint(player.address, 100n)).wait();
    await (await stock.mint(await adapter.getAddress(), 1_000n)).wait();
    await (await currency.connect(player).approve(await router.getAddress(), 100n)).wait();
    await assert.rejects(core.spend(player.address, 100n, ticker, ethers.encodeBytes32String('SEEDS'), 60n, 9_999_999_999n));
    assert.equal(await currency.balanceOf(player.address), 100n);
    assert.equal(await currency.balanceOf(await router.getAddress()), 0n);
    assert.equal(await currency.totalSupply(), 100n);
  });

  it('never permits a configured ticker route to be repointed', async () => {
    const [admin] = await ethers.getSigners();
    const stock = await ethers.deployContract('MockBurnableToken');
    const adapter = await ethers.deployContract('MockSwapAdapter');
    const router = await ethers.deployContract('StockdealerEconomyRouter', [admin.address]);
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await stock.getAddress()]);
    const ticker = ethers.encodeBytes32String('MSFT');
    await (await router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress())).wait();
    await assert.rejects(router.configureRoute(ticker, await stock.getAddress(), await vault.getAddress(), await adapter.getAddress()));
  });
});
