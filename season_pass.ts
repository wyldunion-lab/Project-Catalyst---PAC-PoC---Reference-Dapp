// season_pass.ts
// PAC - Personal Accountability Clubs
// Compact Contract scaffolding for Midnight
// NOTE: This is scaffolding / pseudocode. Replace TODOs with actual Midnight SDK calls.

///////////////////////
// Imports (adjust to real Midnight SDK)
///////////////////////

// import { Contract, Context, Tx, Asset, Address, ZkProof } from "@midnight/compact-sdk";
// import { assert } from "@midnight/compact-sdk/assert";

///////////////////////
// Types & Interfaces
///////////////////////

export type AssetId = string;       // e.g., policyId + assetName
export type Address = string;       // wallet address or PubKeyHash
export type QuestId = string;       // derive from tx hash + index, or incremental
export type SeasonPassId = string;  // NFT token id

export enum QuestStatus {
  Initialized = "initialized",
  InProgress = "in_progress",
  AwaitingProof = "awaiting_proof",
  CompletedSuccess = "completed_success",
  CompletedFailure = "completed_failure",
}

export interface QuestState {
  questId: QuestId;
  templateId: string;           // abstract quest type, no sensitive data
  thresholdPct: number;         // e.g. 80 for 80%
  totalDays: number;            // typically 10
  checkInCommitments: string[]; // encrypted or hashed daily commitments
  encryptedQuestData: string;   // opaque blob/commitment, no plaintext details
  status: QuestStatus;
}

export interface UserState {
  owner: Address;               // linked to the Season Pass NFT owner
  seasonPassId: SeasonPassId;
  depositAsset: AssetId;        // ADA/USDM
  depositAmount: bigint;
  quests: QuestState[];
}

export interface SystemState {
  rewardPoolAsset: AssetId;
  rewardPoolBalance: bigint;
}

/**
 * State container for this contract instance.
 * In a real Compact contract, this would map to on-chain state storage.
 */
export interface ContractState {
  users: Record<SeasonPassId, UserState>;
  system: SystemState;
}

///////////////////////
// ZK Proof Types (placeholder)
///////////////////////

export interface ThresholdZkProof {
  // Structure depends on the actual proving system you use.
  // This is intentionally abstract.
  proofBytes: Uint8Array;
  publicInputs: {
    thresholdPct: number;
    totalDays: number;
    // You may include a commitment root, etc.
  };
}

///////////////////////
// Contract Class
///////////////////////

export class PacSeasonPassContract {
  // In practice, this state would be managed via Compact persistent storage.
  private state: ContractState;

  constructor(initialState?: Partial<ContractState>) {
    this.state = {
      users: {},
      system: {
        rewardPoolAsset: "USDM", // default; adjust as needed
        rewardPoolBalance: BigInt(0),
        ...(initialState?.system || {}),
      },
      ...(initialState || {}),
    };
  }

  ///////////////////////
  // Helper functions
  ///////////////////////

  private getOrCreateUser(seasonPassId: SeasonPassId, owner: Address): UserState {
    let user = this.state.users[seasonPassId];
    if (!user) {
      user = {
        owner,
        seasonPassId,
        depositAsset: "USDM",
        depositAmount: BigInt(0),
        quests: [],
      };
      this.state.users[seasonPassId] = user;
    }
    return user;
  }

  private findQuest(user: UserState, questId: QuestId): QuestState {
    const quest = user.quests.find((q) => q.questId === questId);
    if (!quest) {
      throw new Error("Quest not found");
    }
    return quest;
  }

  ///////////////////////
  // Entry Points (scaffold)
  ///////////////////////

  /**
   * depositStake
   * - Locks user funds.
   * - Mints a Season Pass NFT for the user.
   */
  public depositStake(
    caller: Address,
    amount: bigint,
    depositAsset: AssetId,
  ): { seasonPassId: SeasonPassId } {
    if (amount <= BigInt(0)) {
      throw new Error("Deposit amount must be > 0");
    }

    // TODO: verify that `caller` sent `amount` of `depositAsset` to the contract.

    const seasonPassId: SeasonPassId = this.generateSeasonPassId(caller);

    // TODO: mint Season Pass NFT and assign to `caller`.
    // e.g. mintNft(seasonPassId, caller)

    const user: UserState = {
      owner: caller,
      seasonPassId,
      depositAsset,
      depositAmount: amount,
      quests: [],
    };

    this.state.users[seasonPassId] = user;

    return { seasonPassId };
  }

  /**
   * createQuest
   * - Registers a new quest linked to a Season Pass NFT.
   */
  public createQuest(
    seasonPassId: SeasonPassId,
    owner: Address,
    templateId: string,
    thresholdPct: number,
    totalDays: number,
    encryptedQuestData: string,
  ): { questId: QuestId } {
    if (thresholdPct < 1 || thresholdPct > 100) {
      throw new Error("thresholdPct must be between 1 and 100");
    }
    if (totalDays <= 0) {
      throw new Error("totalDays must be > 0");
    }

    const user = this.getOrCreateUser(seasonPassId, owner);

    // TODO: verify `owner` currently holds the Season Pass NFT (on-chain check).

    const questId: QuestId = this.generateQuestId(seasonPassId, user.quests.length);

    const quest: QuestState = {
      questId,
      templateId,
      thresholdPct,
      totalDays,
      checkInCommitments: [],
      encryptedQuestData,
      status: QuestStatus.Initialized,
    };

    user.quests.push(quest);

    return { questId };
  }

