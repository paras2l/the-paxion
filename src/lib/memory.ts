// ── CONTROL PANEL: RESET, CLEAR, STOP ──
/**
 * Reset all Raizen memory (local and optionally cloud)
 */
export async function resetRaizenMemory(clearCloud: boolean = false) {
  localStorage.removeItem('raizen_memory');
  localStorage.removeItem('raizen-workspace-state');
  localStorage.removeItem('raizen-library-state');
  // Optionally clear cloud memory
  if (clearCloud) {
    const user = await getUser();
    if (user) {
      await supabase.from('memory').delete().eq('user_id', user.id);
      await supabase.from('patterns').delete().eq('user_id', user.id);
      await supabase.from('state_snapshot').delete().eq('user_id', user.id);
    }
  }
}

/**
 * Clear all learned patterns (local and optionally cloud)
 */
export async function clearRaizenPatterns(clearCloud: boolean = false) {
  localStorage.removeItem('raizen_patterns');
  if (clearCloud) {
    const user = await getUser();
    if (user) {
      await supabase.from('patterns').delete().eq('user_id', user.id);
    }
  }
}

/**
 * Stop all running tasks (workspace, swarms, etc.)
 */
export function stopAllRaizenTasks() {
  // Clear workspace plan and goal
  localStorage.removeItem('raizen-workspace-state');
  // Optionally, send stop to swarms if API available
  if (window.raizen?.swarm?.stopAll) {
    window.raizen.swarm.stopAll();
  }
}

/**
 * Disable auto mode (set to manual)
 */
export function disableAutoMode() {
  setSystemMode('manual');
  localStorage.setItem('raizen-auto-mode', 'false');
}
// SYSTEM MODES (manual, assist, auto)
export type Mode = "manual" | "assist" | "auto";
let systemMode: Mode = "manual";

export function setSystemMode(mode: Mode) {
  systemMode = mode;
}
export function getSystemMode(): Mode {
  return systemMode;
}

// Example: handle input by mode
export function handleInputByMode(input: string, plan: string[], execute: (x: string | string[]) => void, showSuggestion: (x: string | string[]) => void) {
  if (systemMode === "manual") {
    execute(input);
  } else if (systemMode === "assist") {
    showSuggestion(plan);
  } else if (systemMode === "auto") {
    execute(plan);
  }
}
// Device awareness utility
export function getDeviceType(): "mobile" | "desktop" | "unknown" {
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua)) {
    return "mobile";
  }
  if (/Windows|Macintosh|Linux|X11/i.test(ua)) {
    return "desktop";
  }
  return "unknown";
}

// Example: device-aware execution
export function runDeviceAwareTask(task: () => void, heavyTask: () => void) {
  const device = getDeviceType();
  if (device === "mobile") {
    // Limit heavy tasks on mobile
    task();
  } else if (device === "desktop") {
    // Run full execution on desktop
    heavyTask();
  } else {
    // Fallback: run normal task
    task();
  }
}
// Save global state snapshot to Supabase
export async function saveGlobalStateSnapshot(globalState: {
  activeTask?: any;
  currentContext?: any;
  lastAction?: any;
  mode?: string;
}) {
  const user = await getUser();
  if (!user) return;
  await supabase.from("state_snapshot").upsert({
    user_id: user.id,
    state: globalState,
  });
}
// Save pattern to Supabase (cloud/global)
export async function savePatternCloud(pattern: string, confidence: number) {
  const user = await getUser();
  if (!user) return;
  await supabase.from("patterns").upsert({
    user_id: user.id,
    pattern,
    confidence,
  });
}
// STEP 3 — REAL-TIME MEMORY SYNC
let memoryChannel: any = null;

// Optionally inject these from your app context
let externalPlanTask: ((input: string) => string[]) | null = null;
let externalExecuteTask: ((plan: string[]) => void) | null = null;

export function setTaskHandlers(planTaskFn: (input: string) => string[], executeTaskFn: (plan: string[]) => void) {
  externalPlanTask = planTaskFn;
  externalExecuteTask = executeTaskFn;
}

export function startMemorySync() {
  if (memoryChannel) return; // Prevent duplicate subscriptions
  memoryChannel = supabase
    .channel("memory-sync")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "memory" },
      (payload: any) => {
        if (payload?.new) handleMemoryEvent(payload.new);
      }
    )
    .subscribe();
}

// Handle incoming memory event (including task events)
function handleMemoryEvent(memory: any) {
  const existing = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  // Avoid duplicates by timestamp+type+input/output
  const isDuplicate = existing.some((m: any) =>
    m.timestamp === memory.timestamp &&
    m.type === memory.type &&
    (m.input === memory.input || m.output === memory.output)
  );
  if (!isDuplicate) {
    existing.push(memory);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(existing));
  }
  // Cross-device task continuation
  switch (memory.type) {
    case "task.started":
      if (externalPlanTask && externalExecuteTask && memory.input) {
        const plan = externalPlanTask(memory.input);
        externalExecuteTask(plan);
      }
      break;
    case "task.progress":
      // Optionally handle progress updates
      break;
    case "task.completed":
      // Optionally handle completion
      break;
    default:
      // Other event types
      break;
  }
}
// STEP 2 — LOAD SHARED MEMORY
import { supabase, getUser } from "./supabase";

