import { pushEvent as pushEventOnline } from "./sync";

const LOCAL_EVENTS_KEY = "raizen_unsynced_events";

// Store event locally if offline, else push to Supabase
export async function pushEventWithOfflineSupport(event: any) {
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

function saveEventLocally(event: any) {
  const events = getLocalEvents();
  events.push(event);
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
}

function getLocalEvents(): any[] {
  const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function syncLocalEvents() {
  if (!navigator.onLine) return;
  const events = getLocalEvents();
  if (events.length === 0) return;
  for (const event of events) {
    try {
      await pushEventOnline(event);
    } catch (e) {
      // If push fails, stop and try again later
      return;
    }
  }
  localStorage.removeItem(LOCAL_EVENTS_KEY);
}

// Listen for online event to trigger sync
window.addEventListener("online", syncLocalEvents);
