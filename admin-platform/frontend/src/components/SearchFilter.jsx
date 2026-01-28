import React from 'react';

export default function SearchFilter({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  deviceCount,
  filteredCount,
}) {
  return (
    <div className="search-filter">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Sog efter navn, IP eller MAC..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => onSearchChange('')}
          >
            x
          </button>
        )}
      </div>

      <div className="filter-buttons">
        <button
          className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => onStatusChange('all')}
        >
          Alle
        </button>
        <button
          className={`filter-btn ${statusFilter === 'online' ? 'active' : ''}`}
          onClick={() => onStatusChange('online')}
        >
          Online
        </button>
        <button
          className={`filter-btn ${statusFilter === 'offline' ? 'active' : ''}`}
          onClick={() => onStatusChange('offline')}
        >
          Offline
        </button>
      </div>

      <div className="filter-count">
        {filteredCount === deviceCount
          ? `${deviceCount} enheder`
          : `${filteredCount} af ${deviceCount} enheder`}
      </div>
    </div>
  );
}
