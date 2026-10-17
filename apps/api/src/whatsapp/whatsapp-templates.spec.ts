import {
  ORDER_CONFIRMATION_EN,
  TEMPLATE_REJECTED,
  expectedTemplate,
  explainMetaTemplateError,
  pickTemplateStatus,
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
});
