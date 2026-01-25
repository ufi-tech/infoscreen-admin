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

export async function fetchLegacyDevices(limit = 200) {
  const res = await fetch(`${API_URL}/legacy/devices?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch legacy devices');
  return res.json();
}

export async function updateLegacyDevice(identifier, payload = {}) {
  const res = await fetch(`${API_URL}/legacy/devices/${identifier}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update legacy device');
  return res.json();
}

export async function fetchLocations() {
  const res = await fetch(`${API_URL}/locations`);
  if (!res.ok) throw new Error('Failed to fetch locations');
  return res.json();
}

export async function upsertLocation(payload = {}) {
  const res = await fetch(`${API_URL}/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update location');
  return res.json();
}

export async function fetchCustomers() {
  const res = await fetch(`${API_URL}/customers`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createCustomer(payload = {}) {
  const res = await fetch(`${API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create customer');
  return res.json();
}

export async function updateCustomer(customerId, payload = {}) {
  const res = await fetch(`${API_URL}/customers/${customerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update customer');
  return res.json();
}

export async function fetchAssignments() {
  const res = await fetch(`${API_URL}/assignments`);
  if (!res.ok) throw new Error('Failed to fetch assignments');
  return res.json();
}

export async function upsertAssignment(payload = {}) {
  const res = await fetch(`${API_URL}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update assignment');
  return res.json();
}

export async function fetchTunnelConfigs() {
  const res = await fetch(`${API_URL}/tunnel-configs`);
  if (!res.ok) throw new Error('Failed to fetch tunnel configs');
  return res.json();
}

export async function saveTunnelConfig(deviceId, payload = {}) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/tunnel-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save tunnel config');
  return res.json();
}

export async function allocateTunnelPorts(deviceId, payload = {}) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/tunnel-ports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to allocate tunnel ports');
  return res.json();
}
