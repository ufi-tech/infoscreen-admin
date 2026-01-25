import { useCallback, useState } from 'react';
import {
  allocateTunnelPorts,
  fetchTunnelConfigs,
  saveTunnelConfig,
} from '../api.js';
import { normalizeHost, parsePort } from '../utils/formatters.js';

export function useTunnel(handleAction, refreshEvents, setError) {
  const [tunnelConfigs, setTunnelConfigs] = useState({});
  const [sshDraft, setSshDraft] = useState({});
  const [tunnelLoading, setTunnelLoading] = useState({});

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
  }, [setError]);

  // Helper to get SSH value from draft or config
  const getSshValue = useCallback((deviceId, field) => {
    const draft = sshDraft[deviceId] || {};
    if (Object.prototype.hasOwnProperty.call(draft, field)) {
      const value = draft[field];
      if (value !== '' && value !== null && value !== undefined) {
        return value;
      }
    }
    const config = tunnelConfigs[deviceId] || {};
    const value = config[field];
    if (value === null || value === undefined) return '';
    return String(value);
  }, [sshDraft, tunnelConfigs]);

  // Public sshValue function (non-memoized for use in components)
  function sshValue(deviceId, field) {
    return getSshValue(deviceId, field);
  }

  function setSshField(deviceId, field, value) {
    setSshDraft((prev) => ({
      ...prev,
      [deviceId]: {
        ...(prev[deviceId] || {}),
        [field]: value,
      },
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
  }, [getSshValue, setError]);

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
  }, [setError]);

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
  }, [getSshValue, handleAction, handleAutoPorts, refreshEvents, setError]);

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
  }, [getSshValue, handleAction, handleAutoPorts, setError]);

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
  }, [getSshValue, handleAction, handleAutoPorts, setError]);

  const handleWebSshStop = useCallback(async (deviceId) => {
    await handleAction(deviceId, 'ssh-web', { action: 'stop' });
    await handleAction(deviceId, 'ssh-tunnel', { action: 'stop', name: 'webssh' });
  }, [handleAction]);

  return {
    tunnelConfigs,
    tunnelLoading,
    loadTunnelConfigs,
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
  };
}
