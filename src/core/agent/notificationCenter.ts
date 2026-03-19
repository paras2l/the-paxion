export type NotificationChannel = 'in-app' | 'email' | 'sms' | 'push'

export type NotificationItem = {
  id: string
  title: string
  body: string
  channel: NotificationChannel
  createdAt: string
  read: boolean
}

export type NotificationPreferences = {
  email: boolean
  sms: boolean
  push: boolean
}

export const defaultNotificationPreferences: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createNotification(
  title: string,
  body: string,
  channel: NotificationChannel = 'in-app',
): NotificationItem {
  return {
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    channel,
    createdAt: nowIso(),
    read: false,
  }
}

export function markNotificationRead(
  items: NotificationItem[],
  notificationId: string,
): NotificationItem[] {
  return items.map((item) =>
    item.id === notificationId
      ? {
          ...item,
          read: true,
        }
      : item,
  )
}
