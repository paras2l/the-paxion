export type EncryptionStatus = {
  transit: 'enabled' | 'disabled'
  atRest: 'enabled' | 'disabled'
  keyFingerprint: string
  lastRotatedAt: string
}

export function deriveEncryptionStatus(): EncryptionStatus {
  return {
    transit: 'enabled',
    atRest: 'enabled',
    keyFingerprint: 'enc-fp-9f3a-2d71-44b1',
    lastRotatedAt: new Date().toISOString(),
  }
}
