import {
  ORDER_CONFIRMATION_EN,
  TEMPLATE_REJECTED,
  chooseApprovedFlow,
  expectedTemplate,
  explainMetaTemplateError,
  flowBodyParameters,
  flowComponents,
  pickTemplateStatus,
  readButtonChoice,
  sessionOpen,
  type FlowFields,
} from './whatsapp-templates';

describe('whatsapp templates', () => {
  it('keeps the English body off a trailing variable', () => {
    expect(ORDER_CONFIRMATION_EN).toBe(
      'Hi {{1}}, please confirm your cash on delivery order {{2}} for Rs {{3}} by tapping a button below.',
    );
    expect(ORDER_CONFIRMATION_EN).not.toMatch(/\{\{\d+\}\}[^\w{]*$/);
  });

  it('ignores a partial name and the wrong language', () => {
    const rows = [
      { name: 'jaspers_market_order_confirmation_v1', language: 'en', status: 'APPROVED' },
      { name: 'order_confirmation', language: 'hi', status: 'REJECTED' },
      { name: 'order_confirmation', language: 'en', status: 'PENDING' },
      { name: 'order_confirmation_hinglish', language: 'en', status: 'APPROVED' },
    ];
    expect(pickTemplateStatus(rows, expectedTemplate('english'))).toBe('PENDING');
    expect(pickTemplateStatus(rows, expectedTemplate('hindi'))).toBe('REJECTED');
    expect(pickTemplateStatus(rows, expectedTemplate('hinglish'))).toBe('APPROVED');
    expect(pickTemplateStatus(rows, { name: 'order_confirmation', language: 'en' })).not.toBe('APPROVED');
  });

  it('surfaces Meta user text and hides the token', () => {
    const explained = explainMetaTemplateError(400, {
      error: {
        message: 'Invalid parameter token EAAGsecretvalue',
        code: 100,
        error_subcode: 2388299,
        error_user_msg: "Variables can't be at the start or end of the template.",
      },
    });
    expect(explained.seller).toBe("Variables can't be at the start or end of the template.");
    expect(explained.log).toContain('2388299');
    expect(explained.log).toContain('100');
    expect(explained.log).not.toContain('EAAGsecretvalue');
    expect(explainMetaTemplateError(400, { error: { message: 'See buyer@example.com' } }).seller).toBe(TEMPLATE_REJECTED);
  });

  it('names each flow in en, hi, and hinglish and fills positional variables', () => {
    expect(expectedTemplate('english', 'address_update_request')).toEqual({ name: 'address_update_request', language: 'en' });
    expect(expectedTemplate('hindi', 'payment_link_request')).toEqual({ name: 'payment_link_request', language: 'hi' });
    expect(expectedTemplate('hinglish', 'payment_link_request')).toEqual({ name: 'payment_link_request_hinglish', language: 'en' });
    expect(expectedTemplate('hinglish', 'order_reminder')).toEqual({ name: 'order_reminder_hinglish', language: 'en' });
    const fields: FlowFields = {
      firstName: 'Asha',
      orderNo: '1042',
      amount: '799',
      store: 'Rasa',
      address: '12 4th Main, Bengaluru 560038',
      discount: '5',
      payToken: 'paytokenvalue',
    };
    expect(flowBodyParameters('address_update_request', fields).map((item) => item.text)).toEqual([
      'Asha', '1042', '799', 'Rasa', '12 4th Main, Bengaluru 560038',
    ]);
    expect(flowBodyParameters('order_reminder', fields)).toHaveLength(3);
    expect(flowBodyParameters('address_updated_confirmation', fields).map((item) => item.text)[2]).toMatch(/560038/);
    expect(flowBodyParameters('payment_link_request', fields).map((item) => item.text)).toEqual(['Asha', '1042', '799']);
    const components = flowComponents('payment_link_request', fields);
    expect(components[0].parameters).toHaveLength(3);
    expect(components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: '0' });
    expect((components[1].parameters as Array<{ text: string }>)[0].text).toBe('paytokenvalue');
    expect(JSON.stringify(components)).not.toContain('"5"');
  });

  it('reads the new quick replies and the 24 hour window', () => {
    expect(readButtonChoice('Address is correct')).toBe('address_ok');
    expect(readButtonChoice('Keep COD')).toBe('keep_cod');
    expect(readButtonChoice('Confirm order')).toBe('confirmed');
    expect(readButtonChoice('Cancel order')).toBe('cancelled');
    const now = Date.parse('2026-10-18T12:00:00Z');
    expect(sessionOpen([{ at: '2026-10-18T10:00:00Z', direction: 'in' }], now)).toBe(true);
    expect(sessionOpen([{ at: '2026-10-17T10:00:00Z', direction: 'in' }], now)).toBe(false);
    expect(sessionOpen([{ at: '2026-10-18T11:00:00Z', direction: 'out' }], now)).toBe(false);
  });

  it('prefers the utility payment link and keeps prepaid_offer as a fallback', () => {
    const approved = new Set(['prepaid_offer', 'order_confirmation']);
    expect(chooseApprovedFlow('payment_link_request', (flow) => approved.has(flow))).toEqual({ flow: 'prepaid_offer', fallback: false });
    approved.add('payment_link_request');
    expect(chooseApprovedFlow('payment_link_request', (flow) => approved.has(flow))).toEqual({ flow: 'payment_link_request', fallback: false });
    approved.delete('payment_link_request');
    approved.delete('prepaid_offer');
    expect(chooseApprovedFlow('payment_link_request', (flow) => approved.has(flow))).toEqual({ flow: 'order_confirmation', fallback: true });
    expect(chooseApprovedFlow('address_update_request', () => false)).toBeNull();
  });
});
