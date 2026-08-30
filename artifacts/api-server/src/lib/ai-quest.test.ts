import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalQuestPoints, generatedQuestSchema, inspectCandidate, validateGenerationInputs } from "./ai-quest";

const interest = "11111111-1111-4111-8111-111111111111";

describe("AI Quest safety boundary", () => {
  it("requires lane-specific trusted generation inputs", () => {
    assert.equal(validateGenerationInputs("daily", {}).valid, false);
    assert.equal(validateGenerationInputs("monthly", { theme: "Spring", target_month: "2026-04" }).valid, true);
    assert.equal(validateGenerationInputs("geo", { public_location_context: "public park", approximate_area: "downtown", secret: "no" }).valid, false);
  });

  it("rejects unsafe or noncanonical candidates before staff review", () => {
    const candidate = generatedQuestSchema.parse({
      title: "Explore a public trail", summary: "Notice three colors on a public trail.",
      description: "Visit a publicly accessible trail during safe daylight hours and notice three colors in the environment.",
      quest_type: "daily", difficulty: "easy", estimated_duration_minutes: 20, recommended_points: canonicalQuestPoints.easy,
      category: "nature", interest_bubble_ids: [interest], objectives: ["Notice three colors on the trail."],
       verification_methods: ["camera"], required_duration_minutes: null,
      proof_type: "photo", proof_instructions: "Take one photo of a public view.", safety_notes: ["Stay on marked public paths."],
      accessibility_notes: ["Choose an accessible route when available."], location_requirement: "none",
      reasoning_metadata: { difficulty_reason: "Short walk", points_reason: "Canonical easy points", proof_reason: "Simple public photo" },
    });
    assert.equal(inspectCandidate(candidate, "daily").valid, true);
    const unsafe = { ...candidate, description: "Trespass into a restricted area to finish this." };
    assert.equal(inspectCandidate(unsafe, "daily").valid, false);
  });

  it("enforces method-specific verification requirements deterministically", () => {
    const base = generatedQuestSchema.parse({
      title: "Timed public observation", summary: "Observe a public place for a short timed interval.",
      description: "Spend time observing a public place safely and record what you notice.",
      quest_type: "daily", difficulty: "easy", estimated_duration_minutes: 20, recommended_points: canonicalQuestPoints.easy,
      category: "observation", interest_bubble_ids: [interest], objectives: ["Observe the setting."],
      verification_methods: ["timer"], required_duration_minutes: 10,
      proof_type: "none", proof_instructions: "", safety_notes: ["Stay in a safe public area."],
      accessibility_notes: [], location_requirement: "none",
      reasoning_metadata: { difficulty_reason: "Short activity", points_reason: "Canonical easy points", proof_reason: "Timer verification" },
    });
    assert.equal(inspectCandidate(base, "daily").valid, true);
    assert.equal(inspectCandidate({ ...base, required_duration_minutes: 0 }, "daily").valid, false);
    assert.equal(inspectCandidate({ ...base, verification_methods: ["gps"], required_duration_minutes: null }, "daily").valid, false);
    assert.equal(inspectCandidate({ ...base, verification_methods: ["integrity_confirmation"], proof_type: "photo" }, "daily").valid, false);
    assert.equal(inspectCandidate({ ...base, verification_methods: ["integrity_confirmation", "timer"], required_duration_minutes: 10 }, "daily").valid, true);
  });
});