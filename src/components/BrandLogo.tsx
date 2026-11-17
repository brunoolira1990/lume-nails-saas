import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showText?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-10 sm:h-11 w-auto max-w-[140px]',
    md: 'h-13 sm:h-15 w-auto max-w-[180px]',
    lg: 'h-16 sm:h-20 w-auto max-w-[220px]',
    hero: 'h-24 sm:h-32 w-auto max-w-[300px]',
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Neutral SVG placeholder logo */}
      <img
        src="/lume-logo.svg"
        alt="Lume Nails"
        referrerPolicy="no-referrer"
        className={`${sizeClasses[size]} object-contain select-none shrink-0 transition-transform duration-200`}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />

      {/* Typography text branding (only if explicitly requested) */}
      {showText && (
        <div className="flex flex-col justify-center ml-3">
          <div className="flex items-center gap-1.5">
            <span
              className="text-2xl sm:text-[28px] leading-tight font-normal text-[#8B5CF6] font-['Great_Vibes',cursive] tracking-wide"
              style={{
                textShadow: '0 1px 1px rgba(139, 92, 246, 0.15)',
              }}
            >
              Lume
            </span>
          </div>
          <span className="text-[9px] sm:text-[11px] uppercase font-bold tracking-[0.3em] text-[#D97706] -mt-1 font-sans">
            NAILS
          </span>
        </div>
      )}
    </div>
  );
};
