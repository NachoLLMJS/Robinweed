import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteSeedService } from '../server/chainBindings.js';

test('quote bindings stay absent while economy is inactive or required contracts are missing', () => {
  assert.equal(createQuoteSeedService({ publicConfig: { economyActive: false, contracts: [] } }), null);
  assert.equal(createQuoteSeedService({ publicConfig: { economyActive: true, contracts: [] } }), null);
});

test('quote bindings pin Robinhood mainnet and the official QuoterV2', () => {
  const source = createQuoteSeedService.toString();
  assert.match(source, /4663/);
  assert.match(source, /0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7/i);
});
