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
    return <p className="text-sm text-ink/60">Upload delivered and RTO history to see a weekly rate.</p>;
  }
  const max = 100;
  const step = usable.length === 1 ? 0 : (width - pad * 2) / (usable.length - 1);
  const coords = usable.map((point, index) => {
    const x = pad + index * step;
    const y = height - pad - ((point.rate || 0) / max) * (height - pad * 2);
    return { x, y, label: point.week.slice(5) };
  });
  const d = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Weekly RTO rate">
      <path className="chart-line" d={d} fill="none" stroke="#c9841a" strokeWidth="3" />
      {coords.map((point) => (
        <g key={point.label + point.x}>
          <circle cx={point.x} cy={point.y} r="4" fill="#1b3344" />
          <text x={point.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#1c1915">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Distribution({ bands }: { bands: { Low: number; Medium: number; High: number } }) {
  const total = bands.Low + bands.Medium + bands.High || 1;
  const rows = [
    ['Low', bands.Low, 'bg-forest'],
    ['Medium', bands.Medium, 'bg-warn'],
    ['High', bands.High, 'bg-danger'],
  ] as const;
  return (
    <div className="space-y-3">
      {rows.map(([label, count, color]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{label}</span>
            <span className="tabular-nums">{count}</span>
          </div>
          <div className="h-2 rounded-full bg-line">
            <div className={`bar-fill h-2 rounded-full ${color}`} style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