  /**
   * submitDailyCheckIn
   * - Stores a private daily commitment (hash or encrypted payload).
   */
  public submitDailyCheckIn(
    seasonPassId: SeasonPassId,
    owner: Address,
    questId: QuestId,
    commitment: string,
  ): void {
    const user = this.getOrCreateUser(seasonPassId, owner);
    const quest = this.findQuest(user, questId);

    // TODO: verify `owner` holds Season Pass NFT.

    if (
      quest.status !== QuestStatus.Initialized &&
      quest.status !== QuestStatus.InProgress
    ) {
      throw new Error("Quest is not accepting check-ins");
    }

    if (quest.checkInCommitments.length >= quest.totalDays) {
      throw new Error("All check-in slots are already filled");
    }

    quest.checkInCommitments.push(commitment);
    quest.status =
      quest.checkInCommitments.length === quest.totalDays
        ? QuestStatus.AwaitingProof
        : QuestStatus.InProgress;
  }

  /**
   * submitZKProof
   * - Verifies the threshold proof and transitions quest state accordingly.
   */
  public submitZKProof(
    seasonPassId: SeasonPassId,
    owner: Address,
    questId: QuestId,
    zkProof: ThresholdZkProof,
  ): { proofValid: boolean } {
    const user = this.getOrCreateUser(seasonPassId, owner);
    const quest = this.findQuest(user, questId);

    // TODO: verify `owner` holds Season Pass NFT.

    if (quest.status !== QuestStatus.AwaitingProof) {
      throw new Error("Quest is not ready for proof submission");
    }

    // Basic sanity check on proof inputs
    if (zkProof.publicInputs.totalDays !== quest.totalDays) {
      throw new Error("ZK proof totalDays mismatch");
    }
    if (zkProof.publicInputs.thresholdPct !== quest.thresholdPct) {
      throw new Error("ZK proof thresholdPct mismatch");
    }

    // TODO: call Midnight ZK verification primitive.
    // const isValid = verifyThresholdProof(zkProof, quest.checkInCommitments);
    const isValid = this.verifyThresholdProofPlaceholder(zkProof, quest);

    if (isValid) {
      quest.status = QuestStatus.CompletedSuccess;
    } else {
      quest.status = QuestStatus.CompletedFailure;
    }

    return { proofValid: isValid };
  }

  /**
   * settleQuest
   * - Releases deposit on success; routes funds to reward pool on failure.
   */
  public settleQuest(
    seasonPassId: SeasonPassId,
    owner: Address,
    questId: QuestId,
  ): void {
    const user = this.getOrCreateUser(seasonPassId, owner);
    const quest = this.findQuest(user, questId);

    // TODO: verify `owner` holds Season Pass NFT.

    if (
      quest.status !== QuestStatus.CompletedSuccess &&
      quest.status !== QuestStatus.CompletedFailure
    ) {
      throw new Error("Quest not completed; settlement not allowed");
    }

    if (quest.status === QuestStatus.CompletedSuccess) {
      // Success: return user deposit (if not already claimed)
      if (user.depositAmount > BigInt(0)) {
        // TODO: transfer `user.depositAmount` of `user.depositAsset` to `owner`
        // e.g. sendAsset(owner, user.depositAsset, user.depositAmount);
        user.depositAmount = BigInt(0);
      }
    } else {
      // Failure: move deposit to reward pool
      if (user.depositAmount > BigInt(0)) {
        this.state.system.rewardPoolBalance += user.depositAmount;
        // TODO: deposit remains locked in contract as part of rewardPoolAsset.
        user.depositAmount = BigInt(0);
      }
    }
  }

  /**
   * withdrawStake
   * - Optional: allow reclaiming leftover deposit after season ends or after all quests settled.
   *   (You can refine rules as needed.)
   */
  public withdrawStake(
    seasonPassId: SeasonPassId,
    owner: Address,
  ): void {
    const user = this.getOrCreateUser(seasonPassId, owner);

    // TODO: verify season has ended OR all quests settled.

    if (user.depositAmount <= BigInt(0)) {
      throw new Error("No deposit to withdraw");
    }

    // TODO: transfer `user.depositAmount` to `owner`
    // sendAsset(owner, user.depositAsset, user.depositAmount);

    user.depositAmount = BigInt(0);
  }

  /**
   * getQuestStatus
   * - Returns privacy-safe status for UI without revealing sensitive data.
   */
  public getQuestStatus(
    seasonPassId: SeasonPassId,
    owner: Address,
    questId: QuestId,
  ): QuestStatus {
    const user = this.getOrCreateUser(seasonPassId, owner);
    const quest = this.findQuest(user, questId);
    return quest.status;
  }

  ///////////////////////
  // Internal utils (placeholders)
  ///////////////////////

  private generateSeasonPassId(owner: Address): SeasonPassId {
    // TODO: derive from tx + owner or use NFT minting policy.
    return `seasonpass_${owner}_${Date.now()}`;
  }

  private generateQuestId(
    seasonPassId: SeasonPassId,
    index: number,
  ): QuestId {
    return `quest_${seasonPassId}_${index}`;
  }

  /**
   * Placeholder for actual ZK verification.
   * Replace with real Midnight ZK tools.
   */
  private verifyThresholdProofPlaceholder(
    _zkProof: ThresholdZkProof,
    _quest: QuestState,
  ): boolean {
    // TODO: real ZK verification logic.
    // For now, always return true in dev/testing, or gate behind a flag.
    return true;
  }
}
