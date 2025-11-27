// Mock verifiers for MVP circuits.
// These DO NOT perform cryptographic verification; they enforce simple predicate checks
// to enable end-to-end testing of the contract simulator.

export type PublicSignals = Record<string, any>;

export interface ProofEnvelope {
  circuitId: string;
  vkId: string;
  proof: string;
  publicSignals: PublicSignals;
  nullifiers?: string[];
  merkleRoots?: string[];
  nonce?: string;
  timestampHint?: number;
  sigAggregates?: string[];
}

export function verifyProof(env: ProofEnvelope): boolean {
  const { circuitId, publicSignals } = env;
  switch (circuitId) {
    case 'count-threshold-v1': {
      // Expect met to be 0 || 1; target >= 1
      const met = Number(publicSignals?.met ?? 0);
      const target = Number(publicSignals?.target ?? 0);
      const windowIndex = Number(publicSignals?.windowIndex ?? -1);
      return (windowIndex >= 0) && (target >= 1) && (met === 0 || met === 1);
    }
    case 'deadline-v1': {
      const ok = Number(publicSignals?.ok ?? 0);
      const sub = Number(publicSignals?.submissionEpoch ?? 0);
      const dl = Number(publicSignals?.deadlineEpoch ?? 0);
      return ok === 1 && sub <= dl || ok === 0;
    }
    case 'oracle-fact-v1': {
      const ok = Number(publicSignals?.ok ?? 0);
      return ok === 1 || ok === 0;
    }
    default:
      return false;
  }
}
