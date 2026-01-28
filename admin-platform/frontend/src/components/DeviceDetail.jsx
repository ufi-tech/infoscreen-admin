import React, { useState } from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery.js';
import { useDeviceContext } from '../context/DeviceContext.jsx';
import CollapsibleSection from './CollapsibleSection.jsx';
import { StatusDot } from './StatusBadge.jsx';
import LocationForm from './LocationForm.jsx';
import CustomerAssignment from './CustomerAssignment.jsx';
import TunnelConfig from './TunnelConfig.jsx';
import { DeviceLogs } from './DeviceLogs.jsx';
import {
  firstIp,
  formatLoad,
  formatTemp,
  formatMemory,
  formatUptime,
  formatTimestamp,
  latestEvent,
  extractWifiNetworks,
  formatWifiNetwork,
  screenshotSource,
} from '../utils/formatters.js';

export default function DeviceDetail() {
  const { isMobile } = useBreakpoint();
  const {
    selectedDevice,
    selectedDeviceId,
    setSelectedDeviceId,
    telemetry,
    events,
    customers,
    handleAction,
    handleConfirm,
    handleApprove,
    locationValue,
    setLocationField,
    handleLocationSave,
    assignmentValue,
    setAssignmentField,
    handleAssignmentSave,
    sshValue,
    setSshField,
    tunnelLoading,
    handleSshStart,
    handleSshStop,
    handleTunnelSave,
    handleAutoPorts,
    handleNodeRedOpen,
    handleNodeRedStop,
    handleWebSshOpen,
    handleWebSshStop,
  } = useDeviceContext();

  const [urlDraft, setUrlDraft] = useState('');

  if (!selectedDevice) {
    return (
      <div className="device-detail-empty">
        <div className="empty-icon">📡</div>
        <h3>Vaelg en enhed</h3>
        <p>Klik på en enhed i listen for at se detaljer</p>
      </div>
    );
  }

  const d = selectedDevice;
  const t = telemetry[d.id] || {};
  const deviceEvents = events[d.id] || [];
  const ip = firstIp(d.ip || t.ip || t.ipv4 || t.ip4 || '');
  const ssid = t.ssid || t.wifi_ssid || t.network || t.ap || '-';
  const uptime = formatUptime(t.uptime_s || t.uptime || t.uptime_sec);
  const wifiEvent = latestEvent(deviceEvents, 'wifi-scan');
  const wifiNetworks = extractWifiNetworks(wifiEvent);
  const screenshotEvent = latestEvent(deviceEvents, 'screenshot');
  const screenshot = screenshotSource(screenshotEvent);

  return (
    <div className="device-detail">
      {/* Header - always visible */}
      <header className="device-detail-header">
        {isMobile && (
          <button
            className="back-button"
            onClick={() => setSelectedDeviceId(null)}
          >
            ← Tilbage
          </button>
        )}
        <div className="device-detail-title-row">
          <StatusDot status={d.status} size="large" />
          <div className="device-detail-title-info">
            <h2 className="device-detail-name">{d.name || d.id.slice(0, 16)}</h2>
            <div className="device-detail-meta">
              {ip || 'Ingen IP'}
              {d.mac && <span> · {d.mac}</span>}
            </div>
          </div>
        </div>
        <div className="device-detail-badges">
          <span className={`pill ${d.status}`}>{d.status}</span>
          <span className={`pill ${d.approved ? 'approved' : 'pending'}`}>
            {d.approved ? 'Godkendt' : 'Afventer'}
          </span>
        </div>
      </header>

      {/* Approval section */}
      {!d.approved && (
        <div className="section approve">
          <div>
            <strong>Godkendelse kraeves</strong>
            <p className="muted">Denne enhed er ikke godkendt endnu.</p>
          </div>
          <button className="primary" onClick={() => handleApprove(d.id)}>
            Godkend
          </button>
        </div>
      )}

      {/* Vitals */}
      <CollapsibleSection title="Systemstatus" defaultOpen={!isMobile}>
        <div className="stats">
          <div>
            <span>CPU Temp</span>
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
      </CollapsibleSection>

      {/* Connectivity */}
      <CollapsibleSection title="Forbindelse" defaultOpen={!isMobile}>
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
            <strong className="mono truncate">{d.url || '-'}</strong>
          </div>
          <div>
            <span>Sidst set</span>
            <strong>{formatTimestamp(d.last_seen)}</strong>
          </div>
        </div>
      </CollapsibleSection>

      {/* Quick Actions */}
      <CollapsibleSection title="Hurtige handlinger" defaultOpen={true}>
        <div className="action-grid">
          <button
            className="danger"
            onClick={() => handleConfirm(d.id, 'reboot', 'Genstart denne enhed?')}
          >
            Genstart
          </button>
          <button onClick={() => handleAction(d.id, 'screenshot', { mode: 'base64' })}>
            Screenshot
          </button>
          <button onClick={() => handleAction(d.id, 'wifi-scan')}>
            WiFi Scan
          </button>
          <button onClick={() => handleAction(d.id, 'get-info')}>
            Hent Info
          </button>
        </div>

        <div className="url-set">
          <input
            type="text"
            placeholder="https://example.com"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <button
            className="primary"
            onClick={() => handleAction(d.id, 'set-url', { url: urlDraft })}
          >
            Saet URL
          </button>
        </div>
      </CollapsibleSection>

      {/* Location */}
      <CollapsibleSection title="Lokation" defaultOpen={false}>
        <LocationForm
          kind="modern"
          id={d.id}
          locationValue={locationValue}
          setLocationField={setLocationField}
          handleLocationSave={handleLocationSave}
        />
      </CollapsibleSection>

      {/* Customer */}
      <CollapsibleSection title="Kunde" defaultOpen={false}>
        <CustomerAssignment
          kind="modern"
          id={d.id}
          customers={customers}
          assignmentValue={assignmentValue}
          setAssignmentField={setAssignmentField}
          handleAssignmentSave={handleAssignmentSave}
        />
      </CollapsibleSection>

      {/* SSH Tunnel */}
      <CollapsibleSection title="SSH Tunnel" defaultOpen={false}>
        <TunnelConfig
          deviceId={d.id}
          events={deviceEvents}
          sshValue={sshValue}
          setSshField={setSshField}
          tunnelLoading={tunnelLoading}
          handleSshStart={handleSshStart}
          handleSshStop={handleSshStop}
          handleTunnelSave={handleTunnelSave}
          handleAutoPorts={handleAutoPorts}
          handleNodeRedOpen={handleNodeRedOpen}
          handleNodeRedStop={handleNodeRedStop}
          handleWebSshOpen={handleWebSshOpen}
          handleWebSshStop={handleWebSshStop}
        />
      </CollapsibleSection>

      {/* WiFi Scan Results */}
      {wifiNetworks && wifiNetworks.length > 0 && (
        <CollapsibleSection title="WiFi Netvaerk" defaultOpen={false}>
          <ul className="wifi-list">
            {wifiNetworks.slice(0, 8).map((network, i) => (
              <li key={`wifi-${i}`}>{formatWifiNetwork(network)}</li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Screenshot */}
      {screenshot && (
        <CollapsibleSection title="Seneste Screenshot" defaultOpen={true}>
          <img className="screenshot" src={screenshot} alt="Screenshot" />
        </CollapsibleSection>
      )}

      {/* Activity Log */}
      <CollapsibleSection title="Aktivitetslog" defaultOpen={isMobile ? false : true}>
        <DeviceLogs deviceId={d.id} limit={10} />
      </CollapsibleSection>
    </div>
  );
}
