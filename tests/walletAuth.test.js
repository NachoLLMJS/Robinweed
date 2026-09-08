import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createWalletChallenge, verifyWalletChallenge } from '../server/walletAuth.js';

const origin = 'https://stockdealer.example';

test('wallet auth creates and verifies an exact five-minute Robinhood mainnet SIWE challenge', async () => {
  const wallet = Wallet.createRandom();
  const now = new Date('2026-09-07T17:00:00.000Z');
  const challenge = createWalletChallenge({ address: wallet.address, origin, now, nonceBytes: Buffer.alloc(16, 7) });
  assert.equal(challenge.chainId, 4663);
  assert.equal(challenge.expiresAt.getTime() - now.getTime(), 5 * 60 * 1000);
  const signature = await wallet.signMessage(challenge.message);
  const verified = await verifyWalletChallenge({ challenge, message: challenge.message, signature, origin, now: new Date(now.getTime() + 1_000) });
  assert.equal(verified.address, wallet.address.toLowerCase());
});

test('wallet auth rejects altered domain, expired challenge, replay, and wrong signature', async () => {
  const wallet = Wallet.createRandom();
  const attacker = Wallet.createRandom();
  const now = new Date('2026-09-07T17:00:00.000Z');
  const challenge = createWalletChallenge({ address: wallet.address, origin, now, nonceBytes: Buffer.alloc(16, 9) });
  const signature = await wallet.signMessage(challenge.message);
  await assert.rejects(verifyWalletChallenge({ challenge, message: challenge.message, signature, origin: 'https://evil.example', now }));
  await assert.rejects(verifyWalletChallenge({ challenge, message: challenge.message, signature, origin, now: new Date(now.getTime() + 301_000) }));
  await assert.rejects(verifyWalletChallenge({ challenge: { ...challenge, usedAt: now }, message: challenge.message, signature, origin, now }));
  await assert.rejects(verifyWalletChallenge({ challenge, message: challenge.message, signature: await attacker.signMessage(challenge.message), origin, now }));
});
