import React, { useEffect, useMemo, useState } from 'react';
import {
  approveDevice,
  fetchDevices,
  fetchEvents,
  fetchTelemetry,
  sendCommand,
} from './api.js';

function firstIp(ipString) {
  if (!ipString) return '';
  return ipString.split(' ')[0];
}

function normalizeStatus(status) {
  if (!status) return 'unknown';
  return String(status).toLowerCase();
}

function formatLoad(load) {
  if (Array.isArray(load)) return load.join(' / ');
  if (typeof load === 'number') return load.toFixed(2);
  if (typeof load === 'string') return load;
  return '-';
}

function formatTemp(value) {
  if (typeof value === 'number') return `${value.toFixed(1)}C`;
  if (typeof value === 'string') return value;
  return '-';
}

function formatMemory(telemetry) {
  if (!telemetry?.mem_total_kb || !telemetry?.mem_available_kb) return '-';
  const used = 1 - telemetry.mem_available_kb / telemetry.mem_total_kb;
  return `${Math.round(used * 100)}%`;
}

function formatUptime(value) {
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

function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function latestEvent(events, type) {
  if (!Array.isArray(events)) return null;
  return events.find((event) => event.type === type) || null;
}

function extractWifiNetworks(event) {
  const payload = event?.payload || {};
  const list = payload.networks || payload.results || payload.wifi || payload.ssids || payload.access_points;
  return Array.isArray(list) ? list : null;
}

function formatWifiNetwork(entry) {
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

function screenshotSource(event) {
  const payload = event?.payload || {};
  const raw = payload.image || payload.data || payload.base64;
  if (!raw || typeof raw !== 'string') return '';
  if (raw.startsWith('data:image')) return raw;
  return `data:image/png;base64,${raw}`;
}

function screenshotLabel(event) {
  const payload = event?.payload || {};
  return payload.path || payload.file || payload.filename || '';
}

export default function App() {
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [events, setEvents] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [urlDraft, setUrlDraft] = useState({});

  async function loadDevices() {
    try {
      setLoading(true);
      const data = await fetchDevices();
      setDevices(data);

      const telemPairs = await Promise.all(
        data.map(async (d) => {
          const t = await fetchTelemetry(d.id, 1).catch(() => []);
          return [d.id, t[0]?.payload || null];
        })
      );
      setTelemetry(Object.fromEntries(telemPairs));

      const eventPairs = await Promise.all(
        data.map(async (d) => {
          const e = await fetchEvents(d.id, 8).catch(() => []);
          return [d.id, e];
        })
      );
      setEvents(Object.fromEntries(eventPairs));

      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
    const id = setInterval(loadDevices, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleAction(deviceId, action, payload = {}) {
    try {
      await sendCommand(deviceId, action, payload);
    } catch (err) {
      setError(err.message || 'Command failed');
    }
  }

  async function handleConfirm(deviceId, action, message, payload = {}) {
    if (message && !window.confirm(message)) return;
    await handleAction(deviceId, action, payload);
  }

  async function handleApprove(deviceId) {
    try {
      await approveDevice(deviceId);
      await loadDevices();
    } catch (err) {
      setError(err.message || 'Approve failed');
    }
  }

  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const active = useMemo(() => {
    return devices.find((d) => d.id === expanded) || null;
  }, [devices, expanded]);

  return (
    <div className="page">
      <div className="hero">
        <div>
          <p className="eyebrow">Operations Console</p>
          <h1>Skamstrup Fleet Desk</h1>
          <p className="subtitle">
            Reboot, remote access, diagnostics, and live telemetry for every device.
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost" onClick={loadDevices}>Refresh</button>
          <div className="hint">Auto refresh: 5s</div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice info">Loading devices...</div>}

      <div className="grid">
        {devices.map((d, index) => {
          const t = telemetry[d.id] || {};
          const deviceEvents = events[d.id] || [];
          const statusClass = normalizeStatus(d.status);
          const ip = firstIp(d.ip || t.ip || t.ipv4 || t.ip4 || '');
          const ssid = t.ssid || t.wifi_ssid || t.network || t.ap || '-';
          const uptime = formatUptime(t.uptime_s || t.uptime || t.uptime_sec);
          const wifiEvent = latestEvent(deviceEvents, 'wifi-scan');
          const wifiNetworks = extractWifiNetworks(wifiEvent);
          const screenshotEvent = latestEvent(deviceEvents, 'screenshot');
          const screenshot = screenshotSource(screenshotEvent);
          const screenshotPath = screenshotLabel(screenshotEvent);

          return (
            <article
              className="card"
              key={d.id}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <header className="card-header">
                <div>
                  <div className="title">{d.name || d.id}</div>
                  <div className="meta">{ip || 'no ip detected'}</div>
                </div>
                <div className="status-stack">
                  <div className={`pill ${statusClass}`}>{statusClass}</div>
                  <div className={`pill ${d.approved ? 'approved' : 'pending'}`}>
                    {d.approved ? 'approved' : 'pending'}
                  </div>
                </div>
              </header>

              <div className="chip-row">
                <span className="chip">ID {d.id.slice(0, 8)}</span>
                {d.mac && <span className="chip">MAC {d.mac}</span>}
              </div>

              <div className="section">
                <h4>Vitals</h4>
                <div className="stats">
                  <div>
                    <span>CPU temp</span>
                    <strong>{formatTemp(t.temp_c)}</strong>
                  </div>
                  <div>
                    <span>Load</span>
                    <strong>{formatLoad(t.load)}</strong>
                  </div>
                  <div>
                    <span>Memory</span>
                    <strong>{formatMemory(t)}</strong>
                  </div>
                  <div>
                    <span>Uptime</span>
                    <strong>{uptime}</strong>
                  </div>
                </div>
              </div>

              <div className="section">
                <h4>Connectivity</h4>
                <div className="info-grid">
                  <div>
                    <span>IP</span>
                    <strong>{ip || '-'}</strong>
                  </div>
                  <div>
                    <span>SSID</span>
                    <strong>{ssid}</strong>
                  </div>
                  <div>
                    <span>Display URL</span>
                    <strong className="mono">{d.url || '-'}</strong>
                  </div>
                  <div>
                    <span>Last seen</span>
                    <strong>{formatTimestamp(d.last_seen)}</strong>
                  </div>
                </div>
              </div>

              {!d.approved && (
                <div className="section approve">
                  <div>
                    <strong>Approval needed</strong>
                    <p className="muted">This device is not yet trusted.</p>
                  </div>
                  <button className="primary" onClick={() => handleApprove(d.id)}>
                    Approve Device
                  </button>
                </div>
              )}

              <div className="section">
                <h4>Quick Actions</h4>
                <div className="action-grid">
                  <button
                    className="danger"
                    onClick={() => handleConfirm(d.id, 'reboot', 'Reboot this device?')}
                  >
                    Reboot
                  </button>
                  <button
                    onClick={() => handleConfirm(d.id, 'restart-nodered', 'Restart Node-RED?')}
                  >
                    Restart Node-RED
                  </button>
                  <button
                    onClick={() => handleConfirm(d.id, 'restart-chromium', 'Restart Chromium?')}
                  >
                    Restart Chromium
                  </button>
                </div>
              </div>

              <div className="section">
                <h4>Remote Access</h4>
                <div className="action-grid">
                  <button
                    className="primary"
                    disabled={!ip}
                    onClick={() => openExternal(ip ? `http://${ip}:4200` : '')}
                  >
                    Open Web SSH
                  </button>
                  <button
                    onClick={() => handleAction(d.id, 'ssh-web', { action: 'start' })}
                  >
                    Start Web SSH
                  </button>
                  <button
                    onClick={() => handleAction(d.id, 'ssh-web', { action: 'stop' })}
                  >
                    Stop Web SSH
                  </button>
                  <button
                    className="secondary"
                    disabled={!ip}
                    onClick={() => openExternal(ip ? `http://${ip}:1880` : '')}
                  >
                    Open Node-RED
                  </button>
                </div>
              </div>

              <div className="section">
                <h4>Diagnostics</h4>
                <div className="action-grid">
                  <button onClick={() => handleAction(d.id, 'screenshot')}>Screenshot</button>
                  <button onClick={() => handleAction(d.id, 'wifi-scan')}>WiFi Scan</button>
                  <button onClick={() => handleAction(d.id, 'get-info')}>Get Info</button>
                  <button onClick={() => handleAction(d.id, 'log-tail')}>Log Tail</button>
                </div>
              </div>

              <div className="section">
                <h4>Set Display URL</h4>
                <div className="url-set">
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={urlDraft[d.id] || ''}
                    onChange={(e) => setUrlDraft({ ...urlDraft, [d.id]: e.target.value })}
                  />
                  <button
                    className="primary"
                    onClick={() => handleAction(d.id, 'set-url', { url: urlDraft[d.id] || '' })}
                  >
                    Set URL
                  </button>
                </div>
              </div>

              {wifiNetworks && (
                <div className="section">
                  <h4>Latest WiFi Scan</h4>
                  <ul className="wifi-list">
                    {wifiNetworks.slice(0, 6).map((network, i) => (
                      <li key={`${d.id}-wifi-${i}`}>{formatWifiNetwork(network)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {screenshotEvent && (
                <div className="section">
                  <h4>Latest Screenshot</h4>
                  {screenshot ? (
                    <img className="screenshot" src={screenshot} alt="Screenshot" />
                  ) : (
                    <div className="muted">{screenshotPath || 'Screenshot captured.'}</div>
                  )}
                </div>
              )}

              <button
                className="ghost"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              >
                {expanded === d.id ? 'Hide Details' : 'Show Details'}
              </button>

              {expanded === d.id && (
                <div className="details">
                  <h3>Recent Events</h3>
                  <div className="event-list">
                    {deviceEvents.map((event) => (
                      <div className="event" key={event.id}>
                        <div className="event-type">{event.type || 'event'}</div>
                        <div className="event-ts">{formatTimestamp(event.ts)}</div>
                        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {active && (
        <div className="footer-note">
          Active device: {active.id}
        </div>
      )}
    </div>
  );
}
