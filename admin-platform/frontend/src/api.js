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

export async function fetchLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.deviceId) query.set('device_id', params.deviceId);
  if (params.legacyId) query.set('legacy_id', params.legacyId);
  if (params.level) query.set('level', params.level);
  if (params.category) query.set('category', params.category);
  if (params.hours) query.set('hours', params.hours);
  if (params.limit) query.set('limit', params.limit);

  const res = await fetch(`${API_URL}/logs?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function fetchDeviceLogs(deviceId, limit = 50) {
  const res = await fetch(`${API_URL}/logs/device/${deviceId}?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch device logs');
  return res.json();
}

export async function setFullyPassword(deviceId, password) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/fully-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Failed to set Fully password');
  return res.json();
}

// ============================================================================
// Customer Device Assignment API (IOCast Platform)
// ============================================================================

export async function fetchCustomerDevices(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/devices`);
  if (!res.ok) throw new Error('Failed to fetch customer devices');
  return res.json();
}

export async function assignDeviceToCustomer(customerId, deviceId, screenUuid = null) {
  const res = await fetch(`${API_URL}/customers/${customerId}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, screen_uuid: screenUuid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to assign device');
  }
  return res.json();
}

export async function updateDeviceAssignment(customerId, deviceId, screenUuid) {
  const res = await fetch(`${API_URL}/customers/${customerId}/devices/${deviceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, screen_uuid: screenUuid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update device assignment');
  }
  return res.json();
}

export async function removeDeviceFromCustomer(customerId, deviceId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/devices/${deviceId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove device');
  return res.json();
}

export async function fetchUnassignedDevices() {
  const res = await fetch(`${API_URL}/customers/unassigned-devices`);
  if (!res.ok) throw new Error('Failed to fetch unassigned devices');
  return res.json();
}

export async function deleteCustomer(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete customer');
  return res.json();
}

// ============================================================================
// Screen Assignment API (IOCast Platform - Fase 3)
// ============================================================================

export async function fetchDeviceScreen(deviceId) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/screen`);
  if (!res.ok) throw new Error('Failed to fetch device screen');
  return res.json();
}

export async function setDeviceScreen(deviceId, screenUuid) {
  const res = await fetch(`${API_URL}/devices/${deviceId}/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screen_uuid: screenUuid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to set device screen');
  }
  return res.json();
}

export async function fetchCustomerScreens(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/screens`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch screens');
  }
  return res.json();
}

export async function fetchCustomerCmsInfo(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/info`);
  if (!res.ok) throw new Error('Failed to fetch CMS info');
  return res.json();
}

// ============================================================================
// CMS Provisioning API (IOCast Platform - Fase 4)
// ============================================================================

export async function provisionCustomerCms(customerId, subdomain, displayName = null) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subdomain,
      display_name: displayName,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to provision CMS');
  }
  return res.json();
}

export async function fetchCmsStatus(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/status`);
  if (!res.ok) throw new Error('Failed to fetch CMS status');
  return res.json();
}

export async function fetchCmsCredentials(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/credentials`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch CMS credentials');
  }
  return res.json();
}

export async function stopCustomerCms(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to stop CMS');
  }
  return res.json();
}

export async function startCustomerCms(customerId) {
  const res = await fetch(`${API_URL}/customers/${customerId}/cms/start`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start CMS');
  }
  return res.json();
}

export async function fetchNextCmsPorts() {
  const res = await fetch(`${API_URL}/customers/cms/next-ports`);
  if (!res.ok) throw new Error('Failed to fetch next CMS ports');
  return res.json();
}

// ============================================================================
// Customer Provisioning Codes API (IOCast Device Provisioning)
// ============================================================================

export async function fetchCustomerCodes(customerId = null) {
  const url = customerId
    ? `${API_URL}/customer-codes?customer_id=${customerId}`
    : `${API_URL}/customer-codes`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch customer codes');
  return res.json();
}

export async function fetchCustomerCodeById(codeId) {
  const res = await fetch(`${API_URL}/customer-codes/${codeId}`);
  if (!res.ok) throw new Error('Failed to fetch customer code');
  return res.json();
}

export async function fetchCustomerCodeByCode(code) {
  const res = await fetch(`${API_URL}/customer-codes/by-code/${code}`);
  if (!res.ok) throw new Error('Failed to fetch customer code');
  return res.json();
}

export async function createCustomerCode(payload) {
  const res = await fetch(`${API_URL}/customer-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create customer code');
  }
  return res.json();
}

export async function updateCustomerCode(codeId, payload) {
  const res = await fetch(`${API_URL}/customer-codes/${codeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update customer code');
  }
  return res.json();
}

export async function deleteCustomerCode(codeId) {
  const res = await fetch(`${API_URL}/customer-codes/${codeId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete customer code');
  return res.json();
}
