import { supabase } from "./supabase";

// Mark event as processed
export async function acknowledgeEvent(eventId: string) {
  await supabase
    .from("events")
    .update({ status: "done" })
    .eq("id", eventId);
}

// Retry all failed/pending events
export async function retryPendingEvents(processEvent: (event: any) => Promise<void>) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "pending");
  if (error) {
    console.error("Failed to fetch pending events:", error);
    return;
  }
  if (data) {
    for (const event of data) {
      try {
        await processEvent(event);
        await acknowledgeEvent(event.id);
      } catch (e) {
        // Optionally log or handle retry failure
        console.error("Failed to process event:", event, e);
      }
    }
  }
}
