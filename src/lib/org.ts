// src/lib/org.ts
// Multi-user / Org support utilities

export interface Org {
  id: string;
  name: string;
  members: string[]; // user IDs
}

// Add org_id to events, snapshots, etc.
export interface OrgEvent {
  id: string;
  org_id: string;
  user_id: string;
  device_id: string;
  type: string;
  payload: any;
  created_at?: string;
  expires_at?: string;
}

// Example: filter events by org_id
import { supabase } from "./supabase";

export async function fetchOrgEvents(orgId: string, userId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) {
    console.error("Org event fetch error:", error);
    return [];
  }
  return data || [];
}

// Add org_id to event creation, snapshot, etc. as needed in your flows.
