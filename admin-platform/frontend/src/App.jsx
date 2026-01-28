import React from 'react';
import { DeviceProvider, useDeviceContext } from './context/DeviceContext.jsx';
import { useBreakpoint } from './hooks/useMediaQuery.js';
import Layout from './components/Layout.jsx';
import DeviceList from './components/DeviceList.jsx';
import DeviceDetail from './components/DeviceDetail.jsx';
import { LegacyDevices, CustomerSection } from './components/index.js';

function DevicesView() {
  const { isMobile } = useBreakpoint();
  const { selectedDeviceId } = useDeviceContext();

  // On mobile, show either list or detail (full-screen)
  if (isMobile) {
    if (selectedDeviceId) {
      return <DeviceDetail />;
    }
    return <DeviceList />;
  }

  // On tablet/desktop, show master-detail layout
  return (
    <div className="master-detail">
      <div className="master-panel">
        <DeviceList />
      </div>
      <div className="detail-panel">
        <DeviceDetail />
      </div>
    </div>
  );
}

function LegacyView() {
  const {
    legacyDevices,
    legacyError,
    legacyLoading,
    handleLegacyUpdate,
    locationValue,
    setLocationField,
    handleLocationSave,
  } = useDeviceContext();

  return (
    <LegacyDevices
      legacyDevices={legacyDevices}
      legacyError={legacyError}
      legacyLoading={legacyLoading}
      handleLegacyUpdate={handleLegacyUpdate}
      locationValue={locationValue}
      setLocationField={setLocationField}
      handleLocationSave={handleLocationSave}
    />
  );
}

function CustomersView() {
  const { customers, loadCustomers, setError } = useDeviceContext();

  return (
    <CustomerSection
      customers={customers}
      loadCustomers={loadCustomers}
      setError={setError}
    />
  );
}

function AppContent() {
  const { view } = useDeviceContext();

  return (
    <Layout>
      {view === 'devices' && <DevicesView />}
      {view === 'legacy' && <LegacyView />}
      {view === 'customers' && <CustomersView />}
    </Layout>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AppContent />
    </DeviceProvider>
  );
}
