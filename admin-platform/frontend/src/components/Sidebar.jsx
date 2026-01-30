import React from 'react';

const NAV_ITEMS = [
  { id: 'devices', label: 'MQTT Enheder', icon: '\uD83D\uDCE1' },
  { id: 'android', label: 'Android/TV', icon: '\uD83D\uDCF1' },
  { id: 'legacy', label: 'Legacy Enheder', icon: '\uD83D\uDCFA' },
  { id: 'customers', label: 'Kunder', icon: '\uD83D\uDC65' },
];

export default function Sidebar({ view, onViewChange, collapsed = false }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          {collapsed ? 'IA' : 'Infoscreen Admin'}
        </h2>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${view === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-hint">
          {collapsed ? '8s' : 'Auto-refresh: 8s'}
        </div>
      </div>
    </aside>
  );
}
