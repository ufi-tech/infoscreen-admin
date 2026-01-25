import { useState, useEffect } from 'react';
import { fetchDeviceLogs, fetchLogs } from '../api';

const LEVEL_COLORS = {
  info: '#3498db',
  success: '#27ae60',
  warning: '#f39c12',
  error: '#e74c3c',
};

const LEVEL_ICONS = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '✕',
};

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function DeviceLogs({ deviceId, limit = 20 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!deviceId) return;

    async function loadLogs() {
      try {
        const data = await fetchDeviceLogs(deviceId, expanded ? 50 : limit);
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
    const interval = setInterval(loadLogs, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [deviceId, limit, expanded]);

  if (loading && logs.length === 0) {
    return <div className="hint">Indlæser log...</div>;
  }

  if (logs.length === 0) {
    return <div className="hint">Ingen log endnu</div>;
  }

  return (
    <div className="device-logs">
      <div className="logs-list">
        {logs.slice(0, expanded ? 50 : limit).map((log) => (
          <div key={log.id} className="log-entry" data-level={log.level}>
            <span
              className="log-icon"
              style={{ backgroundColor: LEVEL_COLORS[log.level] || '#999' }}
            >
              {LEVEL_ICONS[log.level] || '•'}
            </span>
            <span className="log-time">{formatTime(log.timestamp)}</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
      {logs.length > limit && (
        <button
          className="secondary"
          onClick={() => setExpanded(!expanded)}
          style={{ marginTop: '8px', padding: '4px 12px', fontSize: '12px' }}
        >
          {expanded ? 'Vis mindre' : `Vis alle (${logs.length})`}
        </button>
      )}
    </div>
  );
}

export function GlobalLogs({ hours = 24, limit = 100 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ level: '', category: '' });

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await fetchLogs({
          hours,
          limit,
          level: filter.level || undefined,
          category: filter.category || undefined,
        });
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
    const interval = setInterval(loadLogs, 15000);
    return () => clearInterval(interval);
  }, [hours, limit, filter]);

  return (
    <div className="global-logs">
      <div className="logs-filters" style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <select
          value={filter.level}
          onChange={(e) => setFilter({ ...filter, level: e.target.value })}
          style={{ padding: '4px 8px' }}
        >
          <option value="">Alle levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          style={{ padding: '4px 8px' }}
        >
          <option value="">Alle kategorier</option>
          <option value="status">Status</option>
          <option value="command">Kommando</option>
          <option value="mqtt">MQTT</option>
          <option value="user">Bruger</option>
        </select>
      </div>

      {loading && logs.length === 0 ? (
        <div className="hint">Indlæser log...</div>
      ) : logs.length === 0 ? (
        <div className="hint">Ingen log fundet</div>
      ) : (
        <div className="logs-list">
          {logs.map((log) => (
            <div key={log.id} className="log-entry" data-level={log.level}>
              <span
                className="log-icon"
                style={{ backgroundColor: LEVEL_COLORS[log.level] || '#999' }}
              >
                {LEVEL_ICONS[log.level] || '•'}
              </span>
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className="log-device">
                {log.device_id ? log.device_id.slice(0, 8) : log.legacy_id ? `Legacy #${log.legacy_id}` : ''}
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DeviceLogs;
