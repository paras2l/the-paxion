export type BackupSnapshot = {
  id: string
  createdAt: string
  payload: Record<string, unknown>
}

export function createBackupSnapshot(payload: Record<string, unknown>): BackupSnapshot {
  return {
    id: `backup-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    payload,
  }
}

export function restoreBackupSnapshot(snapshot: BackupSnapshot): Record<string, unknown> {
  return snapshot.payload
}
