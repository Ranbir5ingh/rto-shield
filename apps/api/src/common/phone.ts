export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function maskPhone(phone: string): string {
  const digits = digitsOnly(phone);
  const core = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  if (core.length < 6) return '******';
  const stars = '*'.repeat(Math.max(3, core.length - 5));
  return `${core.slice(0, 2)}${stars}${core.slice(-3)}`;
}

export function whatsappNumber(phone: string): string | null {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}
