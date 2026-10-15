export function hourInKolkata(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const hour = Number(formatted);
  return Number.isFinite(hour) ? hour % 24 : 0;
}
