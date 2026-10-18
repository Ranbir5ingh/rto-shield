/** Shopify MailingAddressInput province codes for India (Admin API 2026-10). */
const PROVINCES: Array<[string, string]> = [
  ['AN', 'Andaman and Nicobar Islands'],
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CH', 'Chandigarh'],
  ['CG', 'Chhattisgarh'],
  ['DN', 'Dadra and Nagar Haveli'],
  ['DD', 'Daman and Diu'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OR', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
];

const ALIASES: Record<string, string> = {
  ut: 'UK',
  ua: 'UK',
  ct: 'CG',
  tg: 'TS',
  od: 'OR',
  orissa: 'OR',
  uttaranchal: 'UK',
  pondicherry: 'PY',
  chattisgarh: 'CG',
  nctofdelhi: 'DL',
  newdelhi: 'DL',
  delhi: 'DL',
};

const BY_KEY = new Map<string, string>();
for (const [code, name] of PROVINCES) {
  BY_KEY.set(code.toLowerCase(), code);
  BY_KEY.set(name.toLowerCase().replace(/[^a-z]/g, ''), code);
}
for (const [alias, code] of Object.entries(ALIASES)) BY_KEY.set(alias, code);

export function indiaProvinceCode(state: string): string {
  return BY_KEY.get(state.toLowerCase().replace(/[^a-z]/g, '')) || '';
}

export interface ShopifyShippingAddress {
  address1: string;
  address2: string;
  city: string;
  zip: string;
  countryCode: 'IN';
  provinceCode: string;
}

/** Current MailingAddressInput: countryCode and provinceCode, not the deprecated country/province strings. */
export function shopifyShippingAddress(input: {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
}): ShopifyShippingAddress | null {
  const provinceCode = indiaProvinceCode(input.province);
  if (!provinceCode) return null;
  return {
    address1: input.address1.slice(0, 200),
    address2: (input.address2 || '').slice(0, 160),
    city: input.city.slice(0, 80),
    zip: input.zip.replace(/\s/g, '').slice(0, 12),
    countryCode: 'IN',
    provinceCode,
  };
}
