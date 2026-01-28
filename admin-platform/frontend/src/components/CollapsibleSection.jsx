import React, { useState } from 'react';

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-section ${className} ${isOpen ? 'open' : ''}`}>
      <button
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="collapsible-title">{title}</h4>
        <span className="collapsible-icon">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </section>
  );
}
