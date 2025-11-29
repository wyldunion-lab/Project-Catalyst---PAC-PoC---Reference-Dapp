// tests/season_pass.contract.test.ts
// Improved scaffold tests for PacSeasonPassContract
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
    // NOTE: placeholder proof structure — replace with real ZK proof integration later
    return {
      proofBytes: new Uint8Array([1, 2, 3]),
      publicInputs: {
        thresholdPct,
        totalDays,
      },
    };
  }

  // helper to create a deposit + quest
  function createQuestAndDeposit({
    depositAmount,
    thresholdPct,
    totalDays,
    templateId,
    encryptedQuestData,
  }: {
    depositAmount: bigint;
    thresholdPct: number;
    totalDays: number;
    templateId: string;
    encryptedQuestData: string;
  }) {
    const depositRes = contract.depositStake(USER_ADDR, depositAmount, ASSET_USDM);
    const seasonPassId = depositRes.seasonPassId;
    const createRes = contract.createQuest(
      seasonPassId,
      USER_ADDR,
      templateId,
      thresholdPct,
      totalDays,
      encryptedQuestData,
    );
    return { seasonPassId, questId: createRes.questId };
  }

  test("happy path: deposit → quest → 10 check-ins → proof → success settlement", () => {
    // Arrange
    const depositAmount = BigInt(100);
    const thresholdPct = 80;
    const totalDays = 10;
    const templateId = "workout_10_days";
    const encryptedQuestData = "enc:some-private-goal-data";

    const { seasonPassId, questId } = createQuestAndDeposit({
      depositAmount,
      thresholdPct,
      totalDays,
      templateId,
      encryptedQuestData,
    });

    // Act - submit the required daily commitments
    for (let i = 0; i < totalDays; i++) {
      const commitment = `hash_commitment_day_${i + 1}`;
      contract.submitDailyCheckIn(seasonPassId, USER_ADDR, questId, commitment);
    }

    // Assert - quest should now be awaiting proof and have the correct number of commitments
    let status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.AwaitingProof);

    // Optional: assert commitments length via internals (test-only)
    // @ts-expect-error accessing internal state for test assertions
    const userState = contract["state"].users[seasonPassId];
    // @ts-expect-error
    const quest = userState.quests.find((q: any) => q.questId === questId);
    expect(quest.checkInCommitments.length).toBe(totalDays);

    // Provide a valid (placeholder) zk proof and ensure verification path results in success.
    const zkProof = mockThresholdProof(thresholdPct, totalDays);

    // If contract has a pluggable verify function, we make sure it returns true for this test.
    // @ts-expect-error test-only override
    if ((contract as any).verifyThresholdProofPlaceholder) {
      // force success
      // @ts-expect-error
      (contract as any).verifyThresholdProofPlaceholder = () => true;
    }

    const { proofValid } = contract.submitZKProof(seasonPassId, USER_ADDR, questId, zkProof);
    expect(proofValid).toBe(true);

    // After proof, quest should be marked success
    status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.CompletedSuccess);

    // Settlement should not throw and should consume the deposit in this scaffold
    contract.settleQuest(seasonPassId, USER_ADDR, questId);

    // @ts-expect-error Accessing internal state for testing only
    const userStateAfter = contract["state"].users[seasonPassId];
    expect(userStateAfter.depositAmount).toBe(BigInt(0));
  });

  test("failure path: incomplete check-ins, then failed settlement (invalid proof)", () => {
    // Arrange
    const depositAmount = BigInt(50);
    const thresholdPct = 80;
    const totalDays = 10;
    const templateId = "study_10_days";
    const encryptedQuestData = "enc:study-data";

    const { seasonPassId, questId } = createQuestAndDeposit({
      depositAmount,
      thresholdPct,
      totalDays,
      templateId,
      encryptedQuestData,
    });

    // Only 4 check-ins out of 10 (below threshold)
    for (let i = 0; i < 4; i++) {
      const commitment = `hash_commitment_day_${i + 1}`;
      contract.submitDailyCheckIn(seasonPassId, USER_ADDR, questId, commitment);
    }

    // Quest should still be "in progress"
    let status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.InProgress);

    // Attempting to submit proof early should throw. Use a loose matcher for the message.
    const proof = mockThresholdProof(thresholdPct, totalDays);
    expect(() =>
      contract.submitZKProof(seasonPassId, USER_ADDR, questId, proof),
    ).toThrow();

    // For the purpose of this test, we simulate the remaining commitments being submitted
    // via test-only access and then test an invalid proof outcome.
    // @ts-expect-error test-only access
    const userState = contract["state"].users[seasonPassId];
    // @ts-expect-error test-only access
    const quest = userState.quests.find((q: any) => q.questId === questId);

    // fill up with dummy commitments and set AwaitingProof
    while (quest.checkInCommitments.length < totalDays) {
      quest.checkInCommitments.push("dummy_commitment");
    }
    quest.status = QuestStatus.AwaitingProof;

    // Now make the verifier return false to simulate an invalid proof
    // @ts-expect-error test-only override
    if ((contract as any).verifyThresholdProofPlaceholder) {
      // force failure
      // @ts-expect-error
      (contract as any).verifyThresholdProofPlaceholder = () => false;
    }

    const { proofValid } = contract.submitZKProof(seasonPassId, USER_ADDR, questId, proof);

    // Explicitly assert that proof was marked invalid and quest moved to failure
    expect(proofValid).toBe(false);
    status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.CompletedFailure);

    // Settlement should move funds appropriately (in this scaffold, ensure no throw and deposit cleared)
    contract.settleQuest(seasonPassId, USER_ADDR, questId);

    // @ts-expect-error test-only access
    const userAfter = contract["state"].users[seasonPassId];
    expect(userAfter.depositAmount).toBe(BigInt(0));
  });

  test("getQuestStatus returns a safe, non-sensitive status at initialization", () => {
    const depositAmount = BigInt(20);
    const { seasonPassId, questId } = createQuestAndDeposit({
      depositAmount,
      thresholdPct: 60,
      totalDays: 10,
      templateId: "generic_quest",
      encryptedQuestData: "enc:generic-data",
    });

    const status = contract.getQuestStatus(seasonPassId, USER_ADDR, questId);
    expect(status).toBe(QuestStatus.Initialized);
  });
});
