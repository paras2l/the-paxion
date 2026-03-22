import { supabase, getUser } from "./supabase";

// ── TYPES ──

export type Memory =
  | { type: "command"; input: string; timestamp: number }
  | { type: "result"; output: string; timestamp: number }
  | { type: "pattern"; pattern: string; confidence: number; timestamp: number }
  | { type: "behavior"; data: any; timestamp: number }
  | { type: "task.started"; input?: string; timestamp: number }
  | { type: "task.progress"; timestamp: number }
  | { type: "task.completed"; timestamp: number };

export type Mode = "manual" | "assist" | "auto";

// ── CONSTANTS & STATE ──

const MEMORY_KEY = "raizen_memory";
let systemMode: Mode = "manual";
let memoryChannel: any = null;

// Task handlers (optionally injected from app context)
let externalPlanTask: ((input: string) => string[]) | null = null;
let externalExecuteTask: ((plan: string[]) => void) | null = null;

// ── SETTERS & GETTERS ──

export function setSystemMode(mode: Mode) {
  systemMode = mode;
}

export function getSystemMode(): Mode {
  return systemMode;
}

export function setTaskHandlers(planTaskFn: (input: string) => string[], executeTaskFn: (plan: string[]) => void) {
  externalPlanTask = planTaskFn;
  externalExecuteTask = executeTaskFn;
}

// ── CONTROL PANEL ──

/**
 * Reset all Raizen memory (local and optionally cloud)
 */
export async function resetRaizenMemory(clearCloud: boolean = false) {
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem('raizen-workspace-state');
  localStorage.removeItem('raizen-library-state');
  
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
 * Stop all running tasks
 */
export function stopAllRaizenTasks() {
  localStorage.removeItem('raizen-workspace-state');
  if (window.raizen?.swarm?.stopAll) {
    window.raizen.swarm.stopAll();
  }
}

export function disableAutoMode() {
  setSystemMode('manual');
  localStorage.setItem('raizen-auto-mode', 'false');
}

// ── CORE MEMORY OPERATIONS ──

export function getMemory(): Memory[] {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  } catch (e) {
    console.error("Failed to parse memory from localStorage", e);
    return [];
  }
}

/**
 * Save memory to Supabase (cloud)
 */
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

/**
 * Hybrid: save to local and cloud
 */
export function saveMemory(memory: Memory) {
  const existing = getMemory();
  existing.push(memory);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(existing));
  
  // Fire and forget cloud save
  saveMemoryCloud(memory);
}

/**
 * Load shared memory from Supabase and sync to localStorage
 */
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
  
  localStorage.setItem(MEMORY_KEY, JSON.stringify(data || []));
}

// ── SYNC & EVENT HANDLING ──

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

function handleMemoryEvent(memory: any) {
  const existing = getMemory();
  
  // Avoid duplicates by timestamp+type+input/output
  const isDuplicate = existing.some((m: any) =>
    m.timestamp === memory.timestamp &&
    m.type === memory.type &&
    ((m.input && m.input === memory.input) || (m.output && m.output === memory.output))
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
  }
}

// ── ANALYSIS & SUGGESTIONS ──

export function learn(input: string, result: string) {
  saveMemory({ type: "command", input, timestamp: Date.now() });
  saveMemory({ type: "result", output: result, timestamp: Date.now() });
}

export function detectPatterns(memory: Memory[]): string[] {
  const commands = memory
    .filter(m => m.type === "command")
    .map(m => (m as any).input);

  const counts: Record<string, number> = {};
  commands.forEach(cmd => {
    counts[cmd] = (counts[cmd] || 0) + 1;
  });

  return Object.entries(counts)
    .filter(([_, count]) => count > 3)
    .map(([cmd]) => cmd);
}

export function suggestNextAction(): string | null {
  const memory = getMemory();
  const patterns = detectPatterns(memory);
  if (patterns.some(cmd => cmd.toLowerCase().includes("study"))) {
    return "⚡ You usually study now. Start session?";
  }
  return null;
}

export function autoSuggest(now: Date = new Date()): string | null {
  const memory = getMemory();
  const behaviors = memory.filter((m): m is Memory & { type: 'behavior' } => m.type === 'behavior');
  const hour = now.getHours();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  
  const byHour = behaviors.filter(b => {
    return b.timestamp > weekAgo && new Date(b.timestamp).getHours() === hour;
  });
  
  if (byHour.length > 0) {
    const freq: Record<string, number> = {};
    byHour.forEach(b => {
      const key = typeof (b as any).data === 'string' ? (b as any).data : JSON.stringify((b as any).data);
      freq[key] = (freq[key] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 2) {
      return `You usually ${sorted[0][0]} at ${hour}:00. Start now?`;
    }
  }
  return null;
}

// ── UTILITIES ──

export function getDeviceType(): "mobile" | "desktop" | "unknown" {
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua)) return "mobile";
  if (/Windows|Macintosh|Linux|X11/i.test(ua)) return "desktop";
  return "unknown";
}

export function getContext(input: string) {
  const memory = getMemory();
  return {
    input,
    recent: memory.slice(-20),
  };
}

export function planTask(input: string): string[] {
  const lower = input.toLowerCase();
  if (lower.includes("exam")) {
    return ["collect notes", "summarize topics", "create schedule", "start study session"];
  }
  return [input];
}

export function taskEngine(command: string): string[] {
  const c = command.toLowerCase().trim();
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
  if (c.startsWith('prepare')) {
    return ['gather resources', 'plan steps', 'execute', 'review'];
  }
  return [command];
}

// ── QUERY & RECENT MEMORY ──

export function getRecentMemory(limit: number = 10): any[] {
  const memory = getMemory();
  return memory.slice(-limit).map(m => ({
    ...m,
    data: m.type === "command" ? (m as any).input : m.type === "result" ? (m as any).output : (m as any).data || m
  })).reverse();
}

export function queryMemory(options: { query: string; maxResults?: number; fuzzy?: boolean }): any[] {
  const { query, maxResults = 10 } = options;
  const memory = getMemory();
  const lowerQuery = query.toLowerCase();
  const results = memory.filter(m => {
    const text = JSON.stringify(m);
    return text.toLowerCase().includes(lowerQuery);
  });
  return results.slice(-maxResults).map(m => ({
    ...m,
    data: m.type === "command" ? (m as any).input : m.type === "result" ? (m as any).output : (m as any).data || m
  })).reverse();
}

// ── CLOUD SNAPSHOTS ──

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

export async function savePatternCloud(pattern: string, confidence: number) {
  const user = await getUser();
  if (!user) return;
  await supabase.from("patterns").upsert({
    user_id: user.id,
    pattern,
    confidence,
  });
}

// ── UI HELPERS ──

export function handleInputByMode(input: string, plan: string[], execute: (x: string | string[]) => void, showSuggestion: (x: string | string[]) => void) {
  if (systemMode === "manual") {
    execute(input);
  } else if (systemMode === "assist") {
    showSuggestion(plan);
  } else if (systemMode === "auto") {
    execute(plan);
  }
}

export function runDeviceAwareTask(task: () => void, heavyTask: () => void) {
  const device = getDeviceType();
  if (device === "mobile") {
    task();
  } else if (device === "desktop") {
    heavyTask();
  } else {
    task();
  }
}
