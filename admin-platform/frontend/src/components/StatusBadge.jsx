import React from 'react';

export default function StatusBadge({ status, size = 'medium' }) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <span className={`status-badge ${normalizedStatus} ${size}`}>
      <span className="status-dot" />
      <span className="status-text">{getStatusLabel(normalizedStatus)}</span>
    </span>
  );
}

export function StatusDot({ status, size = 'medium' }) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <span
      className={`status-dot-only ${normalizedStatus} ${size}`}
      title={getStatusLabel(normalizedStatus)}
    />
  );
}

function normalizeStatus(status) {
  if (!status) return 'unknown';
  const s = String(status).toLowerCase();
  if (s === 'online' || s === 'active' || s === 'connected') return 'online';
  if (s === 'offline' || s === 'inactive' || s === 'disconnected') return 'offline';
  if (s === 'pending' || s === 'waiting') return 'pending';
  return 'unknown';
}

function getStatusLabel(status) {
  switch (status) {
    case 'online': return 'Online';
    case 'offline': return 'Offline';
    case 'pending': return 'Afventer';
    default: return 'Ukendt';
  }
}
