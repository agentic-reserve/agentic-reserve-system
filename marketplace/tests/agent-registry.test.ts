import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { setupTestContext } from "./setup";

/**
 * Agent Registry Tests
 * 
 * Basic test structure - will be expanded in subsequent tasks
 */

describe("agent-registry", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;

  before(async () => {
    context = await setupTestContext();
  });

  it("Initializes the program", async () => {
    // Basic initialization test
    // Will be expanded with actual functionality in task 2
    assert.ok(context.agentRegistry);
  });
});
