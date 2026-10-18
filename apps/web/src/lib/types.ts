export interface PublicUser {
  id: string;
  email: string;
  name: string;
  shopName: string;
  rtoCostInr: number;
  messageLanguage: 'hindi' | 'hinglish' | 'english';
  role?: 'owner' | 'staff' | 'demo';
  isDemo?: boolean;
  officialDemo?: boolean;
  sellerGemini?: boolean;
  tour?: { sellerSeen: boolean; demoSeen: boolean };
  reduction?: {
    autopilot: boolean;
    prepaidEnabled: boolean;
    discountPct: number;
    minRisk: number;
    escalationMinutes: number;
    noReply: 'hold' | 'cancel';
  };
  elevenlabsConfigured?: boolean;
  elevenlabsLast4?: string;
}

export type Intervention = 'auto_confirm' | 'request_address' | 'offer_prepaid' | 'hold_review' | 'confirm';

export interface PrepaidOffer {
  invoiceUrl: string;
  discountPct: number;
  status: 'offered' | 'paid' | 'expired' | 'converted' | 'declined';
  linkedOrderId: string;
  expiresAt: string;
}

export interface TimelineEvent {
  at: string;
  step: string;
  detail: string;
}

export interface AddressQuality {
  quality_score: number;
  incomplete: boolean;
  landmark_only: boolean;
  junk: boolean;
  pincode_mismatch: boolean;
  notes: string;
  source: string;
}

export interface OrderSummary {
  id: string;
  externalOrderId: string;
  buyerName: string;
  phoneMasked: string;
  city: string;
  state: string;
  pincode: string;
  orderValue: number;
  paymentType: 'cod' | 'prepaid';
  orderedAt: string;
  hour: number;
  priorOrders: number;
  priorRtos: number;
  productName: string;
  courier: string;
  stage: 'history' | 'pending' | 'closed';
  outcome: string | null;
  source: string;
  riskScore: number | null;
  riskBand: 'Low' | 'Medium' | 'High' | null;
  reasons: string[];
  addressQuality: AddressQuality | null;
  model: string | null;
  whatsappStatus?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  shopifyGid?: string;
  intervention?: Intervention | null;
  interventionWhy?: string;
  callState?: 'idle' | 'due' | 'called' | 'held';
  callDueAt?: string | null;
  addressFixedAt?: string | null;
  exception?: 'address' | 'template_pending' | 'send' | 'call' | 'shopify' | null;
  exceptionWhy?: string;
  addressReply?: string;
  addressDraft?: { street: string; landmark: string; city: string; state: string; pin: string } | null;
  prepaid?: PrepaidOffer | null;
}

export interface OrderDetail extends OrderSummary {
  address: string;
  messages: {
    hindi: string;
    hinglish: string;
    english: string;
    prepaid_nudge: string;
    voice_script_hi: string;
    source: string;
  } | null;
  waUrl: string | null;
  conversation?: Array<{ at: string; direction: 'in' | 'out'; kind: string; text: string }>;
  timeline?: TimelineEvent[];
}

export interface ModelSnapshot {
  model: string;
  modelLabel: string;
  metrics: {
    auc: number | null;
    precision_at_top_10pct: number | null;
    n_train: number;
    n_test: number;
    positive_rate_test: number;
  } | null;
  addressSource: string;
  warnings: string[];
  createdAt: string | null;
}

export interface LiveWireOrder {
  id: string;
  externalOrderId: string;
  city: string;
  orderValue: number;
  riskBand: 'Low' | 'Medium' | 'High' | null;
  riskScore: number | null;
}

export interface DashboardData {
  rtoRate: number | null;
  delivered: number;
  rto: number;
  savedInr: number;
  prevented: number;
  rtoCostInr: number;
  exposureInr: number;
  highPending: number;
  upgrading?: boolean;
  trend: Array<{ week: string; delivered: number; rto: number; rate: number | null }>;
  distribution: { Low: number; Medium: number; High: number };
  topReasons: Array<{ reason: string; count: number }>;
  model: ModelSnapshot | null;
  counts: { history: number; pending: number; closed: number };
  liveWire?: LiveWireOrder[];
  actionToday?: number;
  confirmationRate?: number | null;
  pinInsights?: Array<{ pincode: string; orders: number; rto: number; rate: number }>;
  buyers?: { fresh: number; repeat: number };
  impact?: { preventedInr: number; conversions: number; addressFixes: number; confirmations: number };
}

export interface Integrations {
  sellerView?: boolean;
  encryption: 'configured' | 'development-fallback';
  mongodb: 'memory' | 'configured';
  sentry: boolean;
  elevenlabs: boolean;
  serpapi: boolean;
  ml: {
    reachable: boolean;
    activePredictor: string | null;
    tabpfnToken: boolean;
    gemini: boolean;
    /** True when Gemma answered, false when it cannot, null or absent while unknown. */
    gemmaReady?: boolean | null;
    ollama: boolean;
    tabpfnClientInstalled: boolean;
    tabpfnLocalInstalled: boolean;
  };
}

export interface ColumnMapping {
  orderId?: string;
  buyerName: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  pincode: string;
  orderValue: string;
  paymentType?: string;
  orderedAt?: string;
  outcome?: string;
  priorOrders?: string;
  priorRtos?: string;
  productName?: string;
  courier?: string;
}
