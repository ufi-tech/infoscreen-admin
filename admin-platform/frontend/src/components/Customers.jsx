import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchCustomers,
  createCustomer,
  deleteCustomer,
  fetchCustomerDevices,
  assignDeviceToCustomer,
  removeDeviceFromCustomer,
  fetchUnassignedDevices,
  provisionCustomerCms,
  fetchCmsCredentials,
  stopCustomerCms,
  startCustomerCms,
} from '../api.js';
import StatusBadge from './StatusBadge.jsx';
import CollapsibleSection from './CollapsibleSection.jsx';

// ============================================================================
// Customer List Item
// ============================================================================

function CustomerListItem({ customer, selected, onClick }) {
  return (
    <div
      className={`customer-list-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="customer-info">
        <strong>{customer.name}</strong>
        {customer.cms_subdomain && (
          <span className="cms-badge">{customer.cms_subdomain}</span>
        )}
      </div>
      <div className="customer-meta">
        <span className="device-count">
          {customer.device_count || 0} enheder
        </span>
        {customer.cms_status && customer.cms_status !== 'none' && (
          <span className={`cms-status cms-${customer.cms_status}`}>
            {customer.cms_status}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Device Assignment Card
// ============================================================================

function DeviceAssignmentCard({ assignment, onRemove }) {
  const device = assignment.device;

  return (
    <div className="device-assignment-card">
      <div className="assignment-header">
        <StatusBadge status={device?.status || 'unknown'} />
        <span className="device-name">{device?.name || assignment.device_id}</span>
        <button
          className="btn-icon danger"
          onClick={() => onRemove(assignment.device_id)}
          title="Fjern enhed"
        >
          &times;
        </button>
      </div>
      <div className="assignment-details">
        {device?.ip && <span className="device-ip">{device.ip}</span>}
        {assignment.display_url && (
          <a
            href={assignment.display_url}
            target="_blank"
            rel="noopener noreferrer"
            className="display-url"
          >
            {assignment.screen_uuid || 'Se skærm'}
          </a>
        )}
      </div>
      {assignment.assigned_at && (
        <div className="assignment-footer">
          Tildelt: {new Date(assignment.assigned_at).toLocaleDateString('da-DK')}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CMS Management Section
// ============================================================================

function CMSManagementSection({ customer, onRefresh }) {
  const [provisioning, setProvisioning] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [error, setError] = useState(null);
  const [cmsAction, setCmsAction] = useState(null);

  // Auto-generate subdomain from customer name
  useEffect(() => {
    if (!customer.cms_subdomain && customer.name) {
      const generated = customer.name
        .toLowerCase()
        .replace(/[æ]/g, 'ae')
        .replace(/[ø]/g, 'oe')
        .replace(/[å]/g, 'aa')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSubdomain(generated);
    }
  }, [customer]);

  const handleProvision = async () => {
    if (!subdomain) {
      setError('Subdomain er påkrævet');
      return;
    }

    setProvisioning(true);
    setError(null);

    try {
      const result = await provisionCustomerCms(customer.id, subdomain, customer.name);
      setCredentials({
        admin_username: result.admin_username,
        admin_password: result.admin_password,
        cms_url: result.cms_url,
        login_url: result.login_url,
        api_key: result.api_key,
      });
      setShowCredentials(true);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleFetchCredentials = async () => {
    try {
      const creds = await fetchCmsCredentials(customer.id);
      setCredentials(creds);
      setShowCredentials(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStopCms = async () => {
    if (!window.confirm('Er du sikker på at du vil stoppe CMS?')) return;
    setCmsAction('stopping');
    try {
      await stopCustomerCms(customer.id);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCmsAction(null);
    }
  };

  const handleStartCms = async () => {
    setCmsAction('starting');
    try {
      await startCustomerCms(customer.id);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCmsAction(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // No CMS configured - show provisioning form
  if (!customer.cms_subdomain || customer.cms_status === 'none') {
    return (
      <CollapsibleSection title="CMS Styring" defaultOpen={true}>
        <div className="cms-provision-form">
          <p className="info-text">
            Opret et CMS til denne kunde. CMS'et vil være tilgængeligt på:
          </p>

          {error && <div className="form-error">{error}</div>}

          <div className="subdomain-input">
            <input
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="subdomain"
              disabled={provisioning}
            />
            <span className="domain-suffix">.screen.iocast.dk</span>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleProvision}
            disabled={provisioning || !subdomain}
          >
            {provisioning ? 'Opretter CMS...' : 'Opret CMS'}
          </button>
        </div>
      </CollapsibleSection>
    );
  }

  // CMS is provisioning
  if (customer.cms_status === 'provisioning') {
    return (
      <CollapsibleSection title="CMS Styring" defaultOpen={true}>
        <div className="cms-provisioning">
          <div className="loading-spinner small" />
          <p>CMS oprettes... Dette kan tage et par minutter.</p>
        </div>
      </CollapsibleSection>
    );
  }

  // CMS is active or stopped
  return (
    <CollapsibleSection title="CMS Styring" defaultOpen={true}>
      <div className="cms-info">
        {error && <div className="form-error">{error}</div>}

        <div className="cms-status-row">
          <span className={`cms-status-badge cms-${customer.cms_status}`}>
            {customer.cms_status === 'active' ? 'Aktiv' :
             customer.cms_status === 'stopped' ? 'Stoppet' :
             customer.cms_status === 'error' ? 'Fejl' :
             customer.cms_status}
          </span>
          <span className="cms-subdomain">{customer.cms_subdomain}.screen.iocast.dk</span>
        </div>

        <div className="cms-links">
          <a
            href={`https://${customer.cms_subdomain}.screen.iocast.dk`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Åbn CMS
          </a>
          <a
            href={`https://${customer.cms_subdomain}.screen.iocast.dk/login`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Login Side
          </a>
        </div>

        {/* Credentials section */}
        <div className="cms-credentials-section">
          {showCredentials && credentials ? (
            <div className="credentials-box">
              <h4>Login Oplysninger</h4>
              <div className="credential-row">
                <label>Brugernavn:</label>
                <span className="mono">{credentials.admin_username || 'admin'}</span>
                <button
                  className="btn-icon copy"
                  onClick={() => copyToClipboard(credentials.admin_username || 'admin')}
                  title="Kopier"
                >
                  📋
                </button>
              </div>
              <div className="credential-row">
                <label>Password:</label>
                <span className="mono password">{credentials.admin_password}</span>
                <button
                  className="btn-icon copy"
                  onClick={() => copyToClipboard(credentials.admin_password)}
                  title="Kopier"
                >
                  📋
                </button>
              </div>
              {credentials.api_key && (
                <div className="credential-row">
                  <label>API Key:</label>
                  <span className="mono api-key">{credentials.api_key.substring(0, 20)}...</span>
                  <button
                    className="btn-icon copy"
                    onClick={() => copyToClipboard(credentials.api_key)}
                    title="Kopier"
                  >
                    📋
                  </button>
                </div>
              )}
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowCredentials(false)}
              >
                Skjul
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={handleFetchCredentials}>
              Vis Login Oplysninger
            </button>
          )}
        </div>

        {/* Control buttons */}
        <div className="cms-controls">
          {customer.cms_status === 'active' && (
            <button
              className="btn btn-warning"
              onClick={handleStopCms}
              disabled={cmsAction}
            >
              {cmsAction === 'stopping' ? 'Stopper...' : 'Stop CMS'}
            </button>
          )}
          {customer.cms_status === 'stopped' && (
            <button
              className="btn btn-success"
              onClick={handleStartCms}
              disabled={cmsAction}
            >
              {cmsAction === 'starting' ? 'Starter...' : 'Start CMS'}
            </button>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ============================================================================
// Customer Detail Panel
// ============================================================================

function CustomerDetail({
  customer,
  devices,
  unassignedDevices,
  onAssignDevice,
  onRemoveDevice,
  onRefresh,
  onCustomerRefresh,
  loading,
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedDeviceId) return;
    setAssigning(true);
    try {
      await onAssignDevice(selectedDeviceId);
      setSelectedDeviceId('');
    } finally {
      setAssigning(false);
    }
  };

  if (!customer) {
    return (
      <div className="customer-detail-empty">
        <p>Vælg en kunde fra listen</p>
      </div>
    );
  }

  return (
    <div className="customer-detail">
      <div className="customer-detail-header">
        <h2>{customer.name}</h2>
        {customer.cms_url && (
          <a
            href={customer.cms_url}
            target="_blank"
            rel="noopener noreferrer"
            className="cms-link"
          >
            {customer.cms_subdomain}.screen.iocast.dk
          </a>
        )}
      </div>

      <div className="customer-contact">
        {customer.contact_name && (
          <div className="contact-item">
            <label>Kontakt:</label>
            <span>{customer.contact_name}</span>
          </div>
        )}
        {customer.email && (
          <div className="contact-item">
            <label>Email:</label>
            <a href={`mailto:${customer.email}`}>{customer.email}</a>
          </div>
        )}
        {customer.phone && (
          <div className="contact-item">
            <label>Telefon:</label>
            <a href={`tel:${customer.phone}`}>{customer.phone}</a>
          </div>
        )}
      </div>

      {/* CMS Management Section */}
      <CMSManagementSection customer={customer} onRefresh={onCustomerRefresh} />

      <div className="customer-devices-section">
        <div className="section-header">
          <h3>Tildelte Enheder ({devices.length})</h3>
          <button className="btn-icon" onClick={onRefresh} title="Opdater">
            ↻
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner small" />
        ) : devices.length === 0 ? (
          <p className="no-devices">Ingen enheder tildelt</p>
        ) : (
          <div className="device-assignments-grid">
            {devices.map((assignment) => (
              <DeviceAssignmentCard
                key={assignment.assignment_id}
                assignment={assignment}
                onRemove={onRemoveDevice}
              />
            ))}
          </div>
        )}

        <div className="assign-device-form">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={assigning || unassignedDevices.length === 0}
          >
            <option value="">
              {unassignedDevices.length === 0
                ? 'Ingen ledige enheder'
                : 'Vælg enhed at tildele...'}
            </option>
            {unassignedDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name || device.id} ({device.status})
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={handleAssign}
            disabled={!selectedDeviceId || assigning}
          >
            {assigning ? 'Tildeler...' : 'Tildel Enhed'}
          </button>
        </div>
      </div>

      {customer.notes && (
        <div className="customer-notes">
          <h3>Noter</h3>
          <p>{customer.notes}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Create Customer Form
// ============================================================================

function CreateCustomerForm({ onCreated, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    notes: '',
    cms_subdomain: '',
    auto_provision: false,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Kundenavn er påkrævet');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createCustomer(formData);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form className="create-customer-form" onSubmit={handleSubmit}>
      <h3>Opret Ny Kunde</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label>Kundenavn *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="F.eks. Vejle Hallerne"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Kontaktperson</label>
          <input
            type="text"
            value={formData.contact_name}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            placeholder="Navn"
          />
        </div>
        <div className="form-group">
          <label>Telefon</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+45 12 34 56 78"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="kunde@example.dk"
        />
      </div>

      <div className="form-group">
        <label>CMS Subdomain</label>
        <div className="input-with-suffix">
          <input
            type="text"
            value={formData.cms_subdomain}
            onChange={(e) => setFormData({ ...formData, cms_subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder="vejle-hallerne"
          />
          <span className="input-suffix">.screen.iocast.dk</span>
        </div>
      </div>

      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.auto_provision}
            onChange={(e) => setFormData({ ...formData, auto_provision: e.target.checked })}
          />
          Auto-opret CMS (kræver subdomain)
        </label>
      </div>

      <div className="form-group">
        <label>Noter</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Interne noter om kunden..."
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Annuller
        </button>
        <button type="submit" className="primary" disabled={creating}>
          {creating ? 'Opretter...' : 'Opret Kunde'}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Main Customers Component
// ============================================================================

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDevices, setCustomerDevices] = useState([]);
  const [unassignedDevices, setUnassignedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load unassigned devices
  const loadUnassignedDevices = useCallback(async () => {
    try {
      const data = await fetchUnassignedDevices();
      setUnassignedDevices(data);
    } catch (err) {
      console.error('Failed to load unassigned devices:', err);
    }
  }, []);

  // Load devices for selected customer
  const loadCustomerDevices = useCallback(async (customerId) => {
    if (!customerId) {
      setCustomerDevices([]);
      return;
    }
    setDevicesLoading(true);
    try {
      const data = await fetchCustomerDevices(customerId);
      setCustomerDevices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCustomers();
    loadUnassignedDevices();
  }, [loadCustomers, loadUnassignedDevices]);

  // Load devices when customer changes
  useEffect(() => {
    loadCustomerDevices(selectedCustomerId);
  }, [selectedCustomerId, loadCustomerDevices]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleAssignDevice = async (deviceId) => {
    if (!selectedCustomerId) return;
    try {
      await assignDeviceToCustomer(selectedCustomerId, deviceId);
      await loadCustomerDevices(selectedCustomerId);
      await loadUnassignedDevices();
      // Update customer count in list
      await loadCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!selectedCustomerId) return;
    if (!window.confirm('Er du sikker på at du vil fjerne denne enhed?')) return;
    try {
      await removeDeviceFromCustomer(selectedCustomerId, deviceId);
      await loadCustomerDevices(selectedCustomerId);
      await loadUnassignedDevices();
      await loadCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCustomerCreated = async () => {
    setShowCreateForm(false);
    await loadCustomers();
  };

  if (loading) {
    return (
      <div className="customers-loading">
        <div className="loading-spinner" />
        <p>Indlæser kunder...</p>
      </div>
    );
  }

  return (
    <div className="customers-container">
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="customers-layout">
        {/* Customer List Panel */}
        <div className="customers-list-panel">
          <div className="panel-header">
            <h2>Kunder ({customers.length})</h2>
            <button
              className="primary"
              onClick={() => setShowCreateForm(true)}
            >
              + Ny Kunde
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="empty-state">
              <p>Ingen kunder endnu</p>
              <button
                className="primary"
                onClick={() => setShowCreateForm(true)}
              >
                Opret din første kunde
              </button>
            </div>
          ) : (
            <div className="customer-list">
              {customers.map((customer) => (
                <CustomerListItem
                  key={customer.id}
                  customer={customer}
                  selected={selectedCustomerId === customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Customer Detail Panel */}
        <div className="customers-detail-panel">
          {showCreateForm ? (
            <CreateCustomerForm
              onCreated={handleCustomerCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : (
            <CustomerDetail
              customer={selectedCustomer}
              devices={customerDevices}
              unassignedDevices={unassignedDevices}
              onAssignDevice={handleAssignDevice}
              onRemoveDevice={handleRemoveDevice}
              onRefresh={() => loadCustomerDevices(selectedCustomerId)}
              onCustomerRefresh={loadCustomers}
              loading={devicesLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
