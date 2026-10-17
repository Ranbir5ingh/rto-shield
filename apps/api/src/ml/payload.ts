import type { MlOrder } from './ml.types';

export function trainingLabel(outcome: string | null): number | undefined {
  if (outcome === 'delivered' || outcome === 'confirmed' || outcome === 'converted') return 0;
  if (outcome === 'rto' || outcome === 'cancelled') return 1;
  return undefined;
}

/** Features plus the address text. Phone and buyer name are intentionally absent. */
export function toMlOrder(input: {
  id: string;
  orderValue: number;
  paymentType: 'cod' | 'prepaid';
  hour: number;
  priorOrders: number;
  priorRtos: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  outcome: string | null;
  sellerPinRtoRate?: number;
  sellerPinN?: number;
}): MlOrder {
  const label = trainingLabel(input.outcome);
  return {
    id: input.id,
    order_value: input.orderValue,
    is_cod: input.paymentType === 'cod',
    hour: input.hour,
    prior_orders: input.priorOrders,
    prior_rtos: Math.min(input.priorRtos, input.priorOrders),
    address: input.address.slice(0, 500),
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    seller_pin_rto_rate: input.sellerPinRtoRate ?? 0.3,
    seller_pin_n: input.sellerPinN ?? 0,
    ...(label === undefined ? {} : { label }),
  };
}
