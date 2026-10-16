export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="RTO Shield logo"
    >
      <path
        d="M32 6 L50 13 V30 C50 43 41 51 32 56 C23 51 14 43 14 30 V13 Z"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 31 H27 L30 23 L35 39 L38 30 H44"
        stroke="#00e676"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 32, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} />
      {withWordmark ? (
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-white">
          RTO Shield
        </span>
      ) : null}
    </span>
  );
}
