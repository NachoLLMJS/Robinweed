import test from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;
const OFFICIAL_SWAP_ROUTER_02 = '0xCaf681a66D020601342297493863E78C959E5cb2';

test('typed Uniswap adapter uses only the official router and a frozen token-pair path', async () => {
  const [admin, recipient, outsider] = await ethers.getSigners();
  const currency = await ethers.deployContract('MockBurnableToken');
  const stock = await ethers.deployContract('MockBurnableToken');
  const caller = await ethers.deployContract('MockAdapterCaller');
  const mockRouter = await ethers.deployContract('MockUniswapV3Router');
  const runtimeCode = await connection.provider.request({ method: 'eth_getCode', params: [await mockRouter.getAddress(), 'latest'] });
  await connection.provider.request({ method: 'hardhat_setCode', params: [OFFICIAL_SWAP_ROUTER_02, runtimeCode] });
  const adapter = await ethers.deployContract('StockdealerUniswapV3Adapter', [admin.address, await caller.getAddress()]);
  const path = ethers.solidityPacked(['address', 'uint24', 'address'], [await currency.getAddress(), 3_000, await stock.getAddress()]);
  await (await adapter.configurePath(await currency.getAddress(), await stock.getAddress(), path)).wait();
  await (await currency.mint(await caller.getAddress(), 60n)).wait();
  await (await stock.mint(OFFICIAL_SWAP_ROUTER_02, 60n)).wait();
  await (await caller.approve(await currency.getAddress(), await adapter.getAddress(), 60n)).wait();
  await assert.rejects(caller.swap(await adapter.getAddress(), await currency.getAddress(), await stock.getAddress(), 60n, 60n, 9_999_999_999n, recipient.address));
  await (await adapter.freezeConfiguration()).wait();
  await assert.rejects(adapter.configurePath(await currency.getAddress(), await stock.getAddress(), path));
  await assert.rejects(adapter.connect(outsider).swapExactInput(await currency.getAddress(), await stock.getAddress(), 60n, 60n, 9_999_999_999n, recipient.address));
  await (await caller.swap(await adapter.getAddress(), await currency.getAddress(), await stock.getAddress(), 60n, 60n, 9_999_999_999n, recipient.address)).wait();
  assert.equal(await stock.balanceOf(recipient.address), 60n);
  assert.equal(await currency.allowance(await adapter.getAddress(), OFFICIAL_SWAP_ROUTER_02), 0n);
});
