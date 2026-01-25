import React from 'react';

export default function CustomerAssignment({
  kind,
  id,
  customers,
  assignmentValue,
  setAssignmentField,
  handleAssignmentSave,
}) {
  return (
    <div className="section">
      <h4>Customer</h4>
      <div className="customer-row">
        <select
          value={assignmentValue(kind, id)}
          onChange={(e) => setAssignmentField(kind, id, e.target.value)}
          disabled={!customers.length}
        >
          <option value="">Unassigned</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          onClick={() => handleAssignmentSave(kind, id)}
          disabled={!customers.length}
        >
          Save Customer
        </button>
      </div>
    </div>
  );
}
