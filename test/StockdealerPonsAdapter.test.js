import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;
const V3_ROUTER = '0xCaf681a66D020601342297493863E78C959E5cb2';
const V3_FACTORY = '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA';
const V3_POOL = '0x000000000000000000000000000000000000F001';

function v3Path(tokenIn, fee, tokenOut) {
  return ethers.solidityPacked(['address', 'uint24', 'address'], [tokenIn, fee, tokenOut]);
}

async function installRuntime(contractName, address) {
  const source = await ethers.deployContract(contractName);
  await source.waitForDeployment();
  await connection.provider.request({ method: 'hardhat_setCode', params: [address, await ethers.provider.getCode(await source.getAddress())] });
}

async function fixture() {
  const [owner, recipient, outsider] = await ethers.getSigners();
  const currency = await ethers.deployContract('MockBurnableToken');
  const pairToken = await ethers.deployContract('MockBurnableToken');
  const targetStock = await ethers.deployContract('MockBurnableToken');
  const economyRouter = await ethers.deployContract('MockAdapterCaller');
  await Promise.all([currency.waitForDeployment(), pairToken.waitForDeployment(), targetStock.waitForDeployment(), economyRouter.waitForDeployment()]);
  const curve = await ethers.deployContract('MockPonsBondingCurve', [await currency.getAddress(), await pairToken.getAddress()]);
  await curve.waitForDeployment();
  await installRuntime('MockUniswapV3Router', V3_ROUTER);
  await installRuntime('MockUniswapV3Factory', V3_FACTORY);
  await installRuntime('MockUniswapV3Pool', V3_POOL);
  const adapter = await ethers.deployContract('StockdealerPonsAdapter', [owner.address, await economyRouter.getAddress()]);
  await adapter.waitForDeployment();
  return { owner, recipient, outsider, currency, pairToken, targetStock, economyRouter, curve, adapter };
}

function config(curve, pairToken, activePath) {
  return ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'bytes'], [curve, pairToken, activePath]);
}

test('Pons adapter sells on the authenticated curve then swaps the pair token into the requested stock', async () => {
  const f = await fixture();
  const amount = ethers.parseEther('100');
  await f.currency.mint(await f.economyRouter.getAddress(), amount);
  await f.pairToken.mint(await f.curve.getAddress(), amount);
  await f.targetStock.mint(V3_ROUTER, amount);
  const activePath=v3Path(await f.pairToken.getAddress(),500,await f.targetStock.getAddress());
  await f.adapter.configurePath(await f.currency.getAddress(),await f.targetStock.getAddress(),config(await f.curve.getAddress(),await f.pairToken.getAddress(),activePath));
  await f.adapter.freezeConfiguration();
  await f.economyRouter.approve(await f.currency.getAddress(), await f.adapter.getAddress(), amount);
  await f.economyRouter.swap(await f.adapter.getAddress(), await f.currency.getAddress(), await f.targetStock.getAddress(), amount, amount, 9_999_999_999n, f.recipient.address);
  assert.equal(await f.targetStock.balanceOf(f.recipient.address), amount);
  assert.equal(await f.currency.allowance(await f.adapter.getAddress(), await f.curve.getAddress()), 0n);
  assert.equal(await f.pairToken.allowance(await f.adapter.getAddress(), V3_ROUTER), 0n);
});

test('Pons adapter fails closed after graduation until the Safe activates a verified one-time V3 path', async () => {
  const f = await fixture();
  const amount = ethers.parseEther('25');
  const graduatedPath=v3Path(await f.currency.getAddress(),3000,await f.pairToken.getAddress());
  await f.currency.mint(await f.economyRouter.getAddress(), amount*2n);
  await f.pairToken.mint(await f.curve.getAddress(), amount);
  await f.adapter.configurePath(await f.currency.getAddress(),await f.pairToken.getAddress(),config(await f.curve.getAddress(),await f.pairToken.getAddress(),'0x'));
  await f.adapter.freezeConfiguration();
  await f.economyRouter.approve(await f.currency.getAddress(),await f.adapter.getAddress(),amount);
  await f.economyRouter.swap(await f.adapter.getAddress(),await f.currency.getAddress(),await f.pairToken.getAddress(),amount,amount,9_999_999_999n,f.recipient.address);
  await f.curve.setGraduated(true);
  await f.economyRouter.approve(await f.currency.getAddress(),await f.adapter.getAddress(),amount);
  await assert.rejects(f.economyRouter.swap(await f.adapter.getAddress(),await f.currency.getAddress(),await f.pairToken.getAddress(),amount,1n,9_999_999_999n,f.recipient.address));
  await f.pairToken.mint(V3_ROUTER,amount);
  await assert.rejects(f.adapter.connect(f.outsider).activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),graduatedPath));
  await assert.rejects(f.adapter.activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),v3Path(await f.pairToken.getAddress(),3000,await f.currency.getAddress())));
  await assert.rejects(f.adapter.activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),v3Path(await f.currency.getAddress(),123,await f.pairToken.getAddress())));
  await f.adapter.activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),graduatedPath);
  await assert.rejects(f.adapter.activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),graduatedPath));
  await f.economyRouter.approve(await f.currency.getAddress(),await f.adapter.getAddress(),amount);
  await f.economyRouter.swap(await f.adapter.getAddress(),await f.currency.getAddress(),await f.pairToken.getAddress(),amount,amount,9_999_999_999n,f.recipient.address);
  assert.equal(await f.pairToken.balanceOf(f.recipient.address),amount*2n);
  assert.equal(await f.currency.allowance(await f.adapter.getAddress(),V3_ROUTER),0n);
});

test('Pons adapter rejects ready-to-graduate curves, mismatched identities and non-router callers', async () => {
  const f = await fixture();
  const wrongPair = await ethers.deployContract('MockBurnableToken');
  await wrongPair.waitForDeployment();
  await assert.rejects(f.adapter.configurePath(await f.currency.getAddress(),await wrongPair.getAddress(),config(await f.curve.getAddress(),await wrongPair.getAddress(),'0x')));
  await f.adapter.configurePath(await f.currency.getAddress(),await f.pairToken.getAddress(),config(await f.curve.getAddress(),await f.pairToken.getAddress(),'0x'));
  await f.adapter.freezeConfiguration();
  await f.curve.setReadyToGraduate(true);
  await f.currency.mint(await f.economyRouter.getAddress(),1n);
  await f.economyRouter.approve(await f.currency.getAddress(),await f.adapter.getAddress(),1n);
  await assert.rejects(f.economyRouter.swap(await f.adapter.getAddress(),await f.currency.getAddress(),await f.pairToken.getAddress(),1n,1n,9_999_999_999n,f.recipient.address));
  await assert.rejects(f.adapter.activateGraduatedPath(await f.currency.getAddress(),await f.pairToken.getAddress(),v3Path(await f.currency.getAddress(),3000,await f.pairToken.getAddress())));
  await assert.rejects(f.adapter.connect(f.outsider).swapExactInput(await f.currency.getAddress(),await f.pairToken.getAddress(),1n,1n,9_999_999_999n,f.recipient.address));
});
