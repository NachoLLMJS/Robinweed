import { randomBytes } from 'node:crypto';
import { getAddress } from 'ethers';
import { SiweMessage } from 'siwe';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createWalletChallenge({ address, origin, now = new Date(), nonceBytes = randomBytes(16) }) {
  const checksummed = getAddress(address);
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.pathname !== '/') throw new Error('INVALID_PRODUCTION_ORIGIN');
  const nonce = Buffer.from(nonceBytes).toString('hex');
  const issuedAt = new Date(now);
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const siwe = new SiweMessage({
    domain: url.host,
    address: checksummed,
    statement: 'Sign in to STOCKDEALER. This does not authorize a transaction.',
    uri: url.origin,
    version: '1',
    chainId: 4663,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
  });
  return Object.freeze({
    address: checksummed.toLowerCase(),
    chainId: 4663,
    domain: url.host,
    uri: url.origin,
    nonce,
    issuedAt,
    expiresAt,
    usedAt: null,
    message: siwe.prepareMessage(),
  });
}

export async function verifyWalletChallenge({ challenge, message, signature, origin, now = new Date(), provider }) {
  if (!challenge || challenge.usedAt || message !== challenge.message) throw new Error('INVALID_OR_USED_CHALLENGE');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || challenge.domain !== url.host || challenge.uri !== url.origin) throw new Error('ORIGIN_MISMATCH');
  if (challenge.chainId !== 4663 || now < challenge.issuedAt || now > challenge.expiresAt) throw new Error('CHALLENGE_EXPIRED');
  const parsed = new SiweMessage(message);
  if (parsed.chainId !== 4663 || parsed.domain !== challenge.domain || parsed.uri !== challenge.uri || parsed.nonce !== challenge.nonce) {
    throw new Error('CHALLENGE_FIELDS_MISMATCH');
  }
  const result = await parsed.verify({ signature, domain: challenge.domain, nonce: challenge.nonce, time: now.toISOString() }, { provider });
  const recovered = getAddress(result.data.address).toLowerCase();
  if (recovered !== challenge.address) throw new Error('SIGNER_MISMATCH');
  return Object.freeze({ address: recovered, chainId: 4663 });
}
