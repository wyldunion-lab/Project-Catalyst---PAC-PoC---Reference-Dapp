import { describe, it, expect } from 'vitest';
import expected from '../vectors/expected_contract_state.json';

describe('payout math (PPC example)', () => {
  it('matches expected 6100 PACT with 50 ADA stake return', () => {
    const windowsMet = 3, windowsTotal = 4;
    const completionPct = windowsMet / windowsTotal;
    const rewardPool = 10000, completionWeight = 0.8, reputationWeight = 0.2, repFactor = 0.05;

    const base = rewardPool * completionWeight * completionPct; // 6000
    const repBoost = rewardPool * reputationWeight * repFactor; // 100
    const total = base + repBoost; // 6100

    expect(total).toBe(6100);
    expect(expected.claimableRewards.PACT).toBe(6100);
    expect(expected.claimableRewards.ADAStakeReturn).toBe(50);
  });
});
