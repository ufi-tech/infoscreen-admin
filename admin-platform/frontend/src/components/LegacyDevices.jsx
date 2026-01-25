import React, { useState } from 'react';
import { legacyOnlineLabel, formatTimestamp } from '../utils/formatters.js';
import LocationForm from './LocationForm.jsx';

export default function LegacyDevices({
  legacyDevices,
  legacyError,
  legacyLoading,
  handleLegacyUpdate,
  // Location props
  locationValue,
  setLocationField,
  handleLocationSave,
}) {
  const [legacyDraft, setLegacyDraft] = useState({});

  function setLegacyField(id, field, value) {
    setLegacyDraft((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  }

  return (
    <>
      {legacyError && <div className="notice error">{legacyError}</div>}
      {legacyLoading && <div className="notice info">Loading legacy devices...</div>}

      <div className="grid">
        {legacyDevices.map((d, index) => {
          const legacyId = d.ID;
          const draft = legacyDraft[legacyId] || {};
          const urlValue = draft.url !== undefined ? draft.url : (d.Url || '');
          const startValue = draft.hdmistart !== undefined ? draft.hdmistart : (d.hdmistart || '');
          const stopValue = draft.hdmistop !== undefined ? draft.hdmistop : (d.hdmistop || '');
          const delayValue = draft.delay_dmi !== undefined ? draft.delay_dmi : (d.DelayDmi || '');
          const onlineLabel = legacyOnlineLabel(d.Online);

          return (
            <article
              className="card legacy-card"
              key={legacyId}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <header className="card-header">
                <div>
                  <div className="title">{d.CompanyName || d.MAC || `Legacy ${legacyId}`}</div>
                  <div className="meta">{d.MAC || '-'}</div>
                </div>
                <div className={`pill ${onlineLabel}`}>{onlineLabel}</div>
              </header>

              <div className="chip-row">
                <span className="chip">ID {legacyId}</span>
                {d.ZipCode && <span className="chip">ZIP {d.ZipCode}</span>}
              </div>

              <div className="section">
                <h4>Status</h4>
                <div className="info-grid">
                  <div>
                    <span>IP</span>
                    <strong>{d.IP || '-'}</strong>
                  </div>
                  <div>
                    <span>WAN</span>
                    <strong>{d.wan || '-'}</strong>
                  </div>
                  <div>
                    <span>Support</span>
                    <strong>{d.Support ?? '-'}</strong>
                  </div>
                  <div>
                    <span>TV</span>
                    <strong>{String(d.TVON ?? '-')}</strong>
                  </div>
                </div>
              </div>

              <LocationForm
                kind="legacy"
                id={legacyId}
                locationValue={locationValue}
                setLocationField={setLocationField}
                handleLocationSave={handleLocationSave}
              />

              <div className="section">
                <h4>Quick Actions</h4>
                <div className="action-grid">
                  <button onClick={() => handleLegacyUpdate(legacyId, { support: 1 })}>
                    Support (VNC)
                  </button>
                  <button className="danger" onClick={() => handleLegacyUpdate(legacyId, { support: 2 })}>
                    Reboot
                  </button>
                  <button onClick={() => handleLegacyUpdate(legacyId, { tv_on: 1 })}>
                    TV On
                  </button>
                  <button onClick={() => handleLegacyUpdate(legacyId, { tv_on: 0 })}>
                    TV Off
                  </button>
                </div>
              </div>

              <div className="section">
                <h4>URL</h4>
                <div className="url-set">
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={urlValue}
                    onChange={(e) => setLegacyField(legacyId, 'url', e.target.value)}
                  />
                  <button
                    className="primary"
                    onClick={() => handleLegacyUpdate(legacyId, { url: urlValue })}
                  >
                    Save URL
                  </button>
                </div>
              </div>

              <div className="section">
                <h4>HDMI Schedule</h4>
                <div className="schedule-grid">
                  <input
                    type="time"
                    value={startValue}
                    onChange={(e) => setLegacyField(legacyId, 'hdmistart', e.target.value)}
                  />
                  <input
                    type="time"
                    value={stopValue}
                    onChange={(e) => setLegacyField(legacyId, 'hdmistop', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Delay"
                    value={delayValue}
                    onChange={(e) => setLegacyField(legacyId, 'delay_dmi', e.target.value)}
                  />
                  <button
                    className="primary"
                    onClick={() => handleLegacyUpdate(legacyId, {
                      hdmistart: startValue || null,
                      hdmistop: stopValue || null,
                      delay_dmi: delayValue === '' ? null : Number(delayValue),
                    })}
                  >
                    Save Schedule
                  </button>
                </div>
              </div>

              <div className="section">
                <h4>Notes</h4>
                <div className="legacy-notes">
                  <div>
                    <span>Description</span>
                    <strong>{d.description || '-'}</strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>{formatTimestamp(d.timestamp)}</strong>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
