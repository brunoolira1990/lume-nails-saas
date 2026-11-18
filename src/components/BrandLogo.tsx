import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showText?: boolean;
  className?: string;
  /** Logo do salão logado. Sem valor (ou se falhar), usa o padrão do Lume Nails. */
  src?: string;
  alt?: string;
}

const DEFAULT_LOGO = '/lume-logo.svg';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  src,
  alt = 'Lume Nails',
}) => {
  const sizeClasses = {
    sm: 'h-10 sm:h-11 w-auto max-w-[140px]',
    md: 'h-13 sm:h-15 w-auto max-w-[180px]',
    lg: 'h-16 sm:h-20 w-auto max-w-[220px]',
    hero: 'h-24 sm:h-32 w-auto max-w-[300px]',
  };

  const customLogo = src?.trim() ?? '';
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [defaultFailed, setDefaultFailed] = useState(false);

  // Nova URL (troca de salão): volta a tentar carregar a imagem.
  useEffect(() => {
    setFailedLogo(null);
    setDefaultFailed(false);
  }, [customLogo]);

  const resolvedLogo =
    customLogo && failedLogo !== customLogo ? customLogo : DEFAULT_LOGO;

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={resolvedLogo}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`${sizeClasses[size]} object-contain select-none shrink-0 transition-transform duration-200`}
        style={defaultFailed ? { display: 'none' } : undefined}
        onError={() => {
          // Logo do salão quebrada: cai para o padrão do Lume Nails.
          if (customLogo && failedLogo !== customLogo) {
            setFailedLogo(customLogo);
            return;
          }
          setDefaultFailed(true);
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
