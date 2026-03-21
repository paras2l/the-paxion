import { supabase } from "./supabase";

// Save a state snapshot for a user
export async function saveStateSnapshot(userId: string, fullAppState: any) {
  await supabase.from("state_snapshot").upsert({
    user_id: userId,
    state: fullAppState,
    updated_at: new Date().toISOString()
  });
}

// Load the latest state snapshot for a user
export async function loadStateSnapshot(userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("state_snapshot")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) {
    console.error("Snapshot load error:", error);
    return null;
  }
  return data ? data.state : null;
}
