export interface MlOrder {
  id: string;
  order_value: number;
  is_cod: boolean;
  hour: number;
  prior_orders: number;
  prior_rtos: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  seller_pin_rto_rate?: number;
  seller_pin_n?: number;
  label?: number;
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

export interface Prediction {
  id: string;
  score: number;
  probability: number;
  band: 'Low' | 'Medium' | 'High';
  reasons: string[];
  address_quality: AddressQuality;
  model: string;
}

export interface PredictResponse {
  model: string;
  model_label: string;
  metrics: {
    auc: number | null;
    precision_at_top_10pct: number | null;
    n_train: number;
    n_test: number;
    positive_rate_test: number;
  } | null;
  predictions: Prediction[];
  warnings: string[];
  address_source: string;
  feature_columns: string[];
}

export interface MlMessage {
  id: string;
  hindi: string;
  hinglish: string;
  english: string;
  prepaid_nudge: string;
  voice_script_hi: string;
  source: string;
}

export interface MlHealth {
  ok: boolean;
  tabpfn_token: boolean;
  tabpfn_client_installed: boolean;
  tabpfn_local_installed: boolean;
  gemini: boolean;
  /** True when a Gemma call answered, false when it cannot, null while the probe is in flight. */
  gemma_ready?: boolean | null;
  ollama_configured: boolean;
  sentry: boolean;
  active_predictor: string;
}
