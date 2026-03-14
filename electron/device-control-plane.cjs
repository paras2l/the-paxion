'use strict'

function normalizeDevice(input) {
  return {
    id: String(input?.id || '').trim(),
    name: String(input?.name || '').trim() || 'Unnamed Device',
    platform: String(input?.platform || '').trim() || 'unknown',
    publicKeyFingerprint: String(input?.publicKeyFingerprint || '').trim(),
    trusted: Boolean(input?.trusted),
    createdAt: String(input?.createdAt || new Date().toISOString()),
    revokedAt: input?.revokedAt ? String(input.revokedAt) : null,
  }
}

function upsertDevice(devices, input) {
  const next = Array.isArray(devices) ? [...devices] : []
  const device = normalizeDevice(input)
  if (!device.id) {
    return { ok: false, reason: 'Device ID is required.', devices: next }
  }

  const idx = next.findIndex((entry) => entry.id === device.id)
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      ...device,
      revokedAt: null,
      trusted: true,
    }
  } else {
    next.push({ ...device, trusted: true })
  }

  return { ok: true, device: next.find((entry) => entry.id === device.id), devices: next }
}

function revokeDevice(devices, deviceId) {
  const next = Array.isArray(devices) ? [...devices] : []
  const id = String(deviceId || '').trim()
  const idx = next.findIndex((entry) => entry.id === id)
  if (idx < 0) {
    return { ok: false, reason: 'Device not found.', devices: next }
  }

  next[idx] = {
    ...next[idx],
    trusted: false,
    revokedAt: new Date().toISOString(),
  }

  return { ok: true, device: next[idx], devices: next }
}

module.exports = {
  upsertDevice,
  revokeDevice,
}
