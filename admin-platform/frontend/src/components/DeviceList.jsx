import React from 'react';
import { useDeviceContext } from '../context/DeviceContext.jsx';
import DeviceListItem from './DeviceListItem.jsx';
import SearchFilter from './SearchFilter.jsx';

export default function DeviceList() {
  const {
    devices,
    filteredDevices,
    telemetry,
    loading,
    selectedDeviceId,
    setSelectedDeviceId,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    customers,
    assignments,
  } = useDeviceContext();

  // Get customer for device
  const getCustomer = (deviceId) => {
    const customerId = assignments.device[deviceId];
    if (!customerId) return null;
    return customers.find((c) => c.id === customerId);
  };

  if (loading && devices.length === 0) {
    return (
      <div className="device-list-loading">
        <div className="loading-spinner" />
        <p>Indlaeser enheder...</p>
      </div>
    );
  }

  return (
    <div className="device-list-container">
      <SearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        deviceCount={devices.length}
        filteredCount={filteredDevices.length}
      />

      <div className="device-list">
        {filteredDevices.length === 0 ? (
          <div className="device-list-empty">
            {searchQuery || statusFilter !== 'all'
              ? 'Ingen enheder matcher filteret'
              : 'Ingen enheder fundet'}
          </div>
        ) : (
          filteredDevices.map((device) => (
            <DeviceListItem
              key={device.id}
              device={device}
              telemetry={telemetry[device.id]}
              customer={getCustomer(device.id)}
              selected={selectedDeviceId === device.id}
              onClick={() => setSelectedDeviceId(device.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
