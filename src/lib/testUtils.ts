// src/lib/testUtils.ts
// Simple test utility for event flow

import { pushEvent } from "./sync";

export async function testEventFlow(user_id: string) {
  // Simulate a plugin install event
  await pushEvent({
    user_id,
    type: "plugin.install",
    payload: { plugin: "test-plugin", version: "1.0.0" }
  });
  // Simulate a state update event
  await pushEvent({
    user_id,
    type: "state.update",
    payload: { state: "test", timestamp: Date.now() }
  });
  // Add more test cases as needed
  console.log("Test events sent.");
}
