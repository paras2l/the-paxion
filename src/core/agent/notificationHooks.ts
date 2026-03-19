import type { TaskExecutionResult } from './actionAdapters'
import { createNotification, type NotificationItem } from './notificationCenter'

export function notificationsFromExecution(results: TaskExecutionResult[]): NotificationItem[] {
  const notifications: NotificationItem[] = []

  results.forEach((result) => {
    if (result.status === 'executed') {
      notifications.push(
        createNotification('Task executed', `${result.actionId} completed successfully.`, 'in-app'),
      )
    }

    if (result.status === 'queued') {
      notifications.push(
        createNotification('Task queued', `${result.actionId} queued successfully.`, 'in-app'),
      )
    }

    if (result.status === 'failed') {
      notifications.push(
        createNotification('Task failed', `${result.actionId} failed: ${result.detail}`, 'in-app'),
      )
    }

    if (result.status === 'blocked-permission') {
      notifications.push(
        createNotification('Permission required', `${result.actionId} is waiting for permission.`, 'in-app'),
      )
    }

    if (result.status === 'blocked-integration') {
      notifications.push(
        createNotification('Integration required', `${result.actionId} needs an enabled integration.`, 'in-app'),
      )
    }
  })

  return notifications
}
