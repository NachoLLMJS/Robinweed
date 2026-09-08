import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBytes32String } from 'ethers';
import { readWalletGameState } from '../server/gameStateService.js';

const wallet = '0x1111111111111111111111111111111111111111';
const msft = encodeBytes32String('MSFT');
const empty = ['0x' + '0'.repeat(64), 0n, 0n, '0x' + '0'.repeat(64)];
const gameCore = {
  houses: async id => [id === 2 ? 100n : 0n, id === 2 ? 4n : 0n, id === 2],
  houseOwner: async id => id === 2 ? wallet : '0x0000000000000000000000000000000000000000',
  plants: async (_house, plot) => plot === 0 ? [msft, 100n, 200n, `0x${'9'.repeat(64)}`] : empty,
  plantStage: async (_house, plot) => plot === 0 ? 3n : 0n,
};
const vaults = new Map([['MSFT', { remainingSeeds: async () => 3n, unassignedCredit: async () => 45n }]]);

test('wallet state snapshot derives owned houses, crops and funded seed balances from contracts', async () => {
  const snapshot = await readWalletGameState({ address: wallet, gameCore, propertyIds: [1, 2], vaults, blockTag: 123, blockHash: `0x${'a'.repeat(64)}` });
  assert.equal(snapshot.blockNumber, 123);
  assert.equal(snapshot.blockHash, `0x${'a'.repeat(64)}`);
  assert.equal(snapshot.properties[1].owner, wallet);
  assert.deepEqual(snapshot.crops, [{ houseId: 2, plotId: 0, ticker: 'MSFT', plantedAt: 100, wateredAt: 200, stage: 3 }]);
  assert.deepEqual(snapshot.seeds.MSFT, { remaining: '3', unassignedRawCredit: '45' });
});

test('wallet state snapshot rejects malformed wallet addresses', async () => {
  await assert.rejects(readWalletGameState({ address: 'bad', gameCore, propertyIds: [], vaults }));
});

test('wallet state snapshot rejects unsupported capacities before iterating crop RPC reads', async () => {
  let plantReads = 0;
  const hostileCore = {
    houses: async () => [100n, 255n, true],
    houseOwner: async () => wallet,
    plants: async () => { plantReads += 1; return empty; },
    plantStage: async () => 0n,
  };
  await assert.rejects(readWalletGameState({ address: wallet, gameCore: hostileCore, propertyIds: [1], vaults: new Map() }), /INVALID_PROPERTY_CAPACITY/);
  assert.equal(plantReads, 0);
});
