import { z } from 'zod';

const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const clientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join_world'),
    worldId: z.string().regex(/^[a-z0-9-]{1,32}$/),
  }).strict(),
  z.object({
    type: z.literal('input'),
    clientSeq: sequence,
    buttons: z.array(z.enum(['forward', 'backward', 'left', 'right', 'run'])).max(5),
    lookDirection: z.number().finite().min(-Math.PI).max(Math.PI),
  }).strict(),

  z.object({
    type: z.literal('ping'),
    clientTime: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
]);

export function parseClientMessage(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 16_384) throw new Error('INVALID_MESSAGE_SIZE');
  let decoded;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
  return clientMessage.parse(decoded);
}

export function acceptClientSequence(previous, next) {
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(next) || next <= previous) throw new Error('STALE_CLIENT_SEQUENCE');
  return next;
}
