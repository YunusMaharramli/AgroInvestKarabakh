import React from 'react';

/**
 * AGROInvest wordmark. Temporary in-code logo — replace with the official logo file when it is supplied
 * (Part 1 says "use the uploaded asset"; no logo file was included).
 */
export const Logo: React.FC<{ light?: boolean; className?: string; compact?: boolean }> = ({ light, className = '', compact }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill={light ? '#FAF8F3' : '#1F4D2E'} />
      <path d="M20 31c0-8 0-13 8-19-1 8-4 12-8 13" fill="none" stroke="#C9A54C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31c0-6-1-10-7-14 0 6 3 9 7 10" fill="none" stroke={light ? '#1F4D2E' : '#E8EFE4'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 31h18" stroke={light ? '#1F4D2E' : '#E8EFE4'} strokeWidth="2" strokeLinecap="round" />
    </svg>
    {!compact && (
      <span className={`font-display text-[1.6rem] leading-none tracking-tight ${light ? 'text-cream' : 'text-brand'}`}>
        <span className="font-bold">AGRO</span><span className={`italic ${light ? 'text-gold' : 'text-leaf-dark'}`}>Invest</span>
      </span>
    )}
  </span>
);
