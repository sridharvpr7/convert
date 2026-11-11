import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const ConveterLogo: React.FC<LogoProps> = ({
  size = 32,
  showText = true,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        {/* Up arrow */}
        <path
          d="M9 13L13 9L17 13"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13 9V21"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Down arrow */}
        <path
          d="M23 19L19 23L15 19"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 23V11"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <span
          className="font-bold tracking-tight select-none"
          style={{
            fontSize: size * 0.56,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          CONV
          <span style={{ color: 'var(--accent)' }}>ET</span>
          ER
        </span>
      )}
    </div>
  );
};

export default ConveterLogo;
