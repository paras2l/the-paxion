import { pushEvent as pushEventOnline } from "./sync";

const LOCAL_EVENTS_KEY = "raizen_unsynced_events";
const EVENT_VERSION = 1;

// Utility: Encrypt (stub)
function encryptEvent(event: any): string {
  // TODO: Replace with real encryption
  return btoa(JSON.stringify(event));
}

// Utility: Decrypt (stub)
function decryptEvent(data: string): any {
  // TODO: Replace with real decryption
  return JSON.parse(atob(data));
}

// Utility: Compress (stub)
function compressEvent(event: any): string {
  // TODO: Replace with real compression
  return JSON.stringify(event);
}

// Utility: Decompress (stub)
function decompressEvent(data: string): any {
  // TODO: Replace with real decompression
  return JSON.parse(data);
}

// Store event locally (encrypted, compressed, versioned)
function saveEventLocally(event: any) {
  const events = getLocalEvents();
  const versioned = {
    v: EVENT_VERSION,
    data: compressEvent(encryptEvent(event))
  };
  events.push(versioned);
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
}

function getLocalEvents(): any[] {
  const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Push event with offline, encryption, compression, batching, versioning
export async function pushEventWithAdvancedOfflineSupport(event: any) {
  if (navigator.onLine) {
    try {
      await pushEventOnline(event);
    } catch (e) {
      saveEventLocally(event);
    }
  } else {
    saveEventLocally(event);
  }
}

// Sync all local events in batch
export async function syncLocalEventsAdvanced() {
  if (!navigator.onLine) return;
  const events = getLocalEvents();
  if (events.length === 0) return;
  // Decrypt, decompress, and batch send
  const batch = events.map(e => decompressEvent(decryptEvent(e.data)));
  try {
    // Batch insert (if supported by backend)
    await pushEventOnline(batch);
    localStorage.removeItem(LOCAL_EVENTS_KEY);
  } catch (e) {
    // If push fails, stop and try again later
    return;
  }
}

window.addEventListener("online", syncLocalEventsAdvanced);
