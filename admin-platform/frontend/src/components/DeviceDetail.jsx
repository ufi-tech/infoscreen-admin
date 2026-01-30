import React, { useState, useEffect } from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery.js';
import { useDeviceContext } from '../context/DeviceContext.jsx';
import CollapsibleSection from './CollapsibleSection.jsx';
import { StatusDot } from './StatusBadge.jsx';
import LocationForm from './LocationForm.jsx';
import CustomerAssignment from './CustomerAssignment.jsx';
import TunnelConfig from './TunnelConfig.jsx';
import { DeviceLogs } from './DeviceLogs.jsx';
import {
  setFullyPassword,
  fetchDeviceScreen,
  setDeviceScreen,
  fetchCustomerScreens,
} from '../api.js';
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
    loadDevices,
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
  const [brightnessDraft, setBrightnessDraft] = useState(128);
  const [fullyPasswordDraft, setFullyPasswordDraft] = useState('');

  // Screen assignment state (Fase 3)
  const [screenAssignment, setScreenAssignment] = useState(null);
  const [availableScreens, setAvailableScreens] = useState([]);
  const [selectedScreenUuid, setSelectedScreenUuid] = useState('');
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenError, setScreenError] = useState(null);

  // Load screen assignment when device changes
  useEffect(() => {
    if (!selectedDeviceId) return;

    async function loadScreenData() {
      try {
        setScreenError(null);
        const assignment = await fetchDeviceScreen(selectedDeviceId);
        setScreenAssignment(assignment);
        setSelectedScreenUuid(assignment.screen_uuid || '');

        // If device is assigned to a customer, fetch available screens
        if (assignment.customer_id) {
          try {
            const screensData = await fetchCustomerScreens(assignment.customer_id);
            setAvailableScreens(screensData.screens || []);
          } catch (err) {
            // CMS might not be configured or reachable
            console.warn('Could not fetch screens:', err);
            setAvailableScreens([]);
          }
        } else {
          setAvailableScreens([]);
        }
      } catch (err) {
        console.error('Error loading screen data:', err);
        setScreenAssignment(null);
        setAvailableScreens([]);
      }
    }

    loadScreenData();
  }, [selectedDeviceId]);

  // Handle screen selection change
  const handleScreenChange = async (newScreenUuid) => {
    if (newScreenUuid === selectedScreenUuid) return;

    setScreenLoading(true);
    setScreenError(null);

    try {
      const result = await setDeviceScreen(selectedDeviceId, newScreenUuid || null);
      setSelectedScreenUuid(newScreenUuid);
      setScreenAssignment((prev) => ({
        ...prev,
        screen_uuid: result.screen_uuid,
        display_url: result.display_url,
      }));
    } catch (err) {
      setScreenError(err.message);
    } finally {
      setScreenLoading(false);
    }
  };

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

  // Detect if this is a Fully Kiosk device
  const isFullyDevice = d.id.startsWith('fully-');

  // Handle Fully password save
  const handleFullyPasswordSave = async () => {
    if (!fullyPasswordDraft) return;
    try {
      await setFullyPassword(d.id, fullyPasswordDraft);
      setFullyPasswordDraft('');
      loadDevices(); // Refresh to update has_fully_password
    } catch (err) {
      console.error('Failed to set Fully password:', err);
    }
  };

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

      {/* Vitals - different for Fully vs Pi */}
      <CollapsibleSection title="Systemstatus" defaultOpen={!isMobile}>
        {isFullyDevice ? (
          <div className="stats">
            <div>
              <span>Batteri</span>
              <strong>{t.battery_level != null ? `${t.battery_level}%` : '-'}</strong>
            </div>
            <div>
              <span>Opladning</span>
              <strong>{t.battery_charging ? 'Ja' : 'Nej'}</strong>
            </div>
            <div>
              <span>Skaerm</span>
              <strong>{t.screen_on ? 'Taendt' : 'Slukket'}</strong>
            </div>
            <div>
              <span>Lysstyrke</span>
              <strong>{t.screen_brightness != null ? t.screen_brightness : '-'}</strong>
            </div>
          </div>
        ) : (
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
        )}
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

      {/* Quick Actions - different for Fully vs Pi */}
      <CollapsibleSection title="Hurtige handlinger" defaultOpen={true}>
        {isFullyDevice ? (
          <>
            {/* Fully Kiosk specific actions */}
            <div className="action-grid">
              <button onClick={() => handleAction(d.id, 'screenOn')}>
                Taend Skaerm
              </button>
              <button onClick={() => handleAction(d.id, 'screenOff')}>
                Sluk Skaerm
              </button>
              <button onClick={() => handleAction(d.id, 'startScreensaver')}>
                Pauseskaerm
              </button>
              <button onClick={() => handleAction(d.id, 'stopScreensaver')}>
                Stop Pause
              </button>
            </div>

            {/* Brightness control */}
            <div className="brightness-control">
              <label>Lysstyrke: {brightnessDraft}</label>
              <div className="brightness-row">
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={brightnessDraft}
                  onChange={(e) => setBrightnessDraft(Number(e.target.value))}
                />
                <button
                  className="primary small"
                  onClick={() => handleAction(d.id, 'setBrightness', { brightness: brightnessDraft })}
                >
                  Saet
                </button>
              </div>
            </div>

            {/* URL control */}
            <div className="url-set">
              <input
                type="text"
                placeholder="https://example.com"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
              <button
                className="primary"
                onClick={() => handleAction(d.id, 'loadUrl', { url: urlDraft })}
              >
                Skift URL
              </button>
            </div>

            <div className="action-grid" style={{ marginTop: 'var(--space-md)' }}>
              <button onClick={() => handleAction(d.id, 'loadStartUrl')}>
                Gaa til Start-URL
              </button>
              <button
                className="danger"
                onClick={() => handleConfirm(d.id, 'restartApp', 'Genstart Fully app?')}
              >
                Genstart App
              </button>
              <button
                className="danger"
                onClick={() => handleConfirm(d.id, 'reboot', 'Genstart hele enheden?')}
              >
                Genstart Enhed
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Raspberry Pi actions */}
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
          </>
        )}
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

      {/* CMS Screen Assignment (Fase 3) */}
      {screenAssignment?.assigned && (
        <CollapsibleSection title="CMS Skaerm" defaultOpen={false}>
          <div className="screen-assignment-section">
            {screenAssignment.customer_name && (
              <p className="muted">
                Tilknyttet kunde: <strong>{screenAssignment.customer_name}</strong>
                {screenAssignment.cms_subdomain && (
                  <span> ({screenAssignment.cms_subdomain}.screen.iocast.dk)</span>
                )}
              </p>
            )}

            {screenError && (
              <div className="error-banner small">{screenError}</div>
            )}

            {availableScreens.length > 0 ? (
              <>
                <div className="form-group">
                  <label>Vaelg skaerm:</label>
                  <select
                    value={selectedScreenUuid}
                    onChange={(e) => handleScreenChange(e.target.value)}
                    disabled={screenLoading}
                  >
                    <option value="">-- Ingen skaerm valgt --</option>
                    {availableScreens.map((screen) => (
                      <option key={screen.uuid} value={screen.uuid}>
                        {screen.name}
                        {screen.location && ` (${screen.location})`}
                        {!screen.active && ' [Inaktiv]'}
                      </option>
                    ))}
                  </select>
                </div>

                {screenAssignment.display_url && (
                  <div className="screen-preview">
                    <p className="muted">Aktuel display URL:</p>
                    <a
                      href={screenAssignment.display_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="display-url-link"
                    >
                      {screenAssignment.display_url}
                    </a>
                  </div>
                )}

                {screenLoading && <p className="muted">Opdaterer...</p>}
              </>
            ) : screenAssignment.cms_subdomain ? (
              <p className="muted">
                Ingen skaerme fundet i CMS. Opret skaerme i{' '}
                <a
                  href={`https://${screenAssignment.cms_subdomain}.screen.iocast.dk`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kundens CMS
                </a>.
              </p>
            ) : (
              <p className="muted">
                Kunden har ikke et CMS konfigureret endnu.
              </p>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Fully Password - only for Fully devices */}
      {isFullyDevice && (
        <CollapsibleSection title="Fully Password" defaultOpen={false}>
          <div className="fully-password-section">
            <p className="muted">
              {d.has_fully_password
                ? 'Password er sat. Indtast nyt for at aendre.'
                : 'Intet password sat. Standard (1227) bruges.'}
            </p>
            <div className="url-set">
              <input
                type="password"
                placeholder="Nyt password"
                value={fullyPasswordDraft}
                onChange={(e) => setFullyPasswordDraft(e.target.value)}
              />
              <button className="primary" onClick={handleFullyPasswordSave}>
                Gem Password
              </button>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* SSH Tunnel - only for Pi devices */}
      {!isFullyDevice && (
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
      )}

      {/* WiFi Scan Results - only for Pi devices */}
      {!isFullyDevice && wifiNetworks && wifiNetworks.length > 0 && (
        <CollapsibleSection title="WiFi Netvaerk" defaultOpen={false}>
          <ul className="wifi-list">
            {wifiNetworks.slice(0, 8).map((network, i) => (
              <li key={`wifi-${i}`}>{formatWifiNetwork(network)}</li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Screenshot - only for Pi devices */}
      {!isFullyDevice && screenshot && (
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
