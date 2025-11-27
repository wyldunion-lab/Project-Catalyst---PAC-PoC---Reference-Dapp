// Minimal Quest "contract" simulator with nullifier registry and payout logic.

import type { ProofEnvelope } from './verifiers.js';
import { verifyProof } from './verifiers.js';

export type PlayerState = {
  joined: boolean;
  stakeADA: number;
  windowsMet: number;
  windowsTotal: number;
  completionPct: number;
  eligibleToSettle: boolean;
  settled: boolean;
  claimableRewards: Record<string, number>;
  events: string[];
};

export type QuestRules = any;

export class QuestContract {
  public rules: QuestRules;
  public rulesHash: string;
  public payoutMode: 'PPC' | 'AON' | 'TOURNAMENT';
  private nullifiers = new Set<string>();
  private players = new Map<string, PlayerState>();

  constructor(rules: QuestRules, rulesHash: string) {
    this.rules = rules;
    this.rulesHash = rulesHash;
    this.payoutMode = rules?.economics?.payoutMode ?? 'PPC';
  }

  getPlayer(addr: string): PlayerState {
    if (!this.players.has(addr)) {
      const windowsTotal = this._calcWindowsTotal();
      this.players.set(addr, {
        joined: true,
        stakeADA: 50,
        windowsMet: 0,
        windowsTotal,
        completionPct: 0,
        eligibleToSettle: false,
        settled: false,
        claimableRewards: {},
        events: []
      });
    }
    // @ts-ignore
    return this.players.get(addr);
  }

  submitProof(addr: string, env: ProofEnvelope) {
    // basic routing
    if (!verifyProof(env)) throw new Error('VERIFICATION_FAILED');
    // enforce quest binding
    if (env.publicSignals?.questHash !== this.rulesHash) throw new Error('RULES_MISMATCH');
    // consume nullifiers
    for (const n of env.nullifiers ?? []) {
      if (this.nullifiers.has(n)) throw new Error('NULLIFIER_REUSED');
      this.nullifiers.add(n);
    }
    const p = this.getPlayer(addr);

    switch (env.circuitId) {
      case 'count-threshold-v1': {
        if (Number(env.publicSignals.met) === 1) {
          p.windowsMet += 1;
          p.events.push(`MilestoneMet[${env.publicSignals.windowIndex}]`);
        } else {
          p.events.push(`MilestoneMissed[${env.publicSignals.windowIndex}]`);
        }
        p.completionPct = p.windowsMet / p.windowsTotal;
        break;
      }
      case 'deadline-v1': {
        // At MVP we just ensure ok==1 when required by policy; tracked as event
        if (Number(env.publicSignals.ok) !== 1) throw new Error('DEADLINE_NOT_MET');
        p.events.push('DeadlineOk');
        break;
      }
      case 'oracle-fact-v1': {
        if (Number(env.publicSignals.ok) !== 1) throw new Error('ORACLE_FACT_NOT_MET');
        p.events.push(`OracleOk[${env.publicSignals.oracleId}]`);
        break;
      }
      default:
        throw new Error('UNKNOWN_CIRCUIT');
    }
  }

  settle(addr: string) {
    const p = this.getPlayer(addr);
    const minPct = Number(this.rules?.settlement?.successCriteria?.minWindowsCompletedPct ?? 100) / 100;
    p.eligibleToSettle = p.completionPct >= minPct;
    p.settled = true;

    // compute payout (PPC only in simulator)
    const rewardPool = Number(this.rules?.economics?.rewardPool?.amount ?? 0);
    const cw = Number(this.rules?.economics?.payoutWeights?.completionWeight ?? 1);
    const rw = Number(this.rules?.economics?.payoutWeights?.reputationWeight ?? 0);
    const repFactor = 0.05; // Silver example

    const base = rewardPool * cw * p.completionPct;
    const rep = rewardPool * rw * repFactor;
    const total = Math.round((base + rep) * 100) / 100;

    p.claimableRewards = { PACT: total, ADAStakeReturn: p.eligibleToSettle ? p.stakeADA : 0 };
  }

  // helpers
  private _calcWindowsTotal(): number {
    const mf = this.rules?.time?.milestoneFrequency;
    if (!mf?.windowDays) return 0;
    const start = Date.parse(this.rules?.time?.start);
    const end = Date.parse(this.rules?.time?.end);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.ceil(days / Number(mf.windowDays));
  }
}
