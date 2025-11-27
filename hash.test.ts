import { describe, it, expect } from 'vitest';
import { rulesHashHex, canonicalize } from '../src/rules-hash.js';
import quest from '../vectors/quest.json';

describe('rulesHash canonicalization', () => {
  it('is deterministic across canonicalization passes', () => {
    const h1 = rulesHashHex(quest);
    const h2 = rulesHashHex(JSON.parse(canonicalize(quest)));
    expect(h1).toBe(h2);
  });
});
