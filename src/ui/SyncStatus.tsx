import React, { useEffect, useState } from "react";

export function SyncStatus({ isOnline, lastSync }: { isOnline: boolean; lastSync: Date | null }) {
  return (
    <div style={{ padding: 8, background: isOnline ? "#e0ffe0" : "#ffe0e0", color: isOnline ? "#0a0" : "#a00", borderRadius: 4, fontSize: 14 }}>
      <strong>{isOnline ? "🟢 Online" : "🔴 Offline"}</strong>
      <span style={{ marginLeft: 12 }}>
        Last Sync: {lastSync ? lastSync.toLocaleTimeString() : "Never"}
      </span>
    </div>
  );
}
