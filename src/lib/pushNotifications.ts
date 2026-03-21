// src/lib/pushNotifications.ts
// This is a basic browser push notification utility. For production, use a service like Firebase Cloud Messaging for mobile.

export function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission();
  }
}

export function showNotification(title: string, options?: NotificationOptions) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, options);
  }
}

// Example: Call this when a new important event arrives
export function notifyOnEvent(event: { type: string; payload: any }) {
  // Customize logic for which events trigger notifications
  if (event.type === "command.run" || event.type === "state.update") {
    showNotification("Raizen Update", {
      body: `Event: ${event.type}`,
      icon: "/icon.png"
    });
  }
}
