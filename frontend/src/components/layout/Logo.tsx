import React from 'react';

/** Official AgroMatch emblem paired with the localized brand wordmark. */
export const Logo: React.FC<{ light?: boolean; className?: string; compact?: boolean }> = ({ light, className = '', compact }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <img
      src="/brand/agromatch-logo.png"
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${compact ? 'w-10 h-10' : 'w-12 h-12 sm:w-14 sm:h-14'}`}
    />
    {!compact && (
      <span className={`font-display text-[1.6rem] leading-none tracking-tight ${light ? 'text-cream' : 'text-brand'}`}>
        <span className="font-bold">Agro</span><span className={`italic ${light ? 'text-gold' : 'text-leaf-dark'}`}>Match</span>
      </span>
    )}
  </span>
);
