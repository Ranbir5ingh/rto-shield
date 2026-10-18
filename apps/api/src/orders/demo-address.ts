import type { ParsedAddress } from './address-intake';

/** A real Indiranagar address. India Post lists 560038, and Shopify's province code is KA. */
export const DEMO_DEV_ADDRESS: ParsedAddress = {
  street: '12, 4th Main Road',
  landmark: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pin: '560038',
};

export function isRtoTestGid(gid: string, allowed: ReadonlySet<string> | null | undefined): boolean {
  return Boolean(gid) && Boolean(allowed?.has(gid));
}
