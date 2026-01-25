import React, { useState } from 'react';
import { createCustomer } from '../api.js';

export default function CustomerSection({
  customers,
  loadCustomers,
  setError,
}) {
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    notes: '',
  });

  async function handleCustomerCreate() {
    if (!customerDraft.name.trim()) {
      setError('Customer name is required');
      return;
    }
    try {
      await createCustomer({
        name: customerDraft.name.trim(),
        contact_name: customerDraft.contact_name.trim(),
        email: customerDraft.email.trim(),
        phone: customerDraft.phone.trim(),
        notes: customerDraft.notes.trim(),
      });
      setCustomerDraft({ name: '', contact_name: '', email: '', phone: '', notes: '' });
      await loadCustomers();
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    }
  }

  return (
    <div className="section customer-panel">
      <h4>Customers</h4>
      <div className="customer-create">
        <input
          type="text"
          placeholder="Customer name"
          value={customerDraft.name}
          onChange={(e) => setCustomerDraft({ ...customerDraft, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Contact name"
          value={customerDraft.contact_name}
          onChange={(e) => setCustomerDraft({ ...customerDraft, contact_name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={customerDraft.email}
          onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Phone"
          value={customerDraft.phone}
          onChange={(e) => setCustomerDraft({ ...customerDraft, phone: e.target.value })}
        />
        <button className="primary" onClick={handleCustomerCreate}>
          Add Customer
        </button>
      </div>
      {customers.length > 0 && (
        <div className="customer-list">
          {customers.map((customer) => (
            <div key={customer.id} className="customer-item">
              <strong>{customer.name}</strong>
              <span>#{customer.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
