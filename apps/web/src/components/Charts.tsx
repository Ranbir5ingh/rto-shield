export function TrendChart({
  points,
}: {
  points: Array<{ week: string; rate: number | null }>;
}) {
  const width = 640;
  const height = 180;
  const pad = 24;
  const usable = points.filter((point) => point.rate !== null);
  if (!usable.length) {
    return <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Upload delivered and RTO history to see a weekly rate.</p>;
  }
  const max = 100;
  const step = usable.length === 1 ? 0 : (width - pad * 2) / (usable.length - 1);
  const coords = usable.map((point, index) => {
    const x = pad + index * step;
    const y = height - pad - ((point.rate || 0) / max) * (height - pad * 2);
    return { x, y, label: point.week.slice(5) };
  });
  const d = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${d} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
  const labelEvery = coords.length > 8 ? Math.ceil(coords.length / 6) : 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Weekly RTO rate">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fd0100" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fd0100" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendFill)" />
      <path className="chart-line" d={d} pathLength={1} fill="none" stroke="#fd0100" strokeWidth="2.5" strokeLinecap="round" />
      {coords.map((point, index) => (
        <g key={point.label + point.x}>
          <circle cx={point.x} cy={point.y} r="3.5" fill="#fd0100" />
          {index % labelEvery === 0 ? (
            <text x={point.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#8a8a8a" fontFamily="monospace">
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function Distribution({ bands }: { bands: { Low: number; Medium: number; High: number } }) {
  const total = bands.Low + bands.Medium + bands.High || 1;
  const rows = [
    ['Low', bands.Low, '#00e676'],
    ['Medium', bands.Medium, '#faed8f'],
    ['High', bands.High, '#fd0100'],
  ] as const;
  return (
    <div className="space-y-5">
      {rows.map(([label, count, color]) => (
        <div key={label}>
          <div className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.2em]">
            <span className="text-muted">{label}</span>
            <span className="tabular-nums text-white">{count}</span>
          </div>
          <div className="h-[3px] bg-white/10">
            <div className="bar-fill h-[3px]" style={{ width: `${(count / total) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
