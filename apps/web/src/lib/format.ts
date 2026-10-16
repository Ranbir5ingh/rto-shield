export function inr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
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
