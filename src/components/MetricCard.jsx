import React from 'react';

export default function Card({ title, value, description }) {
  return (
    <div className="card-b stat-card">
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>

      {description && (
        <div className="card-description">
          {description}
        </div>
      )}
    </div>
  );
}
