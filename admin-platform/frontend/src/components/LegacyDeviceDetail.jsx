import React, { useState } from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery.js';
import CollapsibleSection from './CollapsibleSection.jsx';
import { StatusDot } from './StatusBadge.jsx';
import LocationForm from './LocationForm.jsx';
import { legacyOnlineLabel, formatTimestamp } from '../utils/formatters.js';

export default function LegacyDeviceDetail({
  device,
  onBack,
  handleLegacyUpdate,
  locationValue,
  setLocationField,
  handleLocationSave,
}) {
  const { isMobile } = useBreakpoint();
  const [legacyDraft, setLegacyDraft] = useState({});

  if (!device) {
    return (
      <div className="device-detail-empty">
        <div className="empty-icon">📺</div>
        <h3>Vælg en enhed</h3>
        <p>Klik på en enhed i listen for at se detaljer</p>
      </div>
    );
  }

  const d = device;
  const legacyId = d.ID;
  const draft = legacyDraft[legacyId] || {};
  const urlValue = draft.url !== undefined ? draft.url : (d.Url || '');
  const startValue = draft.hdmistart !== undefined ? draft.hdmistart : (d.hdmistart || '');
  const stopValue = draft.hdmistop !== undefined ? draft.hdmistop : (d.hdmistop || '');
  const delayValue = draft.delay_dmi !== undefined ? draft.delay_dmi : (d.DelayDmi || '');
  const status = legacyOnlineLabel(d.Online);
  const name = d.CompanyName || d.MAC || `Legacy ${legacyId}`;

  function setLegacyField(field, value) {
    setLegacyDraft((prev) => ({
      ...prev,
      [legacyId]: {
        ...(prev[legacyId] || {}),
        [field]: value,
      },
    }));
  }

  return (
    <div className="device-detail">
      {/* Header */}
      <header className="device-detail-header">
        {isMobile && (
          <button className="back-button" onClick={onBack}>
            ← Tilbage
          </button>
        )}
        <div className="device-detail-title-row">
          <StatusDot status={status} size="large" />
          <div className="device-detail-title-info">
            <h2 className="device-detail-name">{name}</h2>
            <div className="device-detail-meta">
              {d.MAC || '-'}
            </div>
          </div>
        </div>
        <div className="device-detail-badges">
          <span className={`pill ${status}`}>{status}</span>
          <span className="pill">ID {legacyId}</span>
          {d.ZipCode && <span className="pill">ZIP {d.ZipCode}</span>}
        </div>
      </header>

      {/* Status */}
      <CollapsibleSection title="Status" defaultOpen={!isMobile}>
        <div className="stats">
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
      </CollapsibleSection>

      {/* Quick Actions */}
      <CollapsibleSection title="Hurtige handlinger" defaultOpen={true}>
        <div className="action-grid">
          <button onClick={() => handleLegacyUpdate(legacyId, { support: 1 })}>
            Support (VNC)
          </button>
          <button
            className="danger"
            onClick={() => handleLegacyUpdate(legacyId, { support: 2 })}
          >
            Genstart
          </button>
          <button onClick={() => handleLegacyUpdate(legacyId, { tv_on: 1 })}>
            TV Tænd
          </button>
          <button onClick={() => handleLegacyUpdate(legacyId, { tv_on: 0 })}>
            TV Sluk
          </button>
        </div>

        <div className="url-set" style={{ marginTop: 'var(--space-md)' }}>
          <input
            type="text"
            placeholder="https://example.com"
            value={urlValue}
            onChange={(e) => setLegacyField('url', e.target.value)}
          />
          <button
            className="primary"
            onClick={() => handleLegacyUpdate(legacyId, { url: urlValue })}
          >
            Gem URL
          </button>
        </div>
      </CollapsibleSection>

      {/* Location */}
      <CollapsibleSection title="Lokation" defaultOpen={false}>
        <LocationForm
          kind="legacy"
          id={legacyId}
          locationValue={locationValue}
          setLocationField={setLocationField}
          handleLocationSave={handleLocationSave}
        />
      </CollapsibleSection>

      {/* HDMI Schedule */}
      <CollapsibleSection title="HDMI Tidsplan" defaultOpen={false}>
        <div className="schedule-form">
          <div className="schedule-row">
            <div className="schedule-field">
              <label>Start</label>
              <input
                type="time"
                value={startValue}
                onChange={(e) => setLegacyField('hdmistart', e.target.value)}
              />
            </div>
            <div className="schedule-field">
              <label>Stop</label>
              <input
                type="time"
                value={stopValue}
                onChange={(e) => setLegacyField('hdmistop', e.target.value)}
              />
            </div>
            <div className="schedule-field">
              <label>Forsinkelse</label>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={delayValue}
                onChange={(e) => setLegacyField('delay_dmi', e.target.value)}
              />
            </div>
          </div>
          <button
            className="primary"
            onClick={() =>
              handleLegacyUpdate(legacyId, {
                hdmistart: startValue || null,
                hdmistop: stopValue || null,
                delay_dmi: delayValue === '' ? null : Number(delayValue),
              })
            }
          >
            Gem Tidsplan
          </button>
        </div>
      </CollapsibleSection>

      {/* Notes */}
      <CollapsibleSection title="Noter" defaultOpen={false}>
        <div className="info-grid">
          <div>
            <span>Beskrivelse</span>
            <strong>{d.description || '-'}</strong>
          </div>
          <div>
            <span>Opdateret</span>
            <strong>{formatTimestamp(d.timestamp)}</strong>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
