const kolkataHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function hourInKolkata(date: Date): number {
  const hour = Number(kolkataHour.format(date));
  return Number.isFinite(hour) ? hour % 24 : 0;
}
