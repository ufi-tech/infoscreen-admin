import React from 'react';

const NAV_ITEMS = [
  { id: 'devices', label: 'Enheder', icon: '📡' },
  { id: 'legacy', label: 'Legacy', icon: '📺' },
  { id: 'customers', label: 'Kunder', icon: '👥' },
];

export default function BottomNav({ view, onViewChange }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`bottom-nav-item ${view === item.id ? 'active' : ''}`}
          onClick={() => onViewChange(item.id)}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
