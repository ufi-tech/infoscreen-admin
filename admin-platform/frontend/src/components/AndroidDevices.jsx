import React, { useState, useEffect, useCallback } from 'react';
import { StatusDot } from './StatusBadge.jsx';
import CollapsibleSection from './CollapsibleSection.jsx';
import { formatRelativeTime } from '../utils/formatters.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AndroidDevices() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commandLoading, setCommandLoading] = useState(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [showStale, setShowStale] = useState(false);

  // Load Android devices
  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      const data = await res.json();

      // Filter to only show IOCast Android devices (all devices with iocast- prefix)
      let androidDevices = data.filter(d => d.id.startsWith('iocast-'));

      // Filter out stale devices unless showStale is enabled
      if (!showStale) {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        androidDevices = androidDevices.filter(d => {
          // Keep if online
          if (d.status === 'online') return true;
          // Keep if seen within last hour
          const lastSeen = new Date(d.last_seen).getTime();
          return lastSeen > oneHourAgo;
        });
      }

      // Sort by status (online first) then by last_seen
      androidDevices.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (b.status === 'online' && a.status !== 'online') return 1;
        return new Date(b.last_seen) - new Date(a.last_seen);
      });

      setDevices(androidDevices);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  }, [showStale]);

  // Load telemetry for selected device
  const loadTelemetry = useCallback(async (deviceId) => {
    try {
      const res = await fetch(`${API_URL}/devices/${deviceId}/telemetry?limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        setTelemetry(data[0].payload);
      } else {
        setTelemetry(null);
      }
    } catch (err) {
      console.error('Error loading telemetry:', err);
      setTelemetry(null);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  useEffect(() => {
    if (selectedDevice) {
      loadTelemetry(selectedDevice.id);
      setUrlDraft('');
      const interval = setInterval(() => loadTelemetry(selectedDevice.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedDevice, loadTelemetry]);

  // Send command to device
  const sendCommand = async (action, payload = {}) => {
    if (!selectedDevice) return;
    setCommandLoading(action);
    try {
      await fetch(`${API_URL}/devices/${selectedDevice.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
    } catch (err) {
      console.error('Command error:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  // Delete device
  const handleDelete = async (deviceId) => {
    if (!confirm(`Er du sikker på du vil slette ${deviceId}?\n\nAlle telemetri og logs slettes også.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/devices/${deviceId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.ok) {
        // Clear selection if deleted device was selected
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null);
          setTelemetry(null);
        }
        // Reload list
        loadDevices();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSetUrl = () => {
    if (urlDraft) {
      sendCommand('loadUrl', { url: urlDraft });
    }
  };

  if (loading) {
    return <div className="loading-container">Indlæser Android enheder...</div>;
  }

  const onlineCount = devices.filter(d => d.status === 'online').length;

  return (
    <div className="android-devices-container">
      <div className="android-device-list">
        <h2>IOCast Android Enheder</h2>
        <div className="device-stats">
          <span className="stat online">{onlineCount} online</span>
          <span className="stat total">{devices.length} total</span>
        </div>

        <label className="show-stale-toggle">
          <input
            type="checkbox"
            checked={showStale}
            onChange={(e) => setShowStale(e.target.checked)}
          />
          Vis gamle enheder
        </label>

        {devices.length === 0 ? (
          <p className="muted">Ingen aktive Android enheder fundet</p>
        ) : (
          devices.map(device => (
            <div
              key={device.id}
              className={`android-device-item ${selectedDevice?.id === device.id ? 'selected' : ''} ${device.status}`}
              onClick={() => setSelectedDevice(device)}
            >
              <StatusDot status={device.status} />
              <div className="device-info">
                <strong>{device.name}</strong>
                <span className="muted">{device.ip || 'Ingen IP'}</span>
              </div>
              <div className="device-meta">
                <span className="last-seen">{formatRelativeTime(device.last_seen)}</span>
                <button
                  className="btn-icon delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(device.id);
                  }}
                  title="Slet enhed"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="android-device-detail">
        {selectedDevice ? (
          <>
            <div className="device-header">
              <StatusDot status={selectedDevice.status} size="large" />
              <div>
                <h2>{selectedDevice.name}</h2>
                <span className="device-id">{selectedDevice.id}</span>
                <span className={`status-label ${selectedDevice.status}`}>
                  {selectedDevice.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {telemetry ? (
              <>
                <CollapsibleSection title="App Info" defaultOpen={true}>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>App Version</label>
                      <strong>{telemetry.appVersion || '-'} {telemetry.appVersionCode ? `(${telemetry.appVersionCode})` : ''}</strong>
                    </div>
                    <div className="info-item">
                      <label>Android</label>
                      <strong>{telemetry.androidVersion || '-'} {telemetry.androidSdk ? `(SDK ${telemetry.androidSdk})` : ''}</strong>
                    </div>
                    <div className="info-item">
                      <label>Producent</label>
                      <strong>{telemetry.manufacturer || '-'}</strong>
                    </div>
                    <div className="info-item">
                      <label>Model</label>
                      <strong>{telemetry.model || '-'}</strong>
                    </div>
                    <div className="info-item">
                      <label>Device ID</label>
                      <strong className="mono">{telemetry.deviceId || selectedDevice.id}</strong>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Status" defaultOpen={true}>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Batteri</label>
                      <strong className={telemetry.batteryLevel < 20 ? 'warning' : ''}>
                        {telemetry.batteryLevel != null ? `${telemetry.batteryLevel}%` : '-'}
                        {telemetry.batteryCharging && ' ⚡'}
                      </strong>
                    </div>
                    <div className="info-item">
                      <label>WiFi</label>
                      <strong>
                        {telemetry.wifiSsid || '-'}
                        {telemetry.wifiSignal && ` (${telemetry.wifiSignal} dBm)`}
                      </strong>
                    </div>
                    <div className="info-item">
                      <label>Skærm</label>
                      <strong>{telemetry.screenOn ? '🟢 Tændt' : '🔴 Slukket'}</strong>
                    </div>
                    <div className="info-item">
                      <label>Netværk</label>
                      <strong>{telemetry.networkConnected ? '✓ Forbundet' : '✗ Ikke forbundet'}</strong>
                    </div>
                    <div className="info-item">
                      <label>Hukommelse</label>
                      <strong>
                        {telemetry.memoryFree != null && telemetry.memoryTotal != null
                          ? `${telemetry.memoryFree} / ${telemetry.memoryTotal} MB`
                          : '-'}
                      </strong>
                    </div>
                    <div className="info-item">
                      <label>Lager</label>
                      <strong>
                        {telemetry.storageFree != null && telemetry.storageTotal != null
                          ? `${(telemetry.storageFree / 1024).toFixed(1)} / ${(telemetry.storageTotal / 1024).toFixed(1)} GB`
                          : '-'}
                      </strong>
                    </div>
                    <div className="info-item full-width">
                      <label>Nuværende URL</label>
                      {telemetry.currentUrl ? (
                        <a href={telemetry.currentUrl} target="_blank" rel="noopener noreferrer">
                          {telemetry.currentUrl}
                        </a>
                      ) : (
                        <span className="muted">Ingen URL sat</span>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Kommandoer" defaultOpen={true}>
                  <div className="command-buttons">
                    <button
                      className="btn btn-primary"
                      onClick={() => sendCommand('screenOn')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'screenOn' ? '...' : '💡 Tænd Skærm'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('screenOff')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'screenOff' ? '...' : '🌙 Sluk Skærm'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('reload')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'reload' ? '...' : '🔄 Genindlæs'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('screenshot')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'screenshot' ? '...' : '📷 Screenshot'}
                    </button>
                  </div>

                  <div className="url-input-group">
                    <input
                      type="url"
                      placeholder="https://kunde.screen.iocast.dk/screen/..."
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleSetUrl}
                      disabled={!urlDraft || commandLoading}
                    >
                      Skift URL
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Slet Enhed" defaultOpen={false}>
                  <p className="muted">
                    Slet denne enhed og al dens data (telemetri, logs, etc.).
                    Enheden vil automatisk blive oprettet igen næste gang den forbinder.
                  </p>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(selectedDevice.id)}
                  >
                    🗑️ Slet {selectedDevice.name}
                  </button>
                </CollapsibleSection>
              </>
            ) : (
              <div className="no-telemetry">
                <p className="muted">Ingen telemetri data tilgængelig for denne enhed.</p>
                <p className="muted">Enheden sender muligvis ikke data, eller er aldrig blevet tilsluttet.</p>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(selectedDevice.id)}
                >
                  🗑️ Slet enhed
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📱</div>
            <h3>Vælg en enhed</h3>
            <p>Klik på en Android enhed for at se detaljer og sende kommandoer</p>
          </div>
        )}
      </div>
    </div>
  );
}
