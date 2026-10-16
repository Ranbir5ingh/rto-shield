export function inr(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const tail = digits.slice(-3);
  const head = digits.length > 3 ? digits.slice(0, -3) : '';
  const groupedHead = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${head ? `${groupedHead},${tail}` : tail}`;
}

export function bandClass(band: string | null) {
  if (band === 'High') return 'bg-high/15 text-high';
  if (band === 'Medium') return 'bg-mid/15 text-mid';
  if (band === 'Low') return 'bg-low/15 text-low';
  return 'bg-raised text-muted';
}

export function predictorLabel(name: string | null | undefined) {
  if (!name) return 'Not scored yet';
  if (name.includes('tabpfn')) return 'TabPFN';
  if (name.includes('sklearn')) return 'scikit-learn fallback';
  if (name.includes('rules')) return 'Rules prior';
  return name;
}
