import React, { useState } from 'react';

export default function DeviceActions({
  deviceId,
  handleAction,
  handleConfirm,
}) {
  const [urlDraft, setUrlDraft] = useState('');

  return (
    <>
      <div className="section">
        <h4>Quick Actions</h4>
        <div className="action-grid">
          <button
            className="danger"
            onClick={() => handleConfirm(deviceId, 'reboot', 'Reboot this device?')}
          >
            Reboot
          </button>
          <button
            onClick={() => handleConfirm(deviceId, 'restart-nodered', 'Restart Node-RED?')}
          >
            Restart Node-RED
          </button>
          <button
            onClick={() => handleConfirm(deviceId, 'restart-chromium', 'Restart Chromium?')}
          >
            Restart Chromium
          </button>
        </div>
      </div>

      <div className="section">
        <h4>Diagnostics</h4>
        <div className="action-grid">
          <button onClick={() => handleAction(deviceId, 'screenshot', { mode: 'base64' })}>Screenshot</button>
          <button onClick={() => handleAction(deviceId, 'wifi-scan')}>WiFi Scan</button>
          <button onClick={() => handleAction(deviceId, 'get-info')}>Get Info</button>
          <button onClick={() => handleAction(deviceId, 'log-tail')}>Log Tail</button>
          <button onClick={() => handleAction(deviceId, 'get-location')}>Get Location</button>
        </div>
      </div>

      <div className="section">
        <h4>Set Display URL</h4>
        <div className="url-set">
          <input
            type="text"
            placeholder="https://example.com"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <button
            className="primary"
            onClick={() => handleAction(deviceId, 'set-url', { url: urlDraft })}
          >
            Set URL
          </button>
        </div>
      </div>
    </>
  );
}
