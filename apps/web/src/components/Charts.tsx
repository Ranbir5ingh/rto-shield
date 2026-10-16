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
  const labelEvery = coords.length > 8 ? Math.ceil(coords.length / 6) : 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Weekly RTO rate">
      <path className="chart-line" d={d} pathLength={1} fill="none" stroke="#b4ff39" strokeWidth="2" />
      {coords.map((point, index) => (
        <g key={point.label + point.x}>
          <circle cx={point.x} cy={point.y} r="3.5" fill="#b4ff39" />
          {index % labelEvery === 0 ? (
            <text x={point.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#8b8b9e">
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
    ['Low', bands.Low, 'bg-low'],
    ['Medium', bands.Medium, 'bg-mid'],
    ['High', bands.High, 'bg-high'],
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
