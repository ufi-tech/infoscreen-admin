import React from 'react';
import { useBreakpoint } from '../hooks/useMediaQuery.js';
import { useDeviceContext } from '../context/DeviceContext.jsx';
import BottomNav from './BottomNav.jsx';
import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  const { isMobile, isTablet } = useBreakpoint();
  const { view, setView, handleRefreshAll, error, setError } = useDeviceContext();

  return (
    <div className="layout">
      {!isMobile && (
        <Sidebar
          view={view}
          onViewChange={setView}
          collapsed={isTablet}
        />
      )}

      <main className="main-content">
        {isMobile && (
          <header className="mobile-header">
            <h1 className="mobile-title">Infoscreen Admin</h1>
            <button className="refresh-btn" onClick={handleRefreshAll}>
              Opdater
            </button>
          </header>
        )}

        {error && (
          <div className="notice error" onClick={() => setError('')}>
            {error}
          </div>
        )}

        <div className="content-area">
          {children}
        </div>
      </main>

      {isMobile && (
        <BottomNav view={view} onViewChange={setView} />
      )}
    </div>
  );
}
