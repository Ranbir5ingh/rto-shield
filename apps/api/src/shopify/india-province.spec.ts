import { indiaProvinceCode, shopifyShippingAddress } from './india-province';

describe('Shopify shipping address', () => {
  it('uses countryCode and provinceCode from the 2026-10 mailing address input', () => {
    expect(indiaProvinceCode('Karnataka')).toBe('KA');
    expect(indiaProvinceCode('Tamil Nadu')).toBe('TN');
    expect(indiaProvinceCode('Uttarakhand')).toBe('UK');
    expect(indiaProvinceCode('KA')).toBe('KA');
    expect(indiaProvinceCode('Odisha')).toBe('OR');
    expect(indiaProvinceCode('Nowhere')).toBe('');

    const address = shopifyShippingAddress({
      address1: '12, 4th Main Road',
      address2: 'Indiranagar',
      city: 'Bengaluru',
      province: 'Karnataka',
      zip: '560 038',
    });
    expect(address).toEqual({
      address1: '12, 4th Main Road',
      address2: 'Indiranagar',
      city: 'Bengaluru',
      zip: '560038',
      countryCode: 'IN',
      provinceCode: 'KA',
    });
    expect(address && Object.keys(address).sort()).toEqual(['address1', 'address2', 'city', 'countryCode', 'provinceCode', 'zip']);
    expect(shopifyShippingAddress({ address1: '1', city: 'X', province: 'Nope', zip: '560038' })).toBeNull();
  });
});
