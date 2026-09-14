import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const connection = await network.create('robinhoodMainnetSimulation');
const { ethers } = connection;

async function fixture() {
  const [owner,recipient]=await ethers.getSigners();
  const input=await ethers.deployContract('MockBurnableToken');
  const output=await ethers.deployContract('MockBurnableToken');
  const factory=await ethers.deployContract('MockPonsFactoryLifecycleV4');
  const permit2=await ethers.deployContract('MockPermit2LifecycleV4');
  const universal=await ethers.deployContract('MockUniversalRouterLifecycleV4',[await permit2.getAddress()]);
  const v3Factory=await ethers.deployContract('MockV3FactoryLifecycleV4');
  const v3Router=await ethers.deployContract('MockV3RouterLifecycleV4',[await v3Factory.getAddress()]);
  const curve=await ethers.deployContract('MockPonsCurveLifecycleV4',[await input.getAddress(),await output.getAddress()]);
  const caller=await ethers.deployContract('MockLifecycleCallerV4');
  await (await factory.setInfrastructure(owner.address,owner.address)).wait();
  await (await factory.setLaunch(await input.getAddress(),await curve.getAddress(),await output.getAddress(),0)).wait();
  const adapter=await ethers.deployContract('StockdealerPonsLifecycleAdapterV4',[owner.address,await caller.getAddress(),await factory.getAddress(),await universal.getAddress(),await permit2.getAddress(),await v3Router.getAddress(),await v3Factory.getAddress(),owner.address]);
  const route=ethers.AbiCoder.defaultAbiCoder().encode(['address','address','bytes'],[await curve.getAddress(),await output.getAddress(),'0x']);
  await (await adapter.configurePath(await input.getAddress(),await output.getAddress(),route)).wait();
  await (await adapter.freezeConfiguration()).wait();
  return {owner,recipient,input,output,factory,permit2,universal,curve,caller,adapter};
}

describe('StockdealerPonsLifecycleAdapterV4',()=>{
  it('uses the authenticated curve before graduation and blocks swept transition',async()=>{
    const x=await fixture();
    await (await x.input.mint(await x.caller.getAddress(),100n)).wait();
    await (await x.output.mint(await x.curve.getAddress(),50n)).wait();
    await (await x.curve.setOutput(50n)).wait();
    await (await x.caller.callSwap(await x.adapter.getAddress(),await x.input.getAddress(),await x.output.getAddress(),100n,50n,x.recipient.address)).wait();
    assert.equal(await x.output.balanceOf(x.recipient.address),50n);
    await (await x.factory.setLaunch(await x.input.getAddress(),await x.curve.getAddress(),await x.output.getAddress(),1)).wait();
    await assert.rejects(x.caller.callSwap(await x.adapter.getAddress(),await x.input.getAddress(),await x.output.getAddress(),1n,1n,x.recipient.address));
  });

  it('switches automatically to the Pons V4 pool at phase 2 and revokes exact approvals',async()=>{
    const x=await fixture();
    await (await x.factory.setLaunch(await x.input.getAddress(),await x.curve.getAddress(),await x.output.getAddress(),2)).wait();
    await (await x.curve.setState(true,false)).wait();
    await (await x.universal.configure(await x.input.getAddress(),await x.output.getAddress(),100n,77n)).wait();
    await (await x.input.mint(await x.caller.getAddress(),100n)).wait();
    await (await x.caller.callSwap(await x.adapter.getAddress(),await x.input.getAddress(),await x.output.getAddress(),100n,70n,x.recipient.address)).wait();
    assert.equal(await x.output.balanceOf(x.recipient.address),77n);
    assert.equal(await x.input.allowance(await x.adapter.getAddress(),await x.permit2.getAddress()),0n);
    assert.equal(await x.permit2.limits(await x.adapter.getAddress(),await x.input.getAddress(),await x.universal.getAddress()),0n);
  });

  it('routes a graduated native Pons pair through WETH into the requested stock token',async()=>{
    const [owner,recipient]=await ethers.getSigners();
    const input=await ethers.deployContract('MockBurnableToken');
    const weth=await ethers.deployContract('MockBurnableToken');
    const output=await ethers.deployContract('MockBurnableToken');
    const factory=await ethers.deployContract('MockPonsFactoryLifecycleV4');
    const permit2=await ethers.deployContract('MockPermit2LifecycleV4');
    const universal=await ethers.deployContract('MockUniversalRouterLifecycleV4',[await permit2.getAddress()]);
    const v3Factory=await ethers.deployContract('MockV3FactoryLifecycleV4');
    const v3Router=await ethers.deployContract('MockV3RouterLifecycleV4',[await v3Factory.getAddress()]);
    const curve=await ethers.deployContract('MockPonsCurveLifecycleV4',[await input.getAddress(),ethers.ZeroAddress]);
    const caller=await ethers.deployContract('MockLifecycleCallerV4');
    await (await factory.setInfrastructure(owner.address,owner.address)).wait();
    await (await factory.setLaunch(await input.getAddress(),await curve.getAddress(),ethers.ZeroAddress,0)).wait();
    const adapter=await ethers.deployContract('StockdealerPonsLifecycleAdapterV4',[owner.address,await caller.getAddress(),await factory.getAddress(),await universal.getAddress(),await permit2.getAddress(),await v3Router.getAddress(),await v3Factory.getAddress(),await weth.getAddress()]);
    const path=ethers.solidityPacked(['address','uint24','address'],[await weth.getAddress(),3000,await output.getAddress()]);
    const route=ethers.AbiCoder.defaultAbiCoder().encode(['address','address','bytes'],[await curve.getAddress(),ethers.ZeroAddress,path]);
    await (await adapter.configurePath(await input.getAddress(),await output.getAddress(),route)).wait();
    await (await adapter.freezeConfiguration()).wait();
    await (await factory.setLaunch(await input.getAddress(),await curve.getAddress(),ethers.ZeroAddress,2)).wait();
    await (await universal.configure(await input.getAddress(),ethers.ZeroAddress,100n,77n)).wait();
    await owner.sendTransaction({to:await universal.getAddress(),value:77n});
    await (await input.mint(await caller.getAddress(),100n)).wait();
    await (await caller.callSwap(await adapter.getAddress(),await input.getAddress(),await output.getAddress(),100n,70n,recipient.address)).wait();
    assert.equal(await output.balanceOf(recipient.address),77n);
    assert.equal(await ethers.provider.getBalance(await adapter.getAddress()),0n);
  });
});
