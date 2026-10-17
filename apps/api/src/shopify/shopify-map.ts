import { hourInKolkata } from '../common/hour';

export interface MappedOrder {
  externalOrderId: string;
  shopifyGid: string;
  buyerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  orderValue: number;
  paymentType: 'cod' | 'prepaid';
  orderedAt: Date;
  productName: string;
  courier: string;
  stage: 'history' | 'pending' | 'closed';
  outcome: 'delivered' | 'rto' | 'cancelled' | null;
  customerId: string;
}

const RTO_SHIPMENT = new Set(['failure', 'failed', 'attempted_delivery']);

export function normalizeShop(input: string): string | null {
  let shop = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!shop) return null;
  if (!shop.includes('.')) shop = `${shop}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

function codFrom(gateways: string[], financial: string): boolean {
  const blob = gateways.join(' ').toLowerCase();
  if (blob.includes('cod') || blob.includes('cash on delivery') || blob.includes('cash_on_delivery')) return true;
  return financial.toLowerCase() === 'pending' && !blob.includes('prepaid');
}

function outcomeOf(input: {
  cancelled: boolean;
  fulfilled: boolean;
  shipment: string;
  refunded: boolean;
  tags: string[];
  rtoTag: string;
  financial: string;
}): 'delivered' | 'rto' | 'cancelled' | null {
  const tag = input.rtoTag.trim().toLowerCase();
  const tagged = tag.length > 0 && input.tags.some((item) => item.toLowerCase() === tag);
  const failed = RTO_SHIPMENT.has(input.shipment);
  if (tagged || failed || (input.fulfilled && (input.cancelled || input.refunded))) return 'rto';
  if (input.cancelled) return 'cancelled';
  if (input.shipment === 'delivered' || (input.fulfilled && input.financial.toLowerCase() === 'paid')) return 'delivered';
  return null;
}

export function mapRestOrder(body: Record<string, unknown>, rtoTag: string): MappedOrder | null {
  const id = body.id;
  if (id === undefined || id === null) return null;
  const address = (body.shipping_address || {}) as Record<string, unknown>;
  const customer = (body.customer || {}) as Record<string, unknown>;
  const fulfillments = Array.isArray(body.fulfillments) ? (body.fulfillments as Array<Record<string, unknown>>) : [];
  const refunds = Array.isArray(body.refunds) ? body.refunds : [];
  const lineItems = Array.isArray(body.line_items) ? (body.line_items as Array<Record<string, unknown>>) : [];
  const gateways = Array.isArray(body.payment_gateway_names) ? body.payment_gateway_names.map(String) : [];
  const tags = String(body.tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const shipment = String(fulfillments.at(-1)?.shipment_status || '').toLowerCase();
  const fulfilled = fulfillments.length > 0 || Boolean(body.fulfillment_status);
  const cancelled = Boolean(body.cancelled_at);
  const financial = String(body.financial_status || '');
  const outcome = outcomeOf({
    cancelled,
    fulfilled,
    shipment,
    refunded: refunds.length > 0,
    tags,
    rtoTag,
    financial,
  });
  const phone = String(address.phone || customer.phone || body.phone || '');
  const orderedAt = new Date(String(body.created_at || Date.now()));
  const cod = codFrom(gateways, financial);
  return {
    externalOrderId: String(body.name || id),
    shopifyGid: String(body.admin_graphql_api_id || `gid://shopify/Order/${id}`),
    buyerName: String(address.name || customer.first_name || 'Buyer').slice(0, 80),
    phone,
    address: [address.address1, address.address2].filter(Boolean).join(', ').slice(0, 400),
    city: String(address.city || '').slice(0, 80),
    state: String(address.province || '').slice(0, 80),
    pincode: String(address.zip || '').replace(/\s/g, '').slice(0, 12),
    orderValue: Math.max(0, Number(body.total_price || 0)),
    paymentType: cod ? 'cod' : 'prepaid',
    orderedAt,
    productName: String(lineItems[0]?.title || 'order').slice(0, 80),
    courier: String(fulfillments.at(-1)?.tracking_company || '').slice(0, 80),
    stage: outcome ? 'history' : 'pending',
    outcome,
    customerId: customer.id ? String(customer.id) : '',
  };
}

export function mapGraphqlOrder(node: Record<string, unknown>, rtoTag: string): MappedOrder | null {
  const gid = String(node.id || '');
  if (!gid) return null;
  const address = (node.shippingAddress || {}) as Record<string, unknown>;
  const customer = (node.customer || {}) as Record<string, unknown>;
  const money = ((node.totalPriceSet as { shopMoney?: { amount?: string } } | undefined)?.shopMoney || {}) as { amount?: string };
  const fulfillments = Array.isArray(node.fulfillments) ? (node.fulfillments as Array<Record<string, unknown>>) : [];
  const refunds = Array.isArray(node.refunds) ? node.refunds : [];
  const edges = ((node.lineItems as { edges?: Array<{ node?: { name?: string } }> } | undefined)?.edges) || [];
  const gateways = Array.isArray(node.paymentGatewayNames) ? node.paymentGatewayNames.map(String) : [];
  const tags = Array.isArray(node.tags) ? node.tags.map(String) : [];
  const display = String(node.displayFulfillmentStatus || '').toUpperCase();
  const financial = String(node.displayFinancialStatus || '');
  const fulfilled = fulfillments.length > 0 || display === 'FULFILLED' || display === 'PARTIALLY_FULFILLED';
  const cancelled = Boolean(node.cancelledAt);
  const statuses = fulfillments.map((item) => String(item.displayStatus || item.status || '').toLowerCase());
  const shipment = statuses.includes('attempted_delivery')
    ? 'attempted_delivery'
    : statuses.includes('failure') || statuses.includes('not_delivered')
      ? 'failure'
      : statuses.includes('delivered') || display === 'DELIVERED'
        ? 'delivered'
        : '';
  const outcome = outcomeOf({
    cancelled,
    fulfilled,
    shipment,
    refunded: refunds.length > 0,
    tags,
    rtoTag,
    financial,
  });
  const orderedAt = new Date(String(node.createdAt || Date.now()));
  const phone = String(address.phone || customer.phone || node.phone || '');
  return {
    externalOrderId: String(node.name || gid.split('/').pop()),
    shopifyGid: gid,
    buyerName: String(address.name || customer.displayName || 'Buyer').slice(0, 80),
    phone,
    address: [address.address1, address.address2].filter(Boolean).join(', ').slice(0, 400),
    city: String(address.city || '').slice(0, 80),
    state: String(address.province || '').slice(0, 80),
    pincode: String(address.zip || '').replace(/\s/g, '').slice(0, 12),
    orderValue: Math.max(0, Number(money.amount || 0)),
    paymentType: codFrom(gateways, financial) ? 'cod' : 'prepaid',
    orderedAt,
    productName: String(edges[0]?.node?.name || 'order').slice(0, 80),
    courier: '',
    stage: outcome ? 'history' : 'pending',
    outcome,
    customerId: customer.id ? String(customer.id) : '',
  };
}

export function hourOf(orderedAt: Date): number {
  return hourInKolkata(orderedAt);
}
