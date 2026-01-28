import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import {
  approveDevice,
  fetchDevices,
  fetchEvents,
  fetchTelemetry,
  sendCommand,
  fetchTunnelConfigs,
  saveTunnelConfig,
  allocateTunnelPorts,
  fetchLegacyDevices,
  updateLegacyDevice,
  fetchLocations,
  fetchCustomers,
  fetchAssignments,
  upsertLocation,
  upsertAssignment,
} from '../api.js';
import { normalizeHost, parsePort, locationKey, assignmentKey } from '../utils/formatters.js';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  // Device state
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [events, setEvents] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Legacy devices
  const [legacyDevices, setLegacyDevices] = useState([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyError, setLegacyError] = useState('');

  // Locations & Assignments
  const [locations, setLocations] = useState({ device: {}, legacy: {} });
  const [locationDraft, setLocationDraft] = useState({});
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState({ device: {}, legacy: {} });
  const [assignmentDraft, setAssignmentDraft] = useState({});

  // Tunnel state
  const [tunnelConfigs, setTunnelConfigs] = useState({});
  const [sshDraft, setSshDraft] = useState({});
  const [tunnelLoading, setTunnelLoading] = useState({});

  // View state
  const [view, setView] = useState('devices'); // 'devices' | 'legacy' | 'customers'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline'

  // Load devices
  const loadDevices = useCallback(async () => {
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
  }, []);

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
  }, []);

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    }
  }, []);

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
  }, []);

  // Load tunnel configs
  const loadTunnelConfigs = useCallback(async () => {
    try {
      const data = await fetchTunnelConfigs();
      const next = {};
      data.forEach((config) => {
        next[config.device_id] = config;
      });
      setTunnelConfigs(next);
    } catch (err) {
      setError(err.message || 'Failed to load tunnel configs');
    }
  }, []);

  // Initial load and refresh
  useEffect(() => {
    loadDevices();
    loadLegacy();
    loadLocations();
    loadCustomers();
    loadAssignments();
    loadTunnelConfigs();

    const id = setInterval(() => {
      loadDevices();
      loadLegacy();
    }, 8000);

    return () => clearInterval(id);
  }, [loadDevices, loadLegacy, loadLocations, loadCustomers, loadAssignments, loadTunnelConfigs]);

  // Device actions
  const handleAction = useCallback(async (deviceId, action, payload = {}) => {
    try {
      await sendCommand(deviceId, action, payload);
    } catch (err) {
      setError(err.message || 'Command failed');
    }
  }, []);

  const handleConfirm = useCallback(async (deviceId, action, message, payload = {}) => {
    if (message && !window.confirm(message)) return;
    await handleAction(deviceId, action, payload);
  }, [handleAction]);

  const handleApprove = useCallback(async (deviceId) => {
    try {
      await approveDevice(deviceId);
      await loadDevices();
    } catch (err) {
      setError(err.message || 'Approve failed');
    }
  }, [loadDevices]);

  const refreshEvents = useCallback(async (deviceId) => {
    const newEvents = await fetchEvents(deviceId, 8).catch(() => []);
    setEvents((prev) => ({ ...prev, [deviceId]: newEvents }));
    return newEvents;
  }, []);

  // Legacy update
  const handleLegacyUpdate = useCallback(async (identifier, payload) => {
    try {
      await updateLegacyDevice(identifier, payload);
      await loadLegacy();
    } catch (err) {
      setLegacyError(err.message || 'Legacy update failed');
    }
  }, [loadLegacy]);

  // Location helpers
  function setLocationField(kind, id, field, value) {
    const key = locationKey(kind, id);
    setLocationDraft((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  }

  function locationValue(kind, id, field) {
    const key = locationKey(kind, id);
    const draft = locationDraft[key] || {};
    if (Object.prototype.hasOwnProperty.call(draft, field)) return draft[field];
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

    if (kind === 'modern') payload.device_id = id;
    else payload.legacy_id = id;

    try {
      await upsertLocation(payload);
      await loadLocations();
    } catch (err) {
      setError(err.message || 'Location update failed');
    }
  }, [locationDraft, loadLocations]);

  // Assignment helpers
  function setAssignmentField(kind, id, value) {
    const key = assignmentKey(kind, id);
    setAssignmentDraft((prev) => ({ ...prev, [key]: value }));
  }

  function assignmentValue(kind, id) {
    const key = assignmentKey(kind, id);
    if (Object.prototype.hasOwnProperty.call(assignmentDraft, key)) return assignmentDraft[key];
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
  }, [assignmentDraft, assignments, loadAssignments]);

  // Tunnel helpers
  const getSshValue = useCallback((deviceId, field) => {
    const draft = sshDraft[deviceId] || {};
    if (Object.prototype.hasOwnProperty.call(draft, field)) {
      const value = draft[field];
      if (value !== '' && value !== null && value !== undefined) return value;
    }
    const config = tunnelConfigs[deviceId] || {};
    const value = config[field];
    if (value === null || value === undefined) return '';
    return String(value);
  }, [sshDraft, tunnelConfigs]);

  function sshValue(deviceId, field) {
    return getSshValue(deviceId, field);
  }

  function setSshField(deviceId, field, value) {
    setSshDraft((prev) => ({
      ...prev,
      [deviceId]: { ...(prev[deviceId] || {}), [field]: value },
    }));
  }

  const handleTunnelSave = useCallback(async (deviceId) => {
    const host = normalizeHost(getSshValue(deviceId, 'host'));
    const user = String(getSshValue(deviceId, 'user')).trim();
    const keyPath = String(getSshValue(deviceId, 'key_path')).trim();
    const tunnelPort = parsePort(getSshValue(deviceId, 'tunnel_port'));
    const sshPort = parsePort(getSshValue(deviceId, 'ssh_port'));
    const noderedPort = parsePort(getSshValue(deviceId, 'nodered_port'));
    const webSshPort = parsePort(getSshValue(deviceId, 'web_ssh_port'));

    const payload = {};
    if (host) payload.host = host;
    if (user) payload.user = user;
    if (keyPath) payload.key_path = keyPath;
    if (tunnelPort) payload.tunnel_port = tunnelPort;
    if (sshPort) payload.ssh_port = sshPort;
    if (noderedPort) payload.nodered_port = noderedPort;
    if (webSshPort) payload.web_ssh_port = webSshPort;

    try {
      const updated = await saveTunnelConfig(deviceId, payload);
      setTunnelConfigs((prev) => ({ ...prev, [deviceId]: updated }));
    } catch (err) {
      setError(err.message || 'Failed to save tunnel config');
    }
  }, [getSshValue]);

  const handleAutoPorts = useCallback(async (deviceId, force = false) => {
    try {
      const updated = await allocateTunnelPorts(deviceId, { force: !!force });
      setTunnelConfigs((prev) => ({ ...prev, [deviceId]: updated }));
      setSshDraft((prev) => ({
        ...prev,
        [deviceId]: {
          ...(prev[deviceId] || {}),
          ssh_port: updated.ssh_port ? String(updated.ssh_port) : '',
          nodered_port: updated.nodered_port ? String(updated.nodered_port) : '',
          web_ssh_port: updated.web_ssh_port ? String(updated.web_ssh_port) : '',
          tunnel_port: updated.tunnel_port ? String(updated.tunnel_port) : '',
        },
      }));
      return updated;
    } catch (err) {
      setError(err.message || 'Port allocation failed');
      return null;
    }
  }, []);

  const handleSshStart = useCallback(async (deviceId) => {
    const host = normalizeHost(getSshValue(deviceId, 'host'));
    const user = String(getSshValue(deviceId, 'user')).trim();
    let remotePort = parsePort(getSshValue(deviceId, 'ssh_port'));
    const localPort = parsePort(getSshValue(deviceId, 'local_port')) || 22;
    const tunnelPort = parsePort(getSshValue(deviceId, 'tunnel_port'));
    const keyPath = String(getSshValue(deviceId, 'key_path')).trim();
    const name = String(getSshValue(deviceId, 'name') || 'admin').trim();

    if (!host || !user) {
      setError('Reverse SSH requires host and user');
      return;
    }
    if (!remotePort) {
      const updated = await handleAutoPorts(deviceId);
      remotePort = parsePort(updated?.ssh_port);
    }
    if (!remotePort) {
      setError('SSH port is missing');
      return;
    }

    setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-ssh`]: true }));
    try {
      const payload = {
        action: 'start',
        name: name || 'admin',
        host,
        user,
        remote_port: remotePort,
        local_port: localPort,
      };
      if (keyPath) payload.key = keyPath;
      if (tunnelPort) payload.port = tunnelPort;
      await handleAction(deviceId, 'ssh-tunnel', payload);
      await new Promise((r) => setTimeout(r, 3000));
      await refreshEvents(deviceId);
    } finally {
      setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-ssh`]: false }));
    }
  }, [getSshValue, handleAction, handleAutoPorts, refreshEvents]);

  const handleSshStop = useCallback(async (deviceId) => {
    const name = String(getSshValue(deviceId, 'name') || 'admin').trim();
    await handleAction(deviceId, 'ssh-tunnel', { action: 'stop', name: name || 'admin' });
  }, [getSshValue, handleAction]);

  const handleNodeRedOpen = useCallback(async (deviceId) => {
    const host = normalizeHost(getSshValue(deviceId, 'host'));
    const user = String(getSshValue(deviceId, 'user')).trim();
    let remotePort = parsePort(getSshValue(deviceId, 'nodered_port'));
    const tunnelPort = parsePort(getSshValue(deviceId, 'tunnel_port'));
    const keyPath = String(getSshValue(deviceId, 'key_path')).trim();

    if (!host || !user) {
      setError('Node-RED requires tunnel host and user');
      return;
    }
    if (!remotePort) {
      const updated = await handleAutoPorts(deviceId);
      remotePort = parsePort(updated?.nodered_port);
    }
    if (!remotePort) {
      setError('Node-RED tunnel port is missing');
      return;
    }

    setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-nodered`]: true }));
    try {
      const payload = {
        action: 'start',
        name: 'nodered',
        host,
        user,
        remote_port: remotePort,
        local_port: 1880,
      };
      if (keyPath) payload.key = keyPath;
      if (tunnelPort) payload.port = tunnelPort;
      await handleAction(deviceId, 'ssh-tunnel', payload);
      await new Promise((r) => setTimeout(r, 4000));
      window.open(`http://${host}:${remotePort}`, '_blank', 'noopener,noreferrer');
    } finally {
      setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-nodered`]: false }));
    }
  }, [getSshValue, handleAction, handleAutoPorts]);

  const handleNodeRedStop = useCallback(async (deviceId) => {
    await handleAction(deviceId, 'ssh-tunnel', { action: 'stop', name: 'nodered' });
  }, [handleAction]);

  const handleWebSshOpen = useCallback(async (deviceId) => {
    const host = normalizeHost(getSshValue(deviceId, 'host'));
    const user = String(getSshValue(deviceId, 'user')).trim();
    let remotePort = parsePort(getSshValue(deviceId, 'web_ssh_port'));
    const tunnelPort = parsePort(getSshValue(deviceId, 'tunnel_port'));
    const keyPath = String(getSshValue(deviceId, 'key_path')).trim();

    if (!host || !user) {
      setError('Web SSH requires tunnel host and user');
      return;
    }
    if (!remotePort) {
      const updated = await handleAutoPorts(deviceId);
      remotePort = parsePort(updated?.web_ssh_port);
    }
    if (!remotePort) {
      setError('Web SSH tunnel port is missing');
      return;
    }

    setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-webssh`]: true }));
    try {
      await handleAction(deviceId, 'ssh-web', { action: 'start' });
      const payload = {
        action: 'start',
        name: 'webssh',
        host,
        user,
        remote_port: remotePort,
        local_port: 4200,
      };
      if (keyPath) payload.key = keyPath;
      if (tunnelPort) payload.port = tunnelPort;
      await handleAction(deviceId, 'ssh-tunnel', payload);
      await new Promise((r) => setTimeout(r, 5000));
      window.open(`http://${host}:${remotePort}`, '_blank', 'noopener,noreferrer');
    } finally {
      setTunnelLoading((prev) => ({ ...prev, [`${deviceId}-webssh`]: false }));
    }
  }, [getSshValue, handleAction, handleAutoPorts]);

  const handleWebSshStop = useCallback(async (deviceId) => {
    await handleAction(deviceId, 'ssh-web', { action: 'stop' });
    await handleAction(deviceId, 'ssh-tunnel', { action: 'stop', name: 'webssh' });
  }, [handleAction]);

  // Refresh all
  const handleRefreshAll = useCallback(() => {
    loadDevices();
    loadLegacy();
    loadLocations();
    loadCustomers();
    loadAssignments();
    loadTunnelConfigs();
  }, [loadDevices, loadLegacy, loadLocations, loadCustomers, loadAssignments, loadTunnelConfigs]);

  // Get selected device
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || null;

  // Filter devices
  const filteredDevices = devices.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (d.name || d.id).toLowerCase();
      const ip = (d.ip || '').toLowerCase();
      const mac = (d.mac || '').toLowerCase();
      if (!name.includes(q) && !ip.includes(q) && !mac.includes(q)) return false;
    }
    return true;
  });

  const value = {
    // Devices
    devices,
    filteredDevices,
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

    // Legacy
    legacyDevices,
    legacyLoading,
    legacyError,
    handleLegacyUpdate,

    // Selection
    selectedDeviceId,
    setSelectedDeviceId,
    selectedDevice,

    // View
    view,
    setView,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,

    // Locations
    locations,
    locationValue,
    setLocationField,
    handleLocationSave,

    // Customers
    customers,
    loadCustomers,

    // Assignments
    assignments,
    assignmentValue,
    setAssignmentField,
    handleAssignmentSave,

    // Tunnel
    tunnelConfigs,
    tunnelLoading,
    sshValue,
    setSshField,
    handleTunnelSave,
    handleAutoPorts,
    handleSshStart,
    handleSshStop,
    handleNodeRedOpen,
    handleNodeRedStop,
    handleWebSshOpen,
    handleWebSshStop,

    // Refresh
    handleRefreshAll,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  return context;
}

export default DeviceContext;
