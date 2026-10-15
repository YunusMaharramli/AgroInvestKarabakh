import React from 'react';

/** Official AgroInvest Qarabağ logo supplied by the site owner. */
export const Logo: React.FC<{ light?: boolean; className?: string; compact?: boolean }> = ({ className = '', compact }) => (
  <span className={`inline-flex aspect-square shrink-0 ${compact ? 'w-11' : 'w-[4.5rem]'} ${className}`}>
    <img
      src="/brand/agroinvest-qarabag-mark.png"
      alt="AgroInvest Qarabağ"
      className="h-full w-full object-contain"
    />
  </span>
);