// Load shared memory from Supabase and sync to localStorage
export async function loadMemory() {
  const user = await getUser();
  if (!user) return;
  const { data, error } = await supabase
    .from("memory")
    .select("*")
    .eq("user_id", user.id)
    .order("timestamp", { ascending: true });
  if (error) {
    console.error("Failed to load shared memory:", error);
    return;
  }
  // If data is null, fallback to empty array
  localStorage.setItem("raizen_memory", JSON.stringify(data || []));
}
// PHASE 7 — LEARNING LOOP
// Every execution improves the system
import { supabase, getUser } from "./supabase";

// Save memory to Supabase (cloud)
export async function saveMemoryCloud(memory: Memory) {
  const user = await getUser();
  if (!user) return;
  await supabase.from("memory").insert({
    user_id: user.id,
    type: memory.type,
    content: memory,
    timestamp: memory.timestamp,
  });
}

// Hybrid: save to local and cloud
export function saveMemory(memory: Memory) {
  const existing = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  existing.push(memory);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(existing));
  // Fire and forget cloud save
  saveMemoryCloud(memory);
}

export function learn(input: string, result: string) {
  saveMemory({ type: "command", input, timestamp: Date.now() });
  saveMemory({ type: "result", output: result, timestamp: Date.now() });
}
// PHASE 5 — TASK PLANNER
// Break down big input into actionable steps
export function planTask(input: string): string[] {
  const lower = input.toLowerCase();
  if (lower.includes("exam")) {
    return [
      "collect notes",
      "summarize topics",
      "create schedule",
      "start study session"
    ];
  }
  // Add more patterns as needed
  return [input];
}
// PHASE 4 — SUGGESTION ENGINE
// Suggest next action based on learned patterns
export function suggestNextAction(): string | null {
  const memory = getMemory();
  const patterns = detectPatterns(memory);
  // Example: suggest if "study" is a frequent pattern
  if (patterns.some(cmd => cmd.toLowerCase().includes("study"))) {
    return "⚡ You usually study now. Start session?";
  }
  // Add more pattern-based suggestions as needed
  return null;
}
// PHASE 3 — PATTERN DETECTION
// Detect repeated command patterns
export function detectPatterns(memory: Memory[]): string[] {
  const commands = memory
    .filter(m => m.type === "command")
    .map(m => m.input);

  const counts: Record<string, number> = {};
  commands.forEach(cmd => {
    counts[cmd] = (counts[cmd] || 0) + 1;
  });

  return Object.entries(counts)
    .filter(([_, count]) => count > 3)
    .map(([cmd]) => cmd);
}
// PHASE 2 — CONTEXT ENGINE
// Build context before executing any command
export function getContext(input: string) {
  // Always uses the latest shared memory (synced to localStorage by real-time sync)
  const memory = JSON.parse(localStorage.getItem("raizen_memory") || "[]");
  return {
    input,
    recent: memory.slice(-20),
  };
}
// Task engine: break down high-level commands into subtasks
export function taskEngine(command: string): string[] {
  const c = command.toLowerCase().trim();
  // Simple pattern-based breakdowns
  if (c.includes('exam') || c.includes('test')) {
    return ['collect notes', 'summarize', 'create plan', 'schedule'];
  }
  if (c.includes('project')) {
    return ['define requirements', 'research', 'draft', 'review', 'submit'];
  }
  if (c.includes('meeting')) {
    return ['set agenda', 'invite participants', 'prepare materials', 'take notes', 'follow up'];
  }
  if (c.includes('study')) {
    return ['gather materials', 'review', 'practice', 'test yourself'];
  }
  // Fallback: split by verbs or suggest generic steps
  if (c.startsWith('prepare')) {
    return ['gather resources', 'plan steps', 'execute', 'review'];
  }
  // Default: just return the command as a single task
  return [command];
}
// Auto-suggest system: suggests actions based on memory/behavior patterns
export function autoSuggest(now: Date = new Date()): string | null {
  const memory = getMemory();
  // Find recent behaviors and commands
  const behaviors = memory.filter(m => m.type === 'behavior');
  const commands = memory.filter(m => m.type === 'command');
  // Example: detect repeated time-based patterns (e.g., "study" at 9PM)
  const hour = now.getHours();
  // Find most common behavior in the last 7 days at this hour
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = behaviors.filter(b => b.timestamp > weekAgo);
  const byHour = recent.filter(b => {
    const d = new Date(b.timestamp);
    return d.getHours() === hour;
  });
  if (byHour.length > 0) {
    // Find most common behavior
    const freq: Record<string, number> = {};
    byHour.forEach(b => {
      const key = typeof b.data === 'string' ? b.data : JSON.stringify(b.data);
      freq[key] = (freq[key] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 2) {
      // Suggest if pattern is strong enough
      const suggestion = sorted[0][0];
      // Example: "You usually study at 9PM. Start now?"
      return `You usually ${suggestion} at ${hour}:00. Start now?`;
    }
  }
  // Could add more advanced pattern mining here
  return null;
}
// PHASE 1 — MEMORY SYSTEM (FOUNDATION)
// Only three types: command, result, pattern
export type Memory =
  | { type: "command"; input: string; timestamp: number }
  | { type: "result"; output: string; timestamp: number }
  | { type: "pattern"; pattern: string; confidence: number };

const MEMORY_KEY = "raizen_memory";

// Save memory on every action
export function saveMemory(memory: Memory) {
  const existing = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  existing.push(memory);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(existing));
}

// Get all memory
export function getMemory(): Memory[] {
  return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
}
