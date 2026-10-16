export function LogoMark({
  size = 32,
  className = '',
  ink = '#fff',
  pulse = '#00e676',
}: {
  size?: number;
  className?: string;
  ink?: string;
  pulse?: string;
}) {
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
        stroke={ink}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 31 H27 L30 23 L35 39 L38 30 H44"
        stroke={pulse}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = 32,
  withWordmark = true,
  ink = '#fff',
  pulse = '#00e676',
}: {
  size?: number;
  withWordmark?: boolean;
  ink?: string;
  pulse?: string;
}) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} ink={ink} pulse={pulse} />
      {withWordmark ? (
        <span className="font-display text-sm font-black uppercase tracking-[0.08em]" style={{ color: ink }}>
          RTO Shield
        </span>
      ) : null}
    </span>
  );
}
