const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchDevices() {
  const res = await fetch(`${API_URL}/devices`);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

export async function fetchTelemetry(deviceId, limit = 1) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/telemetry?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}

export async function fetchEvents(deviceId, limit = 5) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/events?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function sendCommand(deviceId, action, payload = {}) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error('Command failed');
  return res.json();
}

export async function approveDevice(deviceId) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true }),
  });
  if (!res.ok) throw new Error('Approve failed');
  return res.json();
}
