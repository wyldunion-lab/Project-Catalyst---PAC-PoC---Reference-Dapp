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
stateDiagram-v2
    [*] --> Deposit
    Deposit: depositStake()
    Deposit --> SeasonPassActive: Season Pass NFT minted\nDeposit locked

    state SeasonPassActive {
        [*] --> QuestInitialized

        QuestInitialized: createQuest()
        QuestInitialized --> InProgress: submitDailyCheckIn()\n(first check-in)

        InProgress: submitDailyCheckIn()\n(1..N check-ins)
        InProgress --> AwaitingProof: all check-ins submitted\n(totalDays reached)

        AwaitingProof: submitZKProof()
        AwaitingProof --> CompletedSuccess: ZK proof valid\n(threshold met)
        AwaitingProof --> CompletedFailure: ZK proof invalid\n(threshold not met)

        CompletedSuccess: settleQuest()\nDeposit returned to owner
        CompletedFailure: settleQuest()\nDeposit moved to reward pool

        CompletedSuccess --> [*]
        CompletedFailure --> [*]
    }

    SeasonPassActive --> WithdrawSeason: withdrawStake()\n(optional, if rules allow)
    WithdrawSeason --> [*]

## Notes

- Arrays preserve user order; only object keys are sorted in canonicalization.
- Non-finite numbers and `undefined` are stripped before hashing.
- Hash is **blake2b-256** of canonical UTF-8 JSON (hex prefixed with `0x`).


