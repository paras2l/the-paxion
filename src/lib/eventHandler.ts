// Standardized event types
export type EventType =
  | "plugin.install"
  | "plugin.remove"
  | "command.run"
  | "automation.execute"
  | "state.update";

// src/lib/eventHandler.ts

import { getDeviceId } from "./device";
import { z } from "zod";
import { notifyOnEvent } from "./pushNotifications";
import { getContext } from "./memory";

// Zod schema for event validation
const eventSchema = z.object({
  id: z.string(),
  device_id: z.string(),
  type: z.string(),
  payload: z.any(),
  expires_at: z.string().optional(),
}).passthrough();

const processedEvents = new Set<string>();
const deviceId = getDeviceId();

// Main event handler for all incoming events with deduplication
export function handleIncomingEvent(event: any) {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) {
    console.error("Invalid event", parsed.error, event);
    return;
  }
  const validEvent = parsed.data;
  // Ignore expired events
  if (validEvent.expires_at && new Date(validEvent.expires_at) < new Date()) {
    return;
  }
  if (processedEvents.has(validEvent.id)) return;
  if (validEvent.device_id === deviceId) return;
  processedEvents.add(validEvent.id);

  // Enrich context before processing
  const context = getContext(validEvent.payload?.text || validEvent.type || "");
  validEvent.context = context;

  // Trigger push notification for important events
  notifyOnEvent(validEvent as any);

  switch (validEvent.type) {
    case "plugin.install":
      installPluginLocal(validEvent.payload);
      break;
    case "plugin.remove":
      removePluginLocal(validEvent.payload);
      break;
    case "automation.execute":
      runAutomationLocal(validEvent.payload);
      break;
    case "command.run":
      processCommand(validEvent.payload);
      break;
    case "state.update": {
      // Last Write Wins: only apply if incoming is newer
      const incoming = validEvent.payload;
      const local = getLocalState();
      if (!local || incoming.timestamp > local.timestamp) {
        updateLocalState(incoming);
      }
      break;
    }
    default:
      // Optionally handle unknown event types
      console.warn("Unknown event type:", validEvent.type, validEvent);
  }
}

// Stub implementations (replace with real logic or imports)
function installPluginLocal(payload: any) {
  // ...implement plugin installation logic
}
function removePluginLocal(payload: any) {
  // ...implement plugin removal logic
}
function runAutomationLocal(payload: any) {
  // ...implement automation logic
}
function processCommand(payload: any) {
  // ...implement chat command logic
}
function updateLocalState(payload: any) {
  // ...implement state update logic
}

function getLocalState(): any {
  // TODO: Return the current local state object, including a timestamp property
  // Example: return { ...state, timestamp: state.timestamp }
  return null;
}
