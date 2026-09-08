import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

const { ethers } = await network.create('robinhoodMainnetSimulation');

describe('StockdealerRewardVault', () => {
  it('allocates a funded pack across seeds and releases each position once', async () => {
    const [admin, buyer] = await ethers.getSigners();
    const asset = await ethers.deployContract('MockBurnableToken');
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await asset.getAddress()]);
    const core = await ethers.deployContract('MockVaultCore', [await vault.getAddress()]);
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await (await asset.mint(await vault.getAddress(), 101n)).wait();
    await (await core.creditPack(buyer.address, 4, 100n)).wait();

    assert.equal(await vault.totalLiability(), 100n);
    assert.equal(await vault.availableSurplus(), 1n);

    const positions = [1n, 2n, 3n, 4n].map(value => ethers.zeroPadValue(ethers.toBeHex(value), 32));
    for (const position of positions) await (await core.consumeSeed(buyer.address, position)).wait();
    for (const position of positions) assert.equal(await vault.positionEntitlement(position), 25n);

    await (await core.release(positions[0], buyer.address)).wait();
    assert.equal(await asset.balanceOf(buyer.address), 25n);
    assert.equal(await vault.totalLiability(), 75n);
    await assert.rejects(core.release(positions[0], buyer.address));
  });

  it('rejects unfunded credit and only permits recovery of true surplus', async () => {
    const [admin, buyer, outsider] = await ethers.getSigners();
    const asset = await ethers.deployContract('MockBurnableToken');
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await asset.getAddress()]);
    const core = await ethers.deployContract('MockVaultCore', [await vault.getAddress()]);
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await assert.rejects(core.creditPack(buyer.address, 4, 100n));
    await (await asset.mint(await vault.getAddress(), 101n)).wait();
    await (await core.creditPack(buyer.address, 4, 100n)).wait();
    await assert.rejects(vault.connect(outsider).recoverSurplus(outsider.address, 1n));
    await assert.rejects(vault.recoverSurplus(admin.address, 2n));
    await (await vault.recoverSurplus(admin.address, 1n)).wait();
    assert.equal(await vault.availableSurplus(), 0n);
    assert.equal(await vault.totalLiability(), 100n);
  });

  it('never reuses house protocol reserves to collateralize seed packs', async () => {
    const [admin, buyer] = await ethers.getSigners();
    const asset = await ethers.deployContract('MockBurnableToken');
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await asset.getAddress()]);
    const core = await ethers.deployContract('MockVaultCore', [await vault.getAddress()]);
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await (await asset.mint(await vault.getAddress(), 100n)).wait();
    await (await core.creditReserve(60n)).wait();
    await assert.rejects(core.creditPack(buyer.address, 4, 100n));
    assert.equal(await vault.protocolReserve(), 60n);
    assert.equal(await vault.totalLiability(), 0n);
  });

  it('lets only the Safe owner withdraw protocol reserves without touching user liabilities', async () => {
    const [admin, buyer, outsider] = await ethers.getSigners();
    const asset = await ethers.deployContract('MockBurnableToken');
    const vault = await ethers.deployContract('StockdealerRewardVault', [admin.address, await asset.getAddress()]);
    const core = await ethers.deployContract('MockVaultCore', [await vault.getAddress()]);
    await (await vault.configureGameCore(await core.getAddress())).wait();
    await (await asset.mint(await vault.getAddress(), 160n)).wait();
    await (await core.creditPack(buyer.address, 4, 100n)).wait();
    await (await core.creditReserve(60n)).wait();
    await assert.rejects(vault.connect(outsider).withdrawProtocolReserve(outsider.address, 1n));
    await assert.rejects(vault.withdrawProtocolReserve(admin.address, 61n));
    await (await vault.withdrawProtocolReserve(admin.address, 60n)).wait();
    assert.equal(await asset.balanceOf(admin.address), 60n);
    assert.equal(await vault.protocolReserve(), 0n);
    assert.equal(await vault.totalLiability(), 100n);
  });
});
