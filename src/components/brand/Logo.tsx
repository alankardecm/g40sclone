import { brand } from '@/lib/brand';

type LogoMarkProps = {
  size?: number;
  className?: string;
};

/** Monograma "AM" em quadrado arredondado com degradê da marca. */
export function LogoMark({ size = 36, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={brand.company}
    >
      <defs>
        <linearGradient id="am-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="0.55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#am-grad)" />
      <path
        d="M11.5 33.5 18 15.5h3.4L28 33.5h-3.6l-1.45-4.3h-6.4l-1.45 4.3H11.5Zm5.9-7.15h4.4L19.6 19.8l-2.2 6.55Z"
        fill="#fff"
      />
      <path
        d="M29.2 33.5V15.5h3.15l3.6 9.05 3.55-9.05H42.7v18h-3.05V22.1l-3.05 7.6h-1.9l-3.05-7.6v11.4H29.2Z"
        fill="#fff"
        fillOpacity="0.85"
      />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  /** Mostra o wordmark + subtítulo ao lado do monograma */
  showText?: boolean;
  className?: string;
};

/** Logo completo: monograma + nome do produto + subtítulo. */
export function Logo({ size = 38, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} className="shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)]" />
      {showText && (
        <div className="min-w-0 leading-none">
          <p className="text-[15px] font-extrabold tracking-[-0.02em] text-foreground">
            {brand.name}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
            {brand.subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
