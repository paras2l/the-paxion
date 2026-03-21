// src/lib/analytics.ts
// Simple analytics event logger (expand as needed)

import { logMessage } from "./monitoring";
import { supabase } from "./supabase";

export async function logAnalyticsEvent(event: string, details?: any) {
  // Send to Sentry
  logMessage(`[Analytics] ${event}`, details);
  // Optionally, send to Supabase analytics table
  try {
    await supabase.from("analytics").insert({
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // Ignore analytics errors
  }
}
}
