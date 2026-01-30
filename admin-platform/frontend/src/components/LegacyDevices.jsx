import React, { useState } from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery.js';
import LegacyDeviceList from './LegacyDeviceList.jsx';
import LegacyDeviceDetail from './LegacyDeviceDetail.jsx';

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
  const { isMobile } = useBreakpoint();
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Find the selected device
  const selectedDevice = legacyDevices.find((d) => d.ID === selectedId);

  // On mobile, show either list or detail (not both)
  const showList = !isMobile || !selectedId;
  const showDetail = !isMobile || selectedId;

  return (
    <>
      {legacyError && <div className="notice error">{legacyError}</div>}
      {legacyLoading && <div className="notice info">Indlæser legacy enheder...</div>}

      <div className="master-detail">
        {showList && (
          <div className="master-panel">
            <LegacyDeviceList
              devices={legacyDevices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </div>
        )}
        {showDetail && (
          <div className="detail-panel">
            <LegacyDeviceDetail
              device={selectedDevice}
              onBack={() => setSelectedId(null)}
              handleLegacyUpdate={handleLegacyUpdate}
              locationValue={locationValue}
              setLocationField={setLocationField}
              handleLocationSave={handleLocationSave}
            />
          </div>
        )}
      </div>
    </>
  );
}
