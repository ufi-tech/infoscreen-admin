import React from 'react';
import { StatusDot } from './StatusBadge.jsx';
import { legacyOnlineLabel } from '../utils/formatters.js';

export default function LegacyDeviceList({
  devices,
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) {
  // Filter devices based on search and status
  const filtered = devices.filter((d) => {
    const name = d.CompanyName || d.MAC || '';
    const mac = d.MAC || '';
    const ip = d.IP || '';
    const matchesSearch =
      !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mac.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip.toLowerCase().includes(searchTerm.toLowerCase());

    const status = legacyOnlineLabel(d.Online);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && status === 'online') ||
      (statusFilter === 'offline' && status === 'offline');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="device-list-container">
      <div className="device-list-header">
        <input
          type="text"
          className="device-search"
          placeholder="Søg efter navn, IP eller MAC..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="status-filters">
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('all')}
          >
            Alle
          </button>
          <button
            className={`filter-btn ${statusFilter === 'online' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('online')}
          >
            Online
          </button>
          <button
            className={`filter-btn ${statusFilter === 'offline' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('offline')}
          >
            Offline
          </button>
        </div>
        <div className="device-count">{filtered.length} enheder</div>
      </div>

      <div className="device-list">
        {filtered.length === 0 ? (
          <div className="device-list-empty">Ingen enheder fundet</div>
        ) : (
          filtered.map((d) => {
            const legacyId = d.ID;
            const status = legacyOnlineLabel(d.Online);
            const name = d.CompanyName || d.MAC || `Legacy ${legacyId}`;
            const subtitle = d.IP ? `${d.IP}${d.ZipCode ? ` · ${d.ZipCode}` : ''}` : '-';

            return (
              <article
                key={legacyId}
                className={`device-list-item ${selectedId === legacyId ? 'selected' : ''}`}
                onClick={() => onSelect(legacyId)}
              >
                <div className="device-list-item-left">
                  <StatusDot status={status} />
                  <div className="device-list-item-info">
                    <div className="device-list-item-name">{name}</div>
                    <div className="device-list-item-meta">{subtitle}</div>
                  </div>
                </div>
                <div className="device-list-item-right">
                  <div className="device-list-item-time">ID {legacyId}</div>
                  <div className="device-list-item-chevron">›</div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
