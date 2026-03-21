// Rate limiting for event pushes
let lastEventTime = 0;

export function safePushEvent(event: { user_id: string, type: string, payload: any }) {
  const now = Date.now();
  if (now - lastEventTime < 200) return;
  lastEventTime = now;
  pushEvent(event);
}
import { supabase } from "./supabase";
import { getDeviceId } from "./device";

// Get deviceId once per session
const deviceId = getDeviceId();

// Push an event to Supabase
export async function pushEvent({ user_id, type, payload }: { user_id: string, type: string, payload: any }) {
  await supabase.from("events").insert({
    user_id,
    device_id: deviceId,
    type,
    payload
  });
}

// Listen for real-time events from Supabase
export function listenForEvents(user_id: string, handleIncomingEvent: (event: any) => void) {
  return supabase
    .channel("raizen-events")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "events" },
      (payload) => {
        const event = payload.new;
        // Ignore events from this device
        if (event.device_id === deviceId) return;
        // Optionally, filter by user_id
        if (event.user_id !== user_id) return;
        handleIncomingEvent(event);
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("⚡ Raizen Sync Connected");
      }
      if (status === "CLOSED") {
        console.log("⚠️ Reconnecting...");
        // Optionally, implement auto-reconnect logic here
      }
    });
}
