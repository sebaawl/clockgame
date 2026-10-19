import test from 'node:test';
import assert from 'node:assert/strict';
import { DARK_BACKDROPS, LIGHT_BACKDROPS, nextBackdrop } from '../src/ambience.js';

test('random backdrops never repeat immediately and have a matching light palette', () => {
  assert.equal(DARK_BACKDROPS.length, LIGHT_BACKDROPS.length);
  for (let current = 0; current < DARK_BACKDROPS.length; current++) {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const next = nextBackdrop(current, () => i / 100);
      assert.notEqual(next, current);
      assert.ok(DARK_BACKDROPS[next]); assert.ok(LIGHT_BACKDROPS[next]); seen.add(next);
    }
    assert.equal(seen.size, DARK_BACKDROPS.length - 1);
  }
});
