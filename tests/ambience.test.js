import test from 'node:test';
import assert from 'node:assert/strict';
import { DARK_BACKDROPS, LIGHT_BACKDROPS, nextBackdrop, backdropColors } from '../src/ambience.js';

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

test('neutral backdrops retain white/black flashes and blue Nitro; colored backdrops share complementary accents', () => {
  assert.deepEqual(backdropColors(0), { accent: '#54d8ff', flash: '#ffffff' });
  assert.deepEqual(backdropColors(0, true), { accent: '#007fa8', flash: '#000000' });
  for (const light of [false, true]) {
    const colors = DARK_BACKDROPS.slice(1).map((_, i) => backdropColors(i + 1, light));
    assert.equal(new Set(colors.map(c => c.accent)).size, colors.length);
    for (const color of colors) {
      assert.equal(color.accent, color.flash);
      assert.match(color.accent, light ? /75% 30%/ : /75% 76%/);
    }
  }
});
