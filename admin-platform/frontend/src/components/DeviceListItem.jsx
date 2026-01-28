import React from 'react';
import { StatusDot } from './StatusBadge.jsx';
import { formatTimestamp } from '../utils/formatters.js';

export default function DeviceListItem({
  device,
  telemetry,
  customer,
  selected,
  onClick,
}) {
  const d = device;
  const t = telemetry || {};
  const ip = d.ip || t.ip || t.ipv4 || '-';
  const mac = d.mac ? `${d.mac.slice(0, 8)}...` : '';

  return (
    <article
      className={`device-list-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="device-list-item-left">
        <StatusDot status={d.status} size="medium" />
        <div className="device-list-item-info">
          <div className="device-list-item-name">
            {d.name || d.id.slice(0, 12)}
            {!d.approved && <span className="pending-badge">Ny</span>}
          </div>
          <div className="device-list-item-meta">
            {ip}
            {mac && <span className="meta-separator">·</span>}
            {mac}
          </div>
        </div>
      </div>

      <div className="device-list-item-right">
        {customer && (
          <span className="customer-badge">{customer.name}</span>
        )}
        <div className="device-list-item-time">
          {formatRelativeTime(d.last_seen)}
        </div>
        <span className="chevron">›</span>
      </div>
    </article>
  );
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '-';

  const now = Date.now();
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = now - ts;

  if (diff < 60000) return 'nu';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} timer`;
  return formatTimestamp(timestamp);
}
