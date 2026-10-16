import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { maskPhone, whatsappNumber } from './phone';
import { toMlOrder } from '../ml/payload';

describe('encryption and phone masking', () => {
  const config = {
    get: (key: string) => (key === 'ENCRYPTION_KEY' ? 'ab'.repeat(32) : undefined),
  } as ConfigService;

  it('round-trips unicode and rejects tampering', () => {
    const crypto = new CryptoService(config);
    const cipher = crypto.encrypt('मकान नं 12, गली 4');
    expect(cipher).not.toContain('मकान');
    expect(crypto.decrypt(cipher)).toBe('मकान नं 12, गली 4');
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
    const [version, iv, tag, data] = cipher.split('.');
    const tagBuf = Buffer.from(tag!, 'base64url');
    tagBuf[0] = (tagBuf[0] ?? 0) ^ 0xff;
    expect(() => crypto.decrypt(`${version}.${iv}.${tagBuf.toString('base64url')}.${data}`)).toThrow();
  });

  it('masks phones and builds wa.me numbers', () => {
    expect(maskPhone('9876543210')).toBe('98*****210');
    expect(maskPhone('+91 98765 43210')).toMatch(/\*/);
    expect(whatsappNumber('9876543210')).toBe('919876543210');
  });

  it('does not send phone or buyer name to the model', () => {
    const payload = toMlOrder({
      id: '1',
      orderValue: 499,
      paymentType: 'cod',
      hour: 14,
      priorOrders: 0,
      priorRtos: 0,
      address: 'H.No 1',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      outcome: 'rto',
    });
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('buyerName');
    expect(payload.label).toBe(1);
    expect(JSON.stringify(payload)).not.toContain('pincode_risk');
  });
});
