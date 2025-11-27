import { describe, it, expect } from 'vitest';
import quest from '../vectors/quest.json';
import proofs from '../vectors/proofs.json';
import expected from '../vectors/expected_contract_state.json';
import { rulesHashHex } from '../src/rules-hash.js';
import { QuestContract } from '../src/simulator/contract.js';
type ProofEnvelope = import('../src/simulator/verifiers.js').ProofEnvelope;

describe('end-to-end flow', () => {
  it('processes proofs and matches expected state snapshot', () => {
    const hash = rulesHashHex(quest);
    const qc = new QuestContract(quest, hash);
    const addr: string = (proofs as any).player;

    for (const sub of (proofs as any).submissions as ProofEnvelope[]) {
      if (sub.publicSignals.questHash && String(sub.publicSignals.questHash).startsWith('<0x')) {
        sub.publicSignals.questHash = hash;
      }
      qc.submitProof(addr, sub);
    }

    qc.settle(addr);
    // @ts-ignore
    const state = qc.getPlayer(addr);

    expect(state.windowsMet).toBe(expected.windowsMet);
    expect(state.windowsTotal).toBe(expected.windowsTotal);
    expect(state.completionPct).toBeCloseTo(expected.completionPct, 6);
    expect(state.claimableRewards.PACT).toBe(expected.claimableRewards.PACT);
    expect(state.claimableRewards.ADAStakeReturn).toBe(expected.claimableRewards.ADAStakeReturn);
    expect(state.events[0]).toBe('MilestoneMet[0]');
    expect(state.events[1]).toBe('MilestoneMissed[1]');
  });
});
