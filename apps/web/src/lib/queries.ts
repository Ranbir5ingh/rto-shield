'use client';

import { useEffect } from 'react';
import {
  keepPreviousData,
  QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { nextMlReachability } from '@/lib/ml-status';
import type { DashboardData, Integrations, OrderDetail, OrderSummary, PublicUser } from '@/lib/types';

export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  queue: ['queue'] as const,
  activity: ['activity'] as const,
  whatsapp: ['whatsapp'] as const,
  shopify: ['shopify'] as const,
  integrations: ['integrations'] as const,
  integrationsPublished: ['integrations-published'] as const,
  orders: (stage: string, offset: number, limit: number, outcome = '', q = '') => ['orders', stage, offset, limit, outcome, q] as const,
  order: (id: string) => ['order', id] as const,
};

export interface ShopifyLink {
  connected: boolean;
  demo: boolean;
  shop: string | null;
  backfill: { status: string; processed: number; total: number; error: string | null };
  rtoTag: string;
  autoCancelOnBuyerCancel: boolean;
  riskTags: { high: string; medium: string; low: string };
}

export interface WhatsAppLink {
  messaging?: 'platform' | 'own';
  useOwnNumber?: boolean;
  configured: boolean;
  demo: boolean;
  phoneNumberId: string;
  wabaId: string;
  tokenLast4: string;
  appSecretLast4: string;
  templateStatus: string;
  callbackUrl: string;
  verifyTokenName: string;
  verifyToken?: string;
  verifyTokenSet?: boolean;
  webhookVerified: boolean;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function fetchMe() {
  return api<{ user: PublicUser }>('/auth/me').then((body) => body.user);
}

export function fetchDashboard() {
  return api<DashboardData>('/dashboard');
}

export function fetchQueue(scope: 'action' | 'open' = 'action') {
  return api<{ orders: OrderDetail[] }>(scope === 'open' ? '/queue?scope=open' : '/queue');
}

export function fetchOrders(
  stage: string,
  offset: number,
  limit: number,
  filters?: { outcome?: string; q?: string },
) {
  const params = new URLSearchParams({ stage, limit: String(limit), offset: String(offset) });
  if (filters?.outcome) params.set('outcome', filters.outcome);
  if (filters?.q) params.set('q', filters.q);
  return api<{ total: number; orders: OrderSummary[] }>(`/orders?${params.toString()}`);
}

export function fetchOrder(id: string) {
  return api<OrderDetail>(`/orders/${id}`);
}

export async function fetchWhatsapp() {
  const body = await api<WhatsAppLink>('/whatsapp');
  if (!body.configured) return body;
  try {
    return await api<WhatsAppLink>('/whatsapp/template');
  } catch {
    return body;
  }
}

export function fetchShopify() {
  return api<ShopifyLink>('/shopify');
}

export function fetchIntegrations() {
  return api<Integrations>('/integrations');
}

export function useMe() {
  return useQuery({ queryKey: qk.me, staleTime: 60_000, queryFn: fetchMe });
}

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    staleTime: 20_000,
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const waiting = Boolean(data.upgrading) || data.model?.model === 'rules-prior';
      if (!waiting || query.state.dataUpdateCount >= 24) return false;
      return 2500;
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: qk.activity,
    staleTime: 15_000,
    queryFn: () => api<{ events: Array<{ at: string; step: string; detail: string; orderId: string; externalOrderId: string }> }>('/activity'),
  });
}

export function useQueue(scope: 'action' | 'open' = 'action') {
  return useQuery({
    queryKey: [...qk.queue, scope],
    staleTime: 15_000,
    queryFn: () => fetchQueue(scope),
  });
}

export function useOrders(stage: string, offset: number, limit: number, filters?: { outcome?: string; q?: string }) {
  return useQuery({
    queryKey: qk.orders(stage, offset, limit, filters?.outcome || '', filters?.q || ''),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchOrders(stage, offset, limit, filters),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: qk.order(id),
    enabled: Boolean(id),
    staleTime: 20_000,
    queryFn: () => fetchOrder(id),
  });
}

export function useWhatsapp() {
  return useQuery({ queryKey: qk.whatsapp, staleTime: 30_000, queryFn: fetchWhatsapp });
}

export function useShopify() {
  return useQuery({
    queryKey: qk.shopify,
    staleTime: 15_000,
    queryFn: fetchShopify,
    refetchInterval: (query) =>
      query.state.data?.connected && query.state.data.backfill.status === 'running' ? 2000 : false,
  });
}

let mlFailures = 0;
let lastIntegrationAt = 0;

/** Second miss before the banner, shared by every mounted reader of the same fetch. */
export function useIntegrations() {
  const client = useQueryClient();
  const raw = useQuery({
    queryKey: qk.integrations,
    queryFn: fetchIntegrations,
    staleTime: 0,
    retry: 0,
    refetchInterval: (query) => {
      if (query.state.status === 'error' || !query.state.data) return 2500;
      return query.state.data.ml.reachable ? 20_000 : 2500;
    },
  });
  const published = useQuery({
    queryKey: qk.integrationsPublished,
    enabled: false,
    staleTime: Infinity,
    queryFn: async () => null as Integrations | null,
  });

  useEffect(() => {
    if (!raw.data || raw.dataUpdatedAt === lastIntegrationAt) return;
    lastIntegrationAt = raw.dataUpdatedAt;
    const step = nextMlReachability(mlFailures, raw.data.ml.reachable);
    mlFailures = step.failures;
    if (step.publish) client.setQueryData(qk.integrationsPublished, raw.data);
  }, [client, raw.data, raw.dataUpdatedAt]);

  return (published.data ?? null) as Integrations | null;
}

export function prefetchRoute(client: QueryClient, href: string) {
  if (href === '/app') {
    void client.prefetchQuery({ queryKey: qk.dashboard, queryFn: fetchDashboard, staleTime: 20_000 });
  } else if (href === '/app/queue') {
    void client.prefetchQuery({ queryKey: [...qk.queue, 'action'], queryFn: () => fetchQueue('action'), staleTime: 15_000 });
    void client.prefetchQuery({ queryKey: qk.whatsapp, queryFn: fetchWhatsapp, staleTime: 30_000 });
  } else if (href === '/app/orders') {
    void client.prefetchQuery({
      queryKey: qk.orders('pending', 0, 12),
      queryFn: () => fetchOrders('pending', 0, 12),
      staleTime: 20_000,
    });
  } else if (href === '/app/history') {
    void client.prefetchQuery({ queryKey: qk.activity, queryFn: () => api('/activity'), staleTime: 15_000 });
  } else if (href === '/app/settings') {
    void client.prefetchQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 60_000 });
    void client.prefetchQuery({ queryKey: qk.integrations, queryFn: fetchIntegrations, staleTime: 0 });
  }
}

export function invalidateShop(client: QueryClient) {
  void client.invalidateQueries({ queryKey: qk.dashboard });
  void client.invalidateQueries({ queryKey: qk.queue });
  void client.invalidateQueries({ queryKey: qk.activity });
  void client.invalidateQueries({ queryKey: ['orders'] });
}
