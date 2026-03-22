// import React from "react";

export function SyncActivityFeed({ events }: { events: Array<{ type: string; timestamp: string; details?: string }> }) {
  return (
    <div style={{ maxHeight: 200, overflowY: "auto", background: "#f8f8f8", borderRadius: 4, padding: 8, fontSize: 13 }}>
      <strong>Sync Activity</strong>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {events.map((e, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <span style={{ color: "#888" }}>{new Date(e.timestamp).toLocaleTimeString()}:</span>
            <span style={{ marginLeft: 8 }}>{e.type}</span>
            {e.details && <span style={{ marginLeft: 8, color: "#555" }}>{e.details}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
