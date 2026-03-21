import { supabase } from "./supabase";

// Fetch only new events after the last snapshot
export async function fetchEventsAfterSnapshot(userId: string, lastSnapshotTime: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gt("created_at", lastSnapshotTime)
    .eq("user_id", userId);
  if (error) {
    console.error("Partial sync error:", error);
    return [];
  }
  return data || [];
}
