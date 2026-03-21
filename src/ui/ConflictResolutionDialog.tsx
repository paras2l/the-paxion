import React, { useState } from "react";

export interface ConflictData<T> {
  local: T;
  remote: T;
  onResolve: (resolved: T) => void;
}

export function ConflictResolutionDialog<T extends object>({ local, remote, onResolve }: ConflictData<T>) {
  const [selected, setSelected] = useState<"local" | "remote" | "merge">("local");
  const [merged, setMerged] = useState<T>({ ...local });

  function handleMergeChange(field: keyof T, value: any) {
    setMerged({ ...merged, [field]: value });
  }

  return (
    <div className="conflict-dialog">
      <h2>Conflict Detected</h2>
      <div>
        <label>
          <input
            type="radio"
            checked={selected === "local"}
            onChange={() => setSelected("local")}
          />
          Keep Local Version
        </label>
        <pre>{JSON.stringify(local, null, 2)}</pre>
      </div>
      <div>
        <label>
          <input
            type="radio"
            checked={selected === "remote"}
            onChange={() => setSelected("remote")}
          />
          Keep Remote Version
        </label>
        <pre>{JSON.stringify(remote, null, 2)}</pre>
      </div>
      <div>
        <label>
          <input
            type="radio"
            checked={selected === "merge"}
            onChange={() => setSelected("merge")}
          />
          Merge Fields
        </label>
        {selected === "merge" && (
          <div>
            {Object.keys(local).map((key) => (
              <div key={key}>
                <label>{key}:</label>
                <input
                  value={(merged as any)[key] ?? ""}
                  onChange={(e) => handleMergeChange(key as keyof T, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          if (selected === "local") onResolve(local);
          else if (selected === "remote") onResolve(remote);
          else onResolve(merged);
        }}
      >
        Resolve
      </button>
    </div>
  );
}
