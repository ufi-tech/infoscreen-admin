import { useCallback, useEffect, useState } from 'react';
import {
  approveDevice,
  fetchDevices,
  fetchEvents,
  fetchTelemetry,
  sendCommand,
} from '../api.js';

export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [events, setEvents] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  return {
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
  };
}
