/**
 * RTO Shield mark, drawn for the paper-tear language: a slightly wobbly
 * hand-inked shield (double sketch stroke), white sticker fill, and a
 * rough marker-red signal pulse across it. Crisp at 30px, charming large.
 */
export function LogoMark({
  size = 32,
  className = '',
  ink = '#1B1712',
  pulse = '#FF3B30',
  paper = '#FFFFFF',
}: {
  size?: number;
  className?: string;
  ink?: string;
  pulse?: string;
  paper?: string;
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
      {/* wobbly outer shield */}
      <path
        d="M32 5.5 C 37.5 7, 43.5 7.6, 49 7 C 49.6 18.5, 48.4 30.5, 42.5 38.5 C 37.5 45, 31.5 49.5, 26.5 53.5 C 25.4 54.3, 24 54.3, 23 53.4 C 17 48.8, 11 43.2, 8.4 35.4 C 6.2 28.4, 5.8 18.4, 6.4 7.6 C 12 8.2, 18 7.8, 23.4 6.2 C 26.4 5.4, 29.2 5, 32 5.5 Z"
        fill={paper}
        stroke={ink}
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      {/* inner sketch echo */}
      <path
        d="M32 12.5 C 36 13.4, 40.2 13.8, 43.6 13.4 C 44.1 21.4, 43.2 29.2, 38.8 35.2 C 34.8 40.6, 30.2 44.2, 26.8 47.2 C 23.2 44.2, 18.2 40.2, 15.6 34.8 C 13.2 29.4, 12.6 21.8, 13.1 13.8 C 17.2 14.4, 21.2 13.9, 24.8 12.9 C 27.2 12.2, 29.6 11.9, 32 12.5 Z"
        stroke={ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.35"
      />
      {/* rough marker pulse */}
      <path
        d="M17.5 30.5 L24.8 29.8 L27.6 21.5 L32.8 38.5 L36.4 27.8 L45.5 28.6"
        stroke={pulse}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = 32,
  withWordmark = true,
  ink = '#1B1712',
  pulse = '#FF3B30',
}: {
  size?: number;
  withWordmark?: boolean;
  ink?: string;
  pulse?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} ink={ink} pulse={pulse} />
      {withWordmark ? (
        <span className="font-display text-sm font-black uppercase tracking-[0.08em]" style={{ color: ink }}>
          RTO Shield
        </span>
      ) : null}
    </span>
  );
}
