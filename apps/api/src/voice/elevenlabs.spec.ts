import { createHmac } from 'crypto';
import { parseCallOutcome, verifyElevenSignature } from './elevenlabs';

describe('ElevenLabs webhook', () => {
  const secret = 'whsec-test';
  const raw = Buffer.from('{"type":"post_call_transcription"}');

  function header(body: Buffer, stamp: number) {
    const mac = createHmac('sha256', secret).update(`${stamp}.${body.toString('utf8')}`).digest('hex');
    return `t=${stamp},v0=${mac}`;
  }

  it('accepts a fresh HMAC and rejects a bad or old one', () => {
    const now = 1_700_000_000_000;
    const stamp = Math.floor(now / 1000);
    expect(verifyElevenSignature(raw, header(raw, stamp), secret, now)).toBe(true);
    expect(verifyElevenSignature(raw, header(raw, stamp).replace(/.$/, '0'), secret, now)).toBe(false);
    expect(verifyElevenSignature(raw, header(raw, stamp - 4000), secret, now)).toBe(false);
    expect(verifyElevenSignature(raw, undefined, secret, now)).toBe(false);
  });

  it('reads the order, outcome, and address from the analysis payload', () => {
    const parsed = parseCallOutcome({
      type: 'post_call_transcription',
      data: {
        conversation_id: 'conv-1',
        analysis: {
          data_collection_results: {
            outcome: { value: 'address' },
            landmark: { value: 'near the temple' },
            address: { value: '12 lane 4, andheri' },
          },
        },
        conversation_initiation_client_data: {
          dynamic_variables: { rto_order: '507f1f77bcf86cd799439011', order_id: '#1042' },
        },
      },
    });
    expect(parsed).toMatchObject({
      conversationId: 'conv-1',
      orderId: '507f1f77bcf86cd799439011',
      outcome: 'address',
      landmark: 'near the temple',
      address: '12 lane 4, andheri',
    });
  });
});
