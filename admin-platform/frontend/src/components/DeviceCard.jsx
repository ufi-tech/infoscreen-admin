import React from 'react';
import {
  firstIp,
  normalizeStatus,
  formatLoad,
  formatTemp,
  formatMemory,
  formatUptime,
  formatTimestamp,
  latestEvent,
  extractWifiNetworks,
  formatWifiNetwork,
  screenshotSource,
  screenshotLabel,
} from '../utils/formatters.js';
import DeviceActions from './DeviceActions.jsx';
import TunnelConfig from './TunnelConfig.jsx';
import LocationForm from './LocationForm.jsx';
import CustomerAssignment from './CustomerAssignment.jsx';
import { DeviceLogs } from './DeviceLogs.jsx';

export default function DeviceCard({
  device,
  index,
  telemetry,
  events,
  expanded,
  setExpanded,
  customers,
  // Action handlers
  handleAction,
  handleConfirm,
  handleApprove,
  // Location props
  locationValue,
  setLocationField,
  handleLocationSave,
  // Assignment props
  assignmentValue,
  setAssignmentField,
  handleAssignmentSave,
  // Tunnel props
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
}) {
  const d = device;
  const t = telemetry || {};
  const deviceEvents = events || [];
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

      <LocationForm
        kind="modern"
        id={d.id}
        locationValue={locationValue}
        setLocationField={setLocationField}
        handleLocationSave={handleLocationSave}
      />

      <CustomerAssignment
        kind="modern"
        id={d.id}
        customers={customers}
        assignmentValue={assignmentValue}
        setAssignmentField={setAssignmentField}
        handleAssignmentSave={handleAssignmentSave}
      />

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

      <DeviceActions
        deviceId={d.id}
        handleAction={handleAction}
        handleConfirm={handleConfirm}
      />

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

      <div className="section">
        <h4>Aktivitetslog</h4>
        <DeviceLogs deviceId={d.id} limit={5} />
      </div>

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
}
