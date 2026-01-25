import React from 'react';
import { mapLink, openExternal } from '../utils/formatters.js';

export default function LocationForm({
  kind,
  id,
  locationValue,
  setLocationField,
  handleLocationSave,
}) {
  const latValue = locationValue(kind, id, 'lat');
  const lonValue = locationValue(kind, id, 'lon');
  const mapUrl = mapLink(latValue, lonValue);

  return (
    <div className="section">
      <h4>Location</h4>
      <div className="location-grid">
        <input
          type="text"
          placeholder="Location name"
          value={locationValue(kind, id, 'label')}
          onChange={(e) => setLocationField(kind, id, 'label', e.target.value)}
        />
        <input
          type="text"
          placeholder="Address or note"
          value={locationValue(kind, id, 'address')}
          onChange={(e) => setLocationField(kind, id, 'address', e.target.value)}
        />
        <input
          type="text"
          placeholder="ZIP"
          value={locationValue(kind, id, 'zip_code')}
          onChange={(e) => setLocationField(kind, id, 'zip_code', e.target.value)}
        />
        <input
          type="text"
          placeholder="Latitude"
          value={locationValue(kind, id, 'lat')}
          onChange={(e) => setLocationField(kind, id, 'lat', e.target.value)}
        />
        <input
          type="text"
          placeholder="Longitude"
          value={locationValue(kind, id, 'lon')}
          onChange={(e) => setLocationField(kind, id, 'lon', e.target.value)}
        />
        <input
          type="text"
          placeholder="Notes"
          value={locationValue(kind, id, 'notes')}
          onChange={(e) => setLocationField(kind, id, 'notes', e.target.value)}
        />
        <button className="primary" onClick={() => handleLocationSave(kind, id)}>
          Save Location
        </button>
        {mapUrl && (
          <button className="ghost" onClick={() => openExternal(mapUrl)}>
            Open Map
          </button>
        )}
      </div>
    </div>
  );
}
