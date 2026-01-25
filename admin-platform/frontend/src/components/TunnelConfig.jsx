import React from 'react';
import { normalizeHost, parsePort, parseTunnelStatus, latestEvent } from '../utils/formatters.js';

export default function TunnelConfig({
  deviceId,
  events,
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
  const deviceEvents = events || [];
  const tunnelEvent = latestEvent(deviceEvents, 'ssh-tunnel');
  const tunnelStatus = parseTunnelStatus(tunnelEvent);
  const sshHost = normalizeHost(sshValue(deviceId, 'host'));
  const sshUser = String(sshValue(deviceId, 'user') || '').trim();
  const sshPort = parsePort(sshValue(deviceId, 'ssh_port'));
  const tunnelReady = Boolean(sshHost && sshUser);

  return (
    <>
      <div className="section">
        <h4>Reverse SSH</h4>
        <div className="ssh-grid">
          <input
            type="text"
            placeholder="host (ex: tunnel.ufi-tech.dk)"
            value={sshValue(deviceId, 'host')}
            onChange={(e) => setSshField(deviceId, 'host', e.target.value)}
          />
          <input
            type="text"
            placeholder="user"
            value={sshValue(deviceId, 'user')}
            onChange={(e) => setSshField(deviceId, 'user', e.target.value)}
          />
          <input
            type="text"
            placeholder="tunnel port (default 2222)"
            value={sshValue(deviceId, 'tunnel_port')}
            onChange={(e) => setSshField(deviceId, 'tunnel_port', e.target.value)}
          />
          <input
            type="text"
            placeholder="SSH port (tunnel)"
            value={sshValue(deviceId, 'ssh_port')}
            onChange={(e) => setSshField(deviceId, 'ssh_port', e.target.value)}
          />
          <input
            type="text"
            placeholder="local port (default 22)"
            value={sshValue(deviceId, 'local_port')}
            onChange={(e) => setSshField(deviceId, 'local_port', e.target.value)}
          />
          <input
            type="text"
            placeholder="key path (/home/pi/.ssh/id_tunnel)"
            value={sshValue(deviceId, 'key_path')}
            onChange={(e) => setSshField(deviceId, 'key_path', e.target.value)}
          />
          <input
            type="text"
            placeholder="tunnel name (default admin)"
            value={sshValue(deviceId, 'name')}
            onChange={(e) => setSshField(deviceId, 'name', e.target.value)}
          />
        </div>
        <div className="action-grid">
          <button
            className="primary"
            onClick={() => handleSshStart(deviceId)}
            disabled={!tunnelReady || tunnelLoading[`${deviceId}-ssh`]}
          >
            {tunnelLoading[`${deviceId}-ssh`] ? 'Starting...' : 'Start Tunnel'}
          </button>
          <button onClick={() => handleSshStop(deviceId)}>
            Stop Tunnel
          </button>
          <button onClick={() => handleTunnelSave(deviceId)} disabled={!tunnelReady}>
            Save Tunnel Settings
          </button>
          <button onClick={() => handleAutoPorts(deviceId)}>
            Auto Ports
          </button>
        </div>
        {!tunnelReady && (
          <div className="hint">Set tunnel host + user first, then save settings.</div>
        )}
      </div>

      <div className="section">
        <h4>Remote Access</h4>
        <div className="chip-row">
          <span className="chip">
            Tunnel config {tunnelReady ? 'ready' : 'missing'}
          </span>
          <span className="chip">Tunnel {tunnelStatus}</span>
        </div>
        <div className="ssh-grid">
          <input
            type="text"
            placeholder="Node-RED port (tunnel)"
            value={sshValue(deviceId, 'nodered_port')}
            onChange={(e) => setSshField(deviceId, 'nodered_port', e.target.value)}
          />
          <input
            type="text"
            placeholder="Web SSH port (tunnel)"
            value={sshValue(deviceId, 'web_ssh_port')}
            onChange={(e) => setSshField(deviceId, 'web_ssh_port', e.target.value)}
          />
        </div>
        <div className="action-grid">
          <button
            className="primary"
            onClick={() => handleNodeRedOpen(deviceId)}
            disabled={!tunnelReady || tunnelLoading[`${deviceId}-nodered`]}
          >
            {tunnelLoading[`${deviceId}-nodered`] ? 'Opening...' : 'Open Node-RED (Tunnel)'}
          </button>
          <button onClick={() => handleNodeRedStop(deviceId)}>
            Stop Node-RED Tunnel
          </button>
          <button
            className="primary"
            onClick={() => handleWebSshOpen(deviceId)}
            disabled={!tunnelReady || tunnelLoading[`${deviceId}-webssh`]}
          >
            {tunnelLoading[`${deviceId}-webssh`] ? 'Opening...' : 'Open Web SSH (Tunnel)'}
          </button>
          <button onClick={() => handleWebSshStop(deviceId)}>
            Stop Web SSH Tunnel
          </button>
        </div>
        <div className="hint">Tunnel opens automatically when you click Open.</div>
        {tunnelReady && !sshPort && (
          <div className="hint">No SSH port yet - click Auto Ports to assign.</div>
        )}
        <div className="hint">Node-RED and Web SSH are only accessible via SSH tunnel (not from LAN).</div>
        {sshHost && sshPort && (
          <div className="hint">
            SSH command: <code>{`ssh -p ${sshPort} pi@${sshHost}`}</code>
          </div>
        )}
      </div>
    </>
  );
}
