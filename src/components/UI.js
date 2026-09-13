import React from 'react';

export function OrbitMark({ className = '' }) {
  return <svg className={`orbit-mark ${className}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.4" />
    <ellipse cx="20" cy="20" rx="19" ry="7" transform="rotate(-40 20 20)" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="20" cy="20" r="3" fill="currentColor" />
  </svg>;
}

export function PageHeading({ eyebrow, title, children, action }) {
  return <header className="page-heading"><div>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h1>{title}</h1>{children && <div className="page-description">{children}</div>}
  </div>{action}</header>;
}

export function EmptyState({ title, children, action }) {
  return <div className="empty-state"><OrbitMark /><h2>{title}</h2>
    <div className="muted">{children}</div>{action}</div>;
}

export function LoadingState({ text = 'Загрузка...' }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />
    <p>{text}</p><div className="skeleton" /><div className="skeleton short" /></div>;
}

export function DialogClose({ onClose }) {
  return <button type="button" className="modal-dismiss button-secondary" aria-label="Закрыть окно" onClick={onClose}>×</button>;
}
