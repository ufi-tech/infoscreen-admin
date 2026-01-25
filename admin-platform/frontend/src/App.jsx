import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAssignments,
  fetchCustomers,
  fetchLegacyDevices,
  fetchLocations,
  updateLegacyDevice,
  upsertAssignment,
  upsertLocation,
} from './api.js';
import { useDevices } from './hooks/useDevices.js';
import { useTunnel } from './hooks/useTunnel.js';
import { locationKey, assignmentKey } from './utils/formatters.js';
import { DeviceCard, CustomerSection, LegacyDevices } from './components/index.js';

export default function App() {
  const [view, setView] = useState('modern');
  const [legacyDevices, setLegacyDevices] = useState([]);
  const [locations, setLocations] = useState({ device: {}, legacy: {} });
  const [locationDraft, setLocationDraft] = useState({});
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState({ device: {}, legacy: {} });
  const [assignmentDraft, setAssignmentDraft] = useState({});
  const [legacyError, setLegacyError] = useState('');
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Use custom hooks
  const {
    devices,
    telemetry,
    events,
    error,
    setError,
    loading,
    loadDevices,
    handleAction,
    handleConfirm,
    handleApprove,
    refreshEvents,
  } = useDevices();

  const tunnel = useTunnel(handleAction, refreshEvents, setError);

  // Load legacy devices
  const loadLegacy = useCallback(async () => {
    try {
      setLegacyLoading(true);
      const data = await fetchLegacyDevices();
      setLegacyDevices(data);
      setLegacyError('');
    } catch (err) {
      setLegacyError(err.message || 'Failed to load legacy devices');
    } finally {
      setLegacyLoading(false);
    }
  }, []);

  // Load locations
  const loadLocations = useCallback(async () => {
    try {
      const data = await fetchLocations();
      const next = { device: {}, legacy: {} };
      data.forEach((loc) => {
        if (loc.device_id) next.device[loc.device_id] = loc;
        if (loc.legacy_id) next.legacy[loc.legacy_id] = loc;
      });
      setLocations(next);
    } catch (err) {
      setError(err.message || 'Failed to load locations');
    }
  }, [setError]);

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    }
  }, [setError]);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    try {
      const data = await fetchAssignments();
      const next = { device: {}, legacy: {} };
      data.forEach((assignment) => {
        if (assignment.device_id) next.device[assignment.device_id] = assignment.customer_id;
        if (assignment.legacy_id) next.legacy[assignment.legacy_id] = assignment.customer_id;
      });
      setAssignments(next);
    } catch (err) {
      setError(err.message || 'Failed to load assignments');
    }
  }, [setError]);

  // Load all data on mount and set up refresh interval
  useEffect(() => {
    loadDevices();
    loadLegacy();
    loadLocations();
    loadCustomers();
    loadAssignments();
    tunnel.loadTunnelConfigs();

    const id = setInterval(() => {
      loadDevices();
      loadLegacy();
      loadLocations();
      loadCustomers();
      loadAssignments();
      tunnel.loadTunnelConfigs();
    }, 8000);

    return () => clearInterval(id);
  }, [loadDevices, loadLegacy, loadLocations, loadCustomers, loadAssignments, tunnel.loadTunnelConfigs]);

  // Legacy update handler
  const handleLegacyUpdate = useCallback(async (identifier, payload) => {
    try {
      await updateLegacyDevice(identifier, payload);
      await loadLegacy();
    } catch (err) {
      setLegacyError(err.message || 'Legacy update failed');
    }
  }, [loadLegacy]);

  // Location handlers
  function setLocationField(kind, id, field, value) {
    const key = locationKey(kind, id);
    setLocationDraft((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }));
  }

  function locationValue(kind, id, field) {
    const key = locationKey(kind, id);
    const draft = locationDraft[key] || {};
    if (Object.prototype.hasOwnProperty.call(draft, field)) {
      return draft[field];
    }
    const existing = kind === 'modern' ? locations.device[id] : locations.legacy[id];
    return existing?.[field] ?? '';
  }

  const handleLocationSave = useCallback(async (kind, id) => {
    const key = locationKey(kind, id);
    const draft = locationDraft[key] || {};
    const payload = { ...draft };

    if (draft.lat !== undefined) {
      payload.lat = draft.lat === '' ? null : Number(draft.lat);
      if (draft.lat !== '' && Number.isNaN(payload.lat)) {
        setError('Latitude must be a number');
        return;
      }
    }
    if (draft.lon !== undefined) {
      payload.lon = draft.lon === '' ? null : Number(draft.lon);
      if (draft.lon !== '' && Number.isNaN(payload.lon)) {
        setError('Longitude must be a number');
        return;
      }
    }

    if (kind === 'modern') {
      payload.device_id = id;
    } else {
      payload.legacy_id = id;
    }

    try {
      await upsertLocation(payload);
      await loadLocations();
    } catch (err) {
      setError(err.message || 'Location update failed');
    }
  }, [locationDraft, loadLocations, setError]);

  // Assignment handlers
  function setAssignmentField(kind, id, value) {
    const key = assignmentKey(kind, id);
    setAssignmentDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function assignmentValue(kind, id) {
    const key = assignmentKey(kind, id);
    if (Object.prototype.hasOwnProperty.call(assignmentDraft, key)) {
      return assignmentDraft[key];
    }
    return kind === 'modern' ? assignments.device[id] ?? '' : assignments.legacy[id] ?? '';
  }

  const handleAssignmentSave = useCallback(async (kind, id) => {
    const key = assignmentKey(kind, id);
    const value = assignmentDraft[key] ?? (kind === 'modern' ? assignments.device[id] : assignments.legacy[id]);
    const customerId = value ? Number(value) : null;
    const payload = { customer_id: customerId };
    if (kind === 'modern') payload.device_id = id;
    else payload.legacy_id = id;

    try {
      await upsertAssignment(payload);
      await loadAssignments();
    } catch (err) {
      setError(err.message || 'Assignment update failed');
    }
  }, [assignmentDraft, assignments, loadAssignments, setError]);

  // Refresh all data
  const handleRefreshAll = useCallback(() => {
    loadDevices();
    loadLegacy();
    loadLocations();
    loadCustomers();
    loadAssignments();
    tunnel.loadTunnelConfigs();
  }, [loadDevices, loadLegacy, loadLocations, loadCustomers, loadAssignments, tunnel.loadTunnelConfigs]);

  // Active device memo
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
          <button className="ghost" onClick={handleRefreshAll}>
            Refresh
          </button>
          <div className="hint">Auto refresh: 8s</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${view === 'modern' ? 'active' : ''}`}
          onClick={() => setView('modern')}
        >
          MQTT Devices
        </button>
        <button
          className={`tab ${view === 'legacy' ? 'active' : ''}`}
          onClick={() => setView('legacy')}
        >
          Legacy DB
        </button>
      </div>

      <CustomerSection
        customers={customers}
        loadCustomers={loadCustomers}
        setError={setError}
      />

      {view === 'modern' && (
        <>
          {error && <div className="notice error">{error}</div>}
          {loading && <div className="notice info">Loading devices...</div>}

          <div className="grid">
            {devices.map((device, index) => (
              <DeviceCard
                key={device.id}
                device={device}
                index={index}
                telemetry={telemetry[device.id]}
                events={events[device.id]}
                expanded={expanded}
                setExpanded={setExpanded}
                customers={customers}
                handleAction={handleAction}
                handleConfirm={handleConfirm}
                handleApprove={handleApprove}
                locationValue={locationValue}
                setLocationField={setLocationField}
                handleLocationSave={handleLocationSave}
                assignmentValue={assignmentValue}
                setAssignmentField={setAssignmentField}
                handleAssignmentSave={handleAssignmentSave}
                sshValue={tunnel.sshValue}
                setSshField={tunnel.setSshField}
                tunnelLoading={tunnel.tunnelLoading}
                handleSshStart={tunnel.handleSshStart}
                handleSshStop={tunnel.handleSshStop}
                handleTunnelSave={tunnel.handleTunnelSave}
                handleAutoPorts={tunnel.handleAutoPorts}
                handleNodeRedOpen={tunnel.handleNodeRedOpen}
                handleNodeRedStop={tunnel.handleNodeRedStop}
                handleWebSshOpen={tunnel.handleWebSshOpen}
                handleWebSshStop={tunnel.handleWebSshStop}
              />
            ))}
          </div>

          {active && (
            <div className="footer-note">
              Active device: {active.id}
            </div>
          )}
        </>
      )}

      {view === 'legacy' && (
        <LegacyDevices
          legacyDevices={legacyDevices}
          legacyError={legacyError}
          legacyLoading={legacyLoading}
          handleLegacyUpdate={handleLegacyUpdate}
          locationValue={locationValue}
          setLocationField={setLocationField}
          handleLocationSave={handleLocationSave}
        />
      )}
    </div>
  );
}
