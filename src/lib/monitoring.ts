// src/lib/monitoring.ts
import * as Sentry from "@sentry/browser";

export function initMonitoring() {
  Sentry.init({
    dsn: "YOUR_SENTRY_DSN_HERE", // Replace with your Sentry DSN
    tracesSampleRate: 1.0,
    environment: import.meta.env.MODE || "development",
  });
}

export function logError(error: any, context?: any) {
  Sentry.captureException(error, { extra: context });
  // Also log to console for local debugging
  console.error("[Sentry]", error, context);
}

export function logMessage(message: string, context?: any) {
  Sentry.captureMessage(message, { extra: context });
  console.log("[Sentry]", message, context);
}
