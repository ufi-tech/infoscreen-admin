// Utility functions for formatting values

export function firstIp(ipString) {
  if (!ipString) return '';
  return ipString.split(' ')[0];
}

export function normalizeStatus(status) {
  if (!status) return 'unknown';
  return String(status).toLowerCase();
}

export function formatLoad(load) {
  if (Array.isArray(load)) return load.join(' / ');
  if (typeof load === 'number') return load.toFixed(2);
  if (typeof load === 'string') return load;
  return '-';
}

export function formatTemp(value) {
  if (typeof value === 'number') return `${value.toFixed(1)}C`;
  if (typeof value === 'string') return value;
  return '-';
}

export function formatMemory(telemetry) {
  if (!telemetry?.mem_total_kb || !telemetry?.mem_available_kb) return '-';
  const used = 1 - telemetry.mem_available_kb / telemetry.mem_total_kb;
  return `${Math.round(used * 100)}%`;
}

export function formatUptime(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(' ');
}

export function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function latestEvent(events, type) {
  if (!Array.isArray(events)) return null;
  return events.find((event) => event.type === type) || null;
}

export function extractWifiNetworks(event) {
  const payload = event?.payload || {};
  const list = payload.networks || payload.results || payload.wifi || payload.ssids || payload.access_points;
  return Array.isArray(list) ? list : null;
}

export function formatWifiNetwork(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  const ssid = entry.ssid || entry.SSID || entry.name || entry.network || entry.bssid || entry.BSSID || 'unknown';
  const signal = entry.signal ?? entry.rssi ?? entry.quality ?? entry.level ?? null;
  const security = entry.security || entry.flags || entry.auth || entry.encryption || '';
  const parts = [ssid];
  if (signal !== null && signal !== undefined && signal !== '') parts.push(`signal ${signal}`);
  if (security) parts.push(security);
  return parts.join(' - ');
}

export function screenshotSource(event) {
  const payload = event?.payload || {};
  const raw = payload.image || payload.data || payload.base64;
  if (!raw || typeof raw !== 'string') return '';
  if (raw.startsWith('data:image')) return raw;
  return `data:image/png;base64,${raw}`;
}

export function screenshotLabel(event) {
  const payload = event?.payload || {};
  return payload.path || payload.file || payload.filename || '';
}

export function parseTunnelStatus(event) {
  const result = (event?.payload?.result || '').toString();
  if (!result) return 'unknown';
  if (/already running|started/i.test(result)) return 'active';
  if (/stopped|not running/i.test(result)) return 'inactive';
  return 'unknown';
}

export function legacyOnlineLabel(value) {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value) === '1' ? 'online' : 'offline';
}

export function locationKey(kind, id) {
  return `${kind}:${id}`;
}

export function assignmentKey(kind, id) {
  return `${kind}:${id}`;
}

export function mapLink(lat, lon) {
  if (lat === '' || lon === '' || lat === null || lon === null || lat === undefined || lon === undefined) {
    return '';
  }
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export function normalizeHost(value) {
  if (!value) return '';
  return value.replace(/^https?:\/\//, '').trim();
}

export function parsePort(value) {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function openExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
