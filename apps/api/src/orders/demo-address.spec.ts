import { DEMO_DEV_ADDRESS, isRtoTestGid } from './demo-address';

describe('demo dev-store address', () => {
  it('only selects orders Shopify tagged rto-test', () => {
    const allowed = new Set(['gid://shopify/Order/1']);
    expect(isRtoTestGid('gid://shopify/Order/1', allowed)).toBe(true);
    expect(isRtoTestGid('gid://shopify/Order/2', allowed)).toBe(false);
    expect(isRtoTestGid('gid://shopify/Order/1', new Set())).toBe(false);
    expect(isRtoTestGid('', allowed)).toBe(false);
    expect(DEMO_DEV_ADDRESS.pin).toBe('560038');
    expect(DEMO_DEV_ADDRESS.state).toBe('Karnataka');
    expect(DEMO_DEV_ADDRESS.street).not.toMatch(/Shastri Nagar/);
  });
});
