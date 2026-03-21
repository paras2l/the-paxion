import { supabase } from "./supabase";
import { handleIncomingEvent } from "./eventHandler";

// Initial sync: fetch all events for user and replay them
export async function initialSync(user_id: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Initial sync error:", error);
    return;
  }

  if (data) {
    data.forEach(handleIncomingEvent);
  }
}
