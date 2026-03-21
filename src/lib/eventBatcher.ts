import { supabase } from "./supabase";

let eventQueue: any[] = [];

export function queueEvent(event: any) {
  eventQueue.push(event);
}

setInterval(async () => {
  if (eventQueue.length === 0) return;
  try {
    await supabase.from("events").insert(eventQueue);
    eventQueue = [];
  } catch (e) {
    // Optionally handle error (e.g., retry logic)
    console.error("Batch event insert failed:", e);
  }
}, 1000);
