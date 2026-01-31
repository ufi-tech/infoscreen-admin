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

                  <h4 style={{marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-muted)'}}>TV Kontrol (HDMI-CEC)</h4>
                  <div className="command-buttons">
                    <button
                      className="btn btn-primary"
                      onClick={() => sendCommand('tvOn')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'tvOn' ? '...' : '📺 Tænd TV'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('tvOff')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'tvOff' ? '...' : '📴 Sluk TV'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('tvVolumeUp')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'tvVolumeUp' ? '...' : '🔊 Vol +'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('tvVolumeDown')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'tvVolumeDown' ? '...' : '🔉 Vol -'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('tvMute')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'tvMute' ? '...' : '🔇 Mute'}
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

                <CollapsibleSection title="Netværk & System" defaultOpen={false}>
                  <h4 style={{marginBottom: '0.75rem', color: 'var(--text-muted)'}}>Netværk</h4>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('ping', { host: '8.8.8.8' })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'ping' ? '...' : '🌐 Ping Google'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getWifiNetworks')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getWifiNetworks' ? '...' : '📶 Scan WiFi'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getNetworkInfo')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getNetworkInfo' ? '...' : '🔗 Netværksinfo'}
                    </button>
                  </div>

                  <h4 style={{marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-muted)'}}>System</h4>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getInfo')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getInfo' ? '...' : '📊 Enhedsinfo'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getStorage')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getStorage' ? '...' : '💾 Lagerinfo'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getLogs', { lines: 50 })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getLogs' ? '...' : '📜 Hent logs'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('clearCache')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'clearCache' ? '...' : '🧹 Ryd cache'}
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Lydstyrke" defaultOpen={false}>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getVolume')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getVolume' ? '...' : '🔊 Hent lydstyrke'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setVolume', { level: 50 })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setVolume' ? '...' : '🔉 50%'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setVolume', { level: 100 })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setVolume' ? '...' : '🔊 100%'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setMute', { mute: true })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setMute' ? '...' : '🔇 Mute'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setMute', { mute: false })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setMute' ? '...' : '🔈 Unmute'}
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Tidsplaner" defaultOpen={false}>
                  <h4 style={{marginBottom: '0.75rem', color: 'var(--text-muted)'}}>Skærm tidsplan</h4>
                  <p className="muted" style={{marginBottom: '0.5rem'}}>Tænd/sluk TV automatisk</p>
                  <div className="command-buttons">
                    <button
                      className="btn btn-primary"
                      onClick={() => sendCommand('setDisplaySchedule', { enabled: true, onHour: 7, onMinute: 0, offHour: 22, offMinute: 0 })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setDisplaySchedule' ? '...' : '⏰ 07:00-22:00'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setDisplaySchedule', { enabled: true, onHour: 6, onMinute: 0, offHour: 23, offMinute: 0 })}
                      disabled={commandLoading}
                    >
                      06:00-23:00
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setDisplaySchedule', { enabled: false })}
                      disabled={commandLoading}
                    >
                      Deaktiver
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getDisplaySchedule')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getDisplaySchedule' ? '...' : 'Vis tidsplan'}
                    </button>
                  </div>

                  <h4 style={{marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-muted)'}}>Planlagt genstart</h4>
                  <p className="muted" style={{marginBottom: '0.5rem'}}>Genstart enheden automatisk</p>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('scheduleReboot', { hour: 3, minute: 0, daily: true })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'scheduleReboot' ? '...' : '🔄 Daglig kl. 03:00'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('cancelScheduledReboot')}
                      disabled={commandLoading}
                    >
                      Annuller
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Kiosk & App" defaultOpen={false}>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getKioskMode')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getKioskMode' ? '...' : '🔒 Kiosk status'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setKioskMode', { enabled: true })}
                      disabled={commandLoading}
                    >
                      Aktivér kiosk
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setKioskMode', { enabled: false })}
                      disabled={commandLoading}
                    >
                      Deaktivér kiosk
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('restartApp')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'restartApp' ? '...' : '🔄 Genstart app'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getApps')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getApps' ? '...' : '📱 List apps'}
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Skærmretning" defaultOpen={false}>
                  <div className="command-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setOrientation', { orientation: 'landscape' })}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'setOrientation' ? '...' : '🖥️ Landscape'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setOrientation', { orientation: 'portrait' })}
                      disabled={commandLoading}
                    >
                      📱 Portrait
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setOrientation', { orientation: 'reverse_landscape' })}
                      disabled={commandLoading}
                    >
                      🔄 Omvendt landscape
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('setOrientation', { orientation: 'auto' })}
                      disabled={commandLoading}
                    >
                      🔄 Auto
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => sendCommand('getOrientation')}
                      disabled={commandLoading}
                    >
                      {commandLoading === 'getOrientation' ? '...' : 'Vis retning'}
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
