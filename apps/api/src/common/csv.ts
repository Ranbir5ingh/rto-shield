import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { ColumnMapping } from './validation';

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  let records: CsvRow[];
  try {
    records = parse(text.replace(/^\uFEFF/, ''), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as CsvRow[];
  } catch {
    throw new BadRequestException('Could not parse that CSV');
  }
  if (records.length > 5000) {
    throw new BadRequestException('CSV has more than 5000 data rows');
  }
  return records;
}

export function headersOf(rows: CsvRow[]): string[] {
  return rows[0] ? Object.keys(rows[0]) : [];
}

export type PresetName = 'shopify' | 'meesho' | 'generic' | 'unknown';

export function detectPreset(headers: string[]): PresetName {
  const set = new Set(headers);
  if (set.has('Shipping Zip') || set.has('Shipping Address1')) return 'shopify';
  if (set.has('Sub Order No') || (set.has('Payment Mode') && set.has('Pincode'))) return 'meesho';
  if (set.has('order_id')) return 'generic';
  return 'unknown';
}

function pick(headers: string[], ...candidates: string[]): string | undefined {
  const set = new Set(headers);
  return candidates.find((candidate) => set.has(candidate));
}

export function suggestMapping(headers: string[], preset: PresetName): ColumnMapping {
  if (preset === 'shopify') {
    return {
      orderId: pick(headers, 'Name'),
      buyerName: pick(headers, 'Shipping Name', 'Billing Name') || '',
      phone: pick(headers, 'Shipping Phone', 'Billing Phone') || '',
      address: pick(headers, 'Shipping Address1', 'Shipping Street') || '',
      city: pick(headers, 'Shipping City'),
      state: pick(headers, 'Shipping Province'),
      pincode: pick(headers, 'Shipping Zip') || '',
      orderValue: pick(headers, 'Total') || '',
      paymentType: pick(headers, 'Payment Method', 'Financial Status'),
      orderedAt: pick(headers, 'Created at'),
      outcome: pick(headers, 'Fulfillment Status'),
      productName: pick(headers, 'Lineitem name'),
    };
  }
  if (preset === 'meesho') {
    return {
      orderId: pick(headers, 'Sub Order No', 'Order ID'),
      buyerName: pick(headers, 'Customer Name') || '',
      phone: pick(headers, 'Mobile', 'Phone') || '',
      address: pick(headers, 'Address') || '',
      city: pick(headers, 'City'),
      state: pick(headers, 'State'),
      pincode: pick(headers, 'Pincode') || '',
      orderValue: pick(headers, 'Price', 'Order Value') || '',
      paymentType: pick(headers, 'Payment Mode'),
      orderedAt: pick(headers, 'Order Date'),
      outcome: pick(headers, 'Order Status'),
      productName: pick(headers, 'Product Name'),
      courier: pick(headers, 'Courier Partner'),
    };
  }
  return {
    orderId: pick(headers, 'order_id'),
    buyerName: pick(headers, 'buyer_name') || '',
    phone: pick(headers, 'phone') || '',
    address: pick(headers, 'address') || '',
    city: pick(headers, 'city'),
    state: pick(headers, 'state'),
    pincode: pick(headers, 'pincode') || '',
    orderValue: pick(headers, 'order_value') || '',
    paymentType: pick(headers, 'payment_type'),
    orderedAt: pick(headers, 'ordered_at'),
    outcome: pick(headers, 'outcome'),
    priorOrders: pick(headers, 'prior_orders'),
    priorRtos: pick(headers, 'prior_rtos'),
    productName: pick(headers, 'product_name'),
    courier: pick(headers, 'courier'),
  };
}

export function cell(row: CsvRow, column: string | undefined): string {
  if (!column) return '';
  return (row[column] ?? '').replace(/\0/g, '').trim();
}

export function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/inr/i, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

export function parsePayment(raw: string | undefined): 'cod' | 'prepaid' {
  const value = (raw || '').toLowerCase();
  if (!value) return 'cod';
  if (/(prepaid|upi|razorpay|card|netbanking|online|already paid)/.test(value)) return 'prepaid';
  if (value === 'paid') return 'prepaid';
  if (/(cod|cash|pod|pay on delivery)/.test(value)) return 'cod';
  if (value === 'pending') return 'cod';
  return 'cod';
}

export function parseOutcome(raw: string | undefined): 'delivered' | 'rto' | null {
  const value = (raw || '').toLowerCase().trim();
  if (!value) return null;
  if (/(rto|return to origin|returned|undeliver|refused)/.test(value)) return 'rto';
  if (/(deliver|fulfilled|success)/.test(value)) return 'delivered';
  return null;
}

export function parseOrderDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const dmy = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 8, 30));
    if (!Number.isNaN(date.getTime()) && month >= 1 && month <= 12 && day >= 1 && day <= 31) return date;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

export function parseCount(raw: string | undefined): number {
  const value = Number((raw || '0').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(10_000, Math.floor(value));
}

const FORMULA = /^[=+\-@\t\r]/;

export function csvSafe(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const guarded = FORMULA.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(row.map((cellValue) => csvSafe(cellValue)).join(','));
  return lines.join('\n');
}

export const GENERIC_TEMPLATE = [
  'order_id,buyer_name,phone,address,city,state,pincode,order_value,payment_type,ordered_at,prior_orders,prior_rtos,outcome,product_name,courier',
  'A1001,Aarav Sharma,9000000001,"H.No 12, Lane 4, Andheri West",Mumbai,Maharashtra,400058,899,cod,2026-09-01T14:22:00+05:30,0,0,delivered,Cotton kurti,Delhivery',
  'A1002,Priya Nair,9000000002,near Hanuman mandir,Lucknow,Uttar Pradesh,226010,1499,cod,2026-09-02T23:10:00+05:30,1,1,rto,Daily saree,Shadowfax',
  'A1003,Imran Khan,9000000003,"44 MG Road",Bengaluru,Karnataka,560001,699,prepaid,2026-09-03T11:05:00+05:30,3,0,delivered,Mobile cover,Delhivery',
].join('\n');
