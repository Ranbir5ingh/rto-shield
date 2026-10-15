export function inr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function bandClass(band: string | null) {
  if (band === 'High') return 'bg-danger/10 text-danger';
  if (band === 'Medium') return 'bg-warn/10 text-warn';
  if (band === 'Low') return 'bg-forest/10 text-forest';
  return 'bg-line text-ink/70';
}

export function predictorLabel(name: string | null | undefined) {
  if (!name) return 'Not scored yet';
  if (name.includes('tabpfn')) return 'TabPFN';
  if (name.includes('sklearn')) return 'scikit-learn fallback';
  if (name.includes('rules')) return 'Rules prior';
  return name;
}
