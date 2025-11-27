# Project-Catalyst---PAC-PoC---Reference-Dapp
Pesonal Accountability Club - A decentralized zero-knowledge proof Human RWA incentivization tool  
[README.md](https://github.com/user-attachments/files/23782692/README.md)
# Midnight Accountability Blueprint

A minimal, testable scaffold for a privacy-first accountability dApp on **Midnight** (Cardano sidechain). It includes:
- Deterministic **rules hash** canonicalizer (TypeScript + BLAKE2b-256)
- **Test vectors** for quests, events, proofs, and expected payouts
- **Vitest** unit tests for determinism and payout math

## Quick start

```bash
# From this folder
npm install
npm test

# Print canonical JSON + rulesHash for vectors/quest.json
npx tsx scripts/hash-quest.ts
```

## Structure

```
src/                # canonicalizer + exports
vectors/            # sample quest, events, proofs, expected contract state
test/               # vitest tests
scripts/            # helper to hash the quest rules
```

## Notes

- Arrays preserve user order; only object keys are sorted in canonicalization.
- Non-finite numbers and `undefined` are stripped before hashing.
- Hash is **blake2b-256** of canonical UTF-8 JSON (hex prefixed with `0x`).


