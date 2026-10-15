import { csvSafe, detectPreset, parseOutcome, parsePayment, suggestMapping, toCsv } from './csv';

describe('csv helpers', () => {
  it('detects shopify, meesho, and generic headers', () => {
    expect(detectPreset(['Name', 'Shipping Zip', 'Total'])).toBe('shopify');
    expect(detectPreset(['Sub Order No', 'Payment Mode', 'Pincode'])).toBe('meesho');
    expect(detectPreset(['order_id', 'phone'])).toBe('generic');
  });

  it('suggests a shopify mapping', () => {
    const mapping = suggestMapping(['Name', 'Shipping Name', 'Shipping Phone', 'Shipping Address1', 'Shipping Zip', 'Total', 'Payment Method'], 'shopify');
    expect(mapping.orderId).toBe('Name');
    expect(mapping.pincode).toBe('Shipping Zip');
    expect(mapping.paymentType).toBe('Payment Method');
  });

  it('parses payment and outcome words', () => {
    expect(parsePayment('Cash on Delivery (COD)')).toBe('cod');
    expect(parsePayment('paid')).toBe('prepaid');
    expect(parsePayment('pending')).toBe('cod');
    expect(parseOutcome('RTO')).toBe('rto');
    expect(parseOutcome('fulfilled')).toBe('delivered');
    expect(parseOutcome('cancelled')).toBeNull();
  });

  it('neutralises spreadsheet formulas on export', () => {
    const csv = toCsv(['name', 'note'], [['=cmd|calc', 'ok'], ['+91 90000', 'fine']]);
    expect(csv.split('\n')[1]?.startsWith("'+=")).toBe(false);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'+91 90000");
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});
