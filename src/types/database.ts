export type AssetType =
  | 'land'
  | 'real_estate'
  | 'aircraft'
  | 'vessel'
  | 'energy'
  | 'private_credit'
  | 'infrastructure'

export type EventType = 'VALUATION' | 'LEASE' | 'REFINANCE'
export type UserRole = 'investor' | 'admin' | 'issuer'
export type DistributionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type OracleMethod = 'manual' | 'lease_income' | 'external_feed'
export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected' | 'expired'
export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'expired'
export type TradeStatus = 'pending' | 'settled' | 'failed'
export type AuthorizationStatus = 'pending' | 'authorized' | 'revoked'
export type RoyaltyFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
export type DocumentType = 'legal_filing' | 'llc_operating_agreement' | 'deed' | 'appraisal' | 'survey' | 'environmental' | 'title_insurance' | 'other'
export type AiSentiment = 'positive' | 'neutral' | 'negative' | 'mixed'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          address: string
          label: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['wallets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['wallets']['Insert']>
      }
      assets: {
        Row: {
          id: string
          asset_name: string
          asset_type: AssetType
          llc_name: string
          description: string | null
          location: string | null
          total_acres: number | null
          token_symbol: string
          token_supply: number
          issuer_wallet: string
          current_valuation: number
          nav_per_token: number
          annual_yield: number | null
          oracle_method: OracleMethod
          oracle_config: Record<string, unknown> | null
          require_auth: boolean
          owner_id: string | null
          is_active: boolean
          // New land-specific fields
          royalty_frequency: RoyaltyFrequency
          ai_rating: number | null
          ai_rating_updated_at: string | null
          land_type: string | null
          county: string | null
          state: string | null
          parcel_id: string | null
          zoning: string | null
          legal_description: string | null
          purchase_price: number | null
          purchase_date: string | null
          cover_image_url: string | null
          owner_retained_percent: number
          last_distribution_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['assets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['assets']['Insert']>
      }
      investor_holdings: {
        Row: {
          id: string
          wallet_address: string
          asset_id: string
          token_balance: number
          ownership_percent: number
          last_synced_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['investor_holdings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['investor_holdings']['Insert']>
      }
      valuations: {
        Row: {
          id: string
          asset_id: string
          event_type: EventType
          previous_value: number
          current_value: number
          nav_per_token: number
          notes: string | null
          recorded_by: string | null
          recorded_at: string
        }
        Insert: Omit<Database['public']['Tables']['valuations']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['valuations']['Insert']>
      }
      distributions: {
        Row: {
          id: string
          asset_id: string
          event_type: EventType
          total_amount: number
          currency: string
          reserve_amount: number
          distributable_amount: number
          status: DistributionStatus
          tx_hash: string | null
          notes: string | null
          triggered_by: string | null
          royalty_period: string | null
          is_royalty: boolean
          created_at: string
          completed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['distributions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['distributions']['Insert']>
      }
      distribution_payments: {
        Row: {
          id: string
          distribution_id: string
          wallet_address: string
          amount: number
          currency: string
          ownership_percent: number
          status: DistributionStatus
          tx_hash: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['distribution_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['distribution_payments']['Insert']>
      }
      issuer_updates: {
        Row: {
          id: string
          asset_id: string
          issuer_id: string
          title: string
          content: string
          quarter: string
          documents: unknown[]
          ai_analysis: string | null
          ai_rating: number | null
          ai_sentiment: AiSentiment | null
          published: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['issuer_updates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['issuer_updates']['Insert']>
      }
      asset_documents: {
        Row: {
          id: string
          asset_id: string
          document_type: DocumentType
          title: string
          file_name: string
          file_url: string | null
          file_size: number | null
          uploaded_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['asset_documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['asset_documents']['Insert']>
      }
      asset_contracts: {
        Row: {
          id: string
          asset_id: string
          file_name: string
          file_path: string
          tenant_name: string | null
          annual_amount: number | null
          payment_frequency: string | null
          payment_due_day: number | null
          lease_start_date: string | null
          lease_end_date: string | null
          escalation_rate: number | null
          escalation_type: string | null
          currency: string
          summary: string | null
          raw_extraction: Record<string, unknown> | null
          is_active: boolean
          parsed_at: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['asset_contracts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['asset_contracts']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      asset_type: AssetType
      event_type: EventType
      user_role: UserRole
      distribution_status: DistributionStatus
      oracle_method: OracleMethod
      kyc_status: KycStatus
      order_side: OrderSide
      order_status: OrderStatus
      trade_status: TradeStatus
    }
  }
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type WalletRow = Database['public']['Tables']['wallets']['Row']
export type AssetRow = Database['public']['Tables']['assets']['Row']
export type InvestorHoldingRow = Database['public']['Tables']['investor_holdings']['Row']
export type ValuationRow = Database['public']['Tables']['valuations']['Row']
export type DistributionRow = Database['public']['Tables']['distributions']['Row']
export type DistributionPaymentRow = Database['public']['Tables']['distribution_payments']['Row']
export type IssuerUpdateRow = Database['public']['Tables']['issuer_updates']['Row']
export type AssetDocumentRow = Database['public']['Tables']['asset_documents']['Row']
export type AssetContractRow = Database['public']['Tables']['asset_contracts']['Row']

// ── Custodial Wallet types ──

export type CustodialWalletType = 'investor' | 'token'

export interface CustodialWalletRow {
  id: string
  user_id: string | null
  address: string
  encrypted_seed: string
  encryption_method: string
  kms_key_id: string | null
  is_primary: boolean
  wallet_type: CustodialWalletType
  label: string | null
  asset_id: string | null
  created_at: string
  updated_at: string
}

/** Safe view — no encrypted_seed exposed */
export interface CustodialWalletSafe {
  id: string
  user_id: string | null
  address: string
  encryption_method: string
  is_primary: boolean
  wallet_type: CustodialWalletType
  label: string | null
  asset_id: string | null
  created_at: string
  updated_at: string
}

// ── Permission Domain types ──

export interface PlatformInvestorRow {
  id: string
  user_id: string | null
  wallet_address: string
  full_name: string | null
  email: string | null
  kyc_status: KycStatus
  kyc_provider: string | null
  kyc_reference: string | null
  kyc_verified_at: string | null
  kyc_expires_at: string | null
  aml_cleared: boolean
  accredited: boolean
  country_code: string | null
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface PlatformAuthorizationRow {
  id: string
  investor_id: string
  asset_id: string
  status: AuthorizationStatus
  xrpl_tx_hash: string | null
  authorized_at: string | null
  authorized_by: string | null
  created_at: string
}

export interface MarketplaceOrderRow {
  id: string
  investor_id: string
  asset_id: string
  side: OrderSide
  token_amount: number
  price_per_token: number
  currency: string
  filled_amount: number
  status: OrderStatus
  expires_at: string | null
  xrpl_offer_id: string | null
  xrpl_offer_tx: string | null
  created_at: string
  updated_at: string
}

export interface TradeRow {
  id: string
  buy_order_id: string | null
  sell_order_id: string | null
  asset_id: string
  buyer_id: string
  seller_id: string
  token_amount: number
  price_per_token: number
  total_price: number
  currency: string
  status: TradeStatus
  xrpl_tx_hash: string | null
  settled_at: string | null
  created_at: string
}

export interface PlatformSettingsRow {
  id: string
  platform_name: string
  domain_wallet: string | null
  require_kyc: boolean
  require_aml: boolean
  require_accreditation: boolean
  auto_authorize_tokens: boolean
  marketplace_enabled: boolean
  marketplace_fee_bps: number
  tokenization_fee_bps: number
  updated_at: string
}

// ── MoonPay types ──

export interface MoonPayTransactionRow {
  id: string
  user_id: string
  moonpay_id: string | null
  status: string
  fiat_amount: number | null
  fiat_currency: string
  crypto_amount: number | null
  crypto_currency: string
  wallet_address: string | null
  external_id: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export type MoonPayPendingBuyStatus = 'awaiting_deposit' | 'executed' | 'failed'

export interface MoonPayPendingBuyRow {
  id: string
  user_id: string
  order_id: string | null
  asset_id: string
  token_symbol: string
  token_amount: number
  price_per_token: number
  issuer_wallet: string
  pay_currency: string
  status: MoonPayPendingBuyStatus
  xrpl_tx_hash: string | null
  xrpl_result: string | null
  error: string | null
  executed_at: string | null
  created_at: string
}

// Extended types with joins
export type AssetWithHolding = AssetRow & {
  holding: InvestorHoldingRow | null
}

export type DistributionWithPayment = DistributionRow & {
  payment: DistributionPaymentRow | null
  asset: Pick<AssetRow, 'asset_name' | 'token_symbol'>
}

export type PlatformInvestorWithAuths = PlatformInvestorRow & {
  platform_authorizations: PlatformAuthorizationRow[]
}

export type MarketplaceOrderWithDetails = MarketplaceOrderRow & {
  asset: Pick<AssetRow, 'asset_name' | 'token_symbol' | 'nav_per_token'>
  investor: Pick<PlatformInvestorRow, 'wallet_address' | 'full_name'>
}

// Issuer-specific join types
export type AssetWithUpdates = AssetRow & {
  issuer_updates: IssuerUpdateRow[]
}

export type AssetWithDocuments = AssetRow & {
  asset_documents: AssetDocumentRow[]
}

export type AssetFull = AssetRow & {
  issuer_updates: IssuerUpdateRow[]
  asset_documents: AssetDocumentRow[]
  investor_holdings: InvestorHoldingRow[]
}
