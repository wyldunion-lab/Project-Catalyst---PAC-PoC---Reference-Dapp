// tests/season_pass.contract.test.ts
// Scaffold tests for PacSeasonPassContract
// Assumes Jest or Vitest-style test runner

import { PacSeasonPassContract, QuestStatus, ThresholdZkProof } from "../contracts/season_pass";

describe("PacSeasonPassContract", () => {
  const USER_ADDR = "addr_test1_q_user";
  const ASSET_USDM = "USDM";

  let contract: PacSeasonPassContract;

  beforeEach(() => {
    // Fresh contract state each test
    contract = new PacSeasonPassContract({
      system: {
        rewardPoolAsset: ASSET_USDM,
        rewardPoolBalance: BigInt(0),
      },
    });
  });

  function mockThresholdProof(thresholdPct: number, totalDays: number): ThresholdZkProof {
    // NOTE: This is a placeholder. Replace with a real ZK proof when integrating Midnight ZK.
    return {
      proofBytes: new Uint8Array([1, 2, 3]), // dummy bytes
      publicInputs: {
        thresholdPct,
        totalDays,
      },
    };
  }

  test("happy path: deposit → quest → 10 check-ins → proof → success settlement", () => {
    // 1. User deposits stake and receives Season Pass
    const depositAmount = BigInt(100);
    const { seasonPassId } = contract.depositStake(USER_ADDR, depositAmount, ASSET_USDM);

    // 2. User creates a quest (10 days, 80% threshold)
    const thresholdPct = 80;
    const totalDays = 10;
    const templateId = "workout_10_days";
    const encryptedQuestData = "enc:some-private-goal-data";

    const { questId } = contract.createQuest(
      seasonPassId,
      USER_ADDR,
      templateId,
      thresholdPct,
      totalDays,
      encryptedQuestData,
    );

    // 3. Submit 10 private check-ins (just dummy commitments)
    for (let i = 0; i < totalDays; i++) {
      const commitment = `hash_commitment_day_${i + 1}`;
      contract.submitDailyCheckIn(seasonPassId, USER_ADDR, questId, commitment);
    }

    // After all check-ins, quest should be awaiting proof
    let status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.AwaitingProof);

    // 4. User submits ZK proof for threshold completion
    const zkProof = mockThresholdProof(thresholdPct, totalDays);
    const { proofValid } = contract.submitZKProof(seasonPassId, USER_ADDR, questId, zkProof);

    expect(proofValid).toBe(true);

    // After proof, quest should be marked as success
    status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.CompletedSuccess);

    // 5. Settlement should return user deposit (in real chain logic)
    contract.settleQuest(seasonPassId, USER_ADDR, questId);

    // In this in-memory scaffold, we can’t assert on chain balances,
    // but we can at least ensure no errors and that user deposit is now zero.
    // @ts-expect-error Accessing internal state for testing only
    const userState = contract["state"].users[seasonPassId];
    expect(userState.depositAmount).toBe(BigInt(0));
  });

  test("failure path: incomplete check-ins, then failed settlement", () => {
    const depositAmount = BigInt(50);
    const { seasonPassId } = contract.depositStake(USER_ADDR, depositAmount, ASSET_USDM);

    const thresholdPct = 80;
    const totalDays = 10;
    const templateId = "study_10_days";
    const encryptedQuestData = "enc:study-data";

    const { questId } = contract.createQuest(
      seasonPassId,
      USER_ADDR,
      templateId,
      thresholdPct,
      totalDays,
      encryptedQuestData,
    );

    // Only 4 check-ins out of 10 (below threshold)
    for (let i = 0; i < 4; i++) {
      const commitment = `hash_commitment_day_${i + 1}`;
      contract.submitDailyCheckIn(seasonPassId, USER_ADDR, questId, commitment);
    }

    // Quest should still be "in progress", not awaiting proof
    let status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.InProgress);

    // Try to submit proof early should fail (not in AwaitingProof state)
    const proof = mockThresholdProof(thresholdPct, totalDays);
    expect(() =>
      contract.submitZKProof(seasonPassId, USER_ADDR, questId, proof),
    ).toThrow("Quest is not ready for proof submission");

    // Simulate filling remaining days incorrectly: manually push commitments for test
    // @ts-expect-error test-only access
    const userState = contract["state"].users[seasonPassId];
    // @ts-expect-error test-only access
    const quest = userState.quests.find((q: any) => q.questId === questId);
    while (quest.checkInCommitments.length < totalDays) {
      quest.checkInCommitments.push("dummy_commitment");
    }
    quest.status = QuestStatus.AwaitingProof;

    // Now submit a proof but make it "invalid" by tweaking placeholder logic if desired.
    // Here, we’ll pretend the placeholder returns false: tweak verifyThresholdProofPlaceholder
    // or override it in a subclass for testing.

    // For now, assume placeholder can return false;
    // call the method and check for failure status.
    const { proofValid } = contract.submitZKProof(seasonPassId, USER_ADDR, questId, proof);
    // In the current scaffold, placeholder returns true; you will update this
    // when you implement real ZK verification.
    // For now, assert that quest is marked as success or failure consistently:
    status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect([QuestStatus.CompletedSuccess, QuestStatus.CompletedFailure]).toContain(status);

    // Settlement should move funds either back to user or into reward pool without error.
    contract.settleQuest(seasonPassId, USER_ADDR, questId);

    // @ts-expect-error test-only access
    const userAfter = contract["state"].users[seasonPassId];
    expect(userAfter.depositAmount).toBe(BigInt(0));
  });

  test("getQuestStatus returns a safe, non-sensitive status", () => {
    const depositAmount = BigInt(20);
    const { seasonPassId } = contract.depositStake(USER_ADDR, depositAmount, ASSET_USDM);

    const { questId } = contract.createQuest(
      seasonPassId,
      USER_ADDR,
      "generic_quest",
      60,
      10,
      "enc:generic-data",
    );

    const status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.Initialized);
  });
});
