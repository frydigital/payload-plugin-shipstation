/**
 * Lightspeed X-Series API Types
 * Based on the official API documentation at https://x-series-api.lightspeedhq.com/reference
 */

// ============ Configuration Types ============

export interface LightspeedPluginConfig {
  /**
   * Lightspeed domain prefix (e.g., 'yourstore' for yourstore.retail.lightspeed.app)
   */
  domainPrefix: string

  /**
   * OAuth2 Client ID from Lightspeed Developer Portal
   */
  clientId: string

  /**
   * OAuth2 Client Secret from Lightspeed Developer Portal
   */
  clientSecret: string

  /**
   * OAuth2 Redirect URI (must match the one registered in Lightspeed)
   */
  redirectUri: string

  /**
   * OAuth2 Scopes (space-delimited string or array)
   * Required starting June 1, 2026
   * Example: 'products:read sales:read customers:read'
   * See: https://x-series-api.lightspeedhq.com/docs/authorization
   */
  scopes?: string | string[]

  /**
   * Personal Access Token (alternative to OAuth flow)
   */
  personalToken?: string

  /**
   * API Version to use (default: '2.0')
   */
  apiVersion?: '0.9' | '2.0' | '2.1' | '3.0' | '2026-01'

  /**
   * Rate limit configuration
   */
  rateLimit?: {
    maxRequestsPerMinute?: number
    retryOnRateLimit?: boolean
    maxRetries?: number
  }

  /**
   * Webhook configuration
   */
  webhooks?: {
    enabled?: boolean
    secret?: string
    verifySignature?: boolean
  }

  /**
   * Import products as draft by default
   */
  importAsDraft?: boolean

  /**
   * Default outlet ID for inventory operations
   */
  defaultOutletId?: string

  /**
   * Default register ID for sales operations
   */
  defaultRegisterId?: string

  /**
   * Default user ID (staff member) for sales operations
   */
  defaultUserId?: string
}

// ============ Auth Types ============

export interface LightspeedTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires: number // Unix timestamp
  expires_in: number // Seconds until expiration
  refresh_token?: string
  domain_prefix?: string
  /**
   * Space-delimited list of granted scopes
   * The access token can only call endpoints whose required scopes are a subset of this list
   */
  scope?: string
}

export interface LightspeedAuthConfig {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  domainPrefix: string
  /**
   * Granted scopes (space-delimited string)
   * The access token can only call endpoints whose required scopes are a subset of this list
   */
  scope?: string
}

// ============ Pagination Types ============

export interface PaginationParams {
  after?: number // Version number lower limit
  before?: number // Version number upper limit
  page_size?: number
  offset?: number
  deleted?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  version?: {
    min: number
    max: number
  }
}

// ============ Product Types ============

export interface LightspeedProduct {
  id: string
  source_id?: string | null
  source_variant_id?: string | null
  variant_parent_id?: string | null
  name: string
  variant_name?: string
  handle?: string
  sku: string
  supplier_code?: string | null
  active: boolean
  has_inventory: boolean
  is_composite: boolean
  description?: string
  image_url?: string
  image_thumbnail_url?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  source?: string
  account_code?: string | null
  account_code_purchase?: string | null
  supply_price?: number
  version: number
  type?: LightspeedProductType | null
  supplier?: LightspeedSupplier | null
  brand?: LightspeedBrand | null
  variant_options?: LightspeedVariantOption[]
  categories?: LightspeedTag[]
  images?: LightspeedProductImage[]
  has_variants: boolean
  variant_count?: number | null
  button_order?: number
  price_excluding_tax?: number
  loyalty_amount?: number | null
  attributes?: Record<string, unknown>
  supplier_id?: string | null
  product_type_id?: string | null
  brand_id?: string | null
  is_active: boolean
  tag_ids?: string[]
  inventory?: LightspeedInventory[]
  taxes?: LightspeedProductTax[]
}

export interface LightspeedProductType {
  id: string
  name: string
  deleted_at?: string | null
  version: number
}

export interface LightspeedProductImage {
  id: string
  product_id?: string
  position?: number
  status?: 'processing' | 'complete' | 'error'
  version?: number
  url?: string
  sizes?: {
    ss?: string
    standard?: string
    st?: string
    original?: string
    thumb?: string
    sl?: string
    sm?: string
  }
}

export interface LightspeedVariantOption {
  id: string
  name: string
  value: string
}

export interface LightspeedInventory {
  id?: string
  product_id?: string
  outlet_id: string
  outlet_name?: string
  count?: string | number
  current_amount?: number
  inventory_level?: number
  reorder_point?: string | number
  restock_level?: string | number
  reorder_amount?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

export interface LightspeedProductTax {
  outlet_id: string
  tax_id: string
  is_default?: boolean
}

// ============ Brand Types ============

export interface LightspeedBrand {
  id: string
  name: string
  deleted_at?: string | null
  version: number
}

// =========== Product Type / Category Types =======

export interface LightspeedCategory {
  id: string
  name: string
  leaf_category: boolean
  category_path?: LightspeedCategoryPath[]
  deleted_at?: string | null
  version: number
}

export interface LightspeedCategoryPath {
  id: string
  name: string
}

// ============ Tag/Category Types ============

export interface LightspeedTag {
  id: string
  name: string
  deleted_at?: string | null
  version: number
}

// ============ Supplier Types ============

export interface LightspeedSupplier {
  id: string
  retailer_id?: string
  name: string
  description?: string
  source?: string
  source_id?: string | null
  contact?: LightspeedContact
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

export interface LightspeedContact {
  first_name?: string
  last_name?: string
  company_name?: string
  phone?: string
  mobile?: string
  fax?: string
  email?: string
  twitter?: string
  website?: string
  physical_address1?: string
  physical_address2?: string
  physical_suburb?: string
  physical_city?: string
  physical_postcode?: string
  physical_state?: string
  physical_country_id?: string
  postal_address1?: string
  postal_address2?: string
  postal_suburb?: string
  postal_city?: string
  postal_postcode?: string
  postal_state?: string
  postal_country_id?: string
}

// ============ Customer Types ============

export interface LightspeedCustomer {
  id: string
  customer_code?: string
  name?: string
  first_name?: string
  last_name?: string
  email?: string
  year_to_date?: number
  balance?: number
  loyalty_balance?: number
  note?: string | null
  gender?: string | null
  date_of_birth?: string | null
  company_name?: string
  do_not_email?: boolean
  contact_source?: string | null
  phone?: string | null
  mobile?: string | null
  fax?: string | null
  twitter?: string | null
  website?: string | null
  physical_address_1?: string | null
  physical_address_2?: string | null
  physical_suburb?: string | null
  physical_city?: string | null
  physical_postcode?: string | null
  physical_state?: string | null
  physical_country_id?: string | null
  postal_address_1?: string | null
  postal_address_2?: string | null
  postal_suburb?: string | null
  postal_city?: string | null
  postal_postcode?: string | null
  postal_state?: string | null
  postal_country_id?: string | null
  customer_group_id?: string
  enable_loyalty?: boolean
  custom_field_1?: string | null
  custom_field_2?: string | null
  custom_field_3?: string | null
  custom_field_4?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

export interface LightspeedCustomerGroup {
  id: string
  name: string
  group_id?: string
  retailer_id?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

// ============ Promotion Types ============

export interface LightspeedPromotion {
  id: string
  name: string
  description?: string
  start_time?: string
  end_time?: string
  condition?: LightspeedPromotionCondition
  action?: LightspeedPromotionAction
  loyalty_multiplier?: number
  outlet_ids?: string[]
  channels?: string[]
  customer_group_ids?: string[]
  status?: string
  use_promo_code?: boolean
  promo_codes?: LightspeedPromoCode[]
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

export interface LightspeedPromotionCondition {
  type: 'product_set' | 'cart_total' | 'customer_group' | string
  quantity?: number
  min_price?: number
  min_quantity?: number
  max_quantity?: number
  include?: LightspeedProductFilter[]
  exclude?: LightspeedProductFilter[]
}

export interface LightspeedPromotionAction {
  type: 'basic_percent_discount' | 'basic_fixed_discount' | 'fixed_price' | 'buy_x_get_y' | string
  quantity?: number
  value?: number
  min_quantity?: number
  max_quantity?: number
  include?: LightspeedProductFilter[]
  exclude?: LightspeedProductFilter[]
}

export interface LightspeedProductFilter {
  field: 'brand_id' | 'product_id' | 'tag_id' | 'product_type_id' | string
  value: string
}

export interface LightspeedPromoCode {
  id: string
  promotion_id?: string
  code: string
  redeemed?: number
  limit?: number
  created_at?: string
  group_name?: string
}

// ============ Sales/Order Types ============

export interface LightspeedSale {
  id: string
  retailer_id?: string
  outlet_id?: string
  register_id: string
  customer_id?: string | null
  user_id?: string
  sale_date: string
  status:
    | 'SAVED'
    | 'CLOSED'
    | 'VOIDED'
    | 'ONACCOUNT'
    | 'ONACCOUNT_CLOSED'
    | 'LAYBY'
    | 'LAYBY_CLOSED'
    | 'RETURN'
  state?: string // e.g. 'closed', 'saved'
  note?: string | null
  short_code?: string
  invoice_number?: string
  invoice_sequence?: number
  return_for?: string | null
  receipt_number?: string
  total_price?: number
  total_cost?: number
  total_tax?: number
  total_loyalty?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
  attributes?: Array<Record<string, unknown>>
  line_items?: LightspeedSaleLineItemResponse[]
  payments?: LightspeedSalePaymentResponse[]
  adjustments?: LightspeedSaleAdjustment[]
  taxes?: LightspeedSaleTaxResponse[]
  // Legacy fields for backwards compatibility
  register_sale_products?: LightspeedSaleProduct[]
  register_sale_payments?: LightspeedSalePayment[]
  source?: string
  source_id?: string | null
  accounts_transaction_id?: string | null
}

export interface LightspeedSaleProduct {
  id?: string
  product_id: string
  register_id?: string
  sequence?: number
  quantity: number
  price: number
  cost?: number
  discount?: number
  loyalty_value?: number
  tax?: number
  tax_id?: string
  status?: 'CONFIRMED' | 'PENDING'
  price_set?: number
  attributes?: Record<string, unknown>
  note?: string
}

export interface LightspeedSalePayment {
  id?: string
  register_id?: string
  retailer_payment_type_id: string
  payment_date?: string
  amount: number
}

export interface LightspeedSaleTax {
  id?: string
  tax_id: string
  name?: string
  rate?: number
  tax?: number
}

// ============ Actual API Response Types ============

export interface LightspeedTaxComponent {
  rate_id: string
  total_tax: number
}

export interface LightspeedSaleLineItemResponse {
  id: string
  product_id: string
  tax_id?: string
  discount_total: number
  discount: number
  price_total: number
  price: number
  cost_total: number
  cost: number
  tax_total: number
  tax: number
  quantity: number
  loyalty_value: number
  price_set: boolean
  status: 'CONFIRMED' | 'PENDING'
  sequence: number
  tax_components?: LightspeedTaxComponent[]
  unit_cost: number
  unit_discount: number
  unit_loyalty_value: number
  unit_price: number
  unit_tax: number
  total_cost: number
  total_discount: number
  total_loyalty_value: number
  total_price: number
  total_tax: number
  is_return: boolean
}

export interface LightspeedSalePaymentResponse {
  id: string
  register_id: string
  outlet_id: string
  retailer_payment_type_id: string
  payment_type_id: string
  name: string
  amount: number
  payment_date: string
  external_attributes?: Array<Record<string, unknown>>
}

export interface LightspeedSaleAdjustment {
  type: string // e.g. 'NON_CASH_FEE'
  name: string
  value: number
}

export interface LightspeedSaleTaxResponse {
  id: string
  amount: number
}

export interface LightspeedRegisterSaleInput {
  id?: string
  source?: string
  source_id?: string
  register_id: string
  market_id?: string
  customer_id?: string
  user_id?: string
  user_name?: string
  sale_date?: string
  created_at?: string
  updated_at?: string
  total_price?: number
  total_cost?: number
  total_tax?: number
  tax_name?: string
  note?: string
  status?: 'SAVED' | 'CONFIRMED' | string
  state?: 'parked' | 'pending' | 'voided' | 'closed'
  register_sale_attributes?: []
  short_code?: string
  invoice_number?: string
  accounts_transaction_id?: string
  register_sale_products: LightspeedRegisterSaleProduct[]
  register_sale_payments?: LightspeedRegisterSalePayment[]
}

export interface LightspeedRegisterSalePayment {
  retailer_payment_type_id: string
  payment_date?: string
  amount: number
}

export interface LightspeedRegisterSaleProduct {
  id?: string
  product_id: string
  register_id?: string
  sequence?: string
  handle?: string
  sku?: string
  name?: string
  quantity: number
  price: number
  cost?: number
  price_set?: '0' | '1'
  discount?: number
  loyalty_value?: number
  tax?: number
  tax_id?: string
  tax_name?: string
  tax_rate?: number
  tax_total?: number
  price_total?: number
  status?: 'CONFIRMED' | 'SAVED' | null
  attributes?: Array<{ name: string; value: string }>
}
// ============ Outlet Types ============

export interface LightspeedOutlet {
  id: string
  name: string
  time_zone?: string
  default_tax_id?: string
  currency?: string
  currency_symbol?: string
  display_prices?: 'inclusive' | 'exclusive'
  physical_address_1?: string
  physical_address_2?: string
  physical_suburb?: string
  physical_city?: string
  physical_postcode?: string
  physical_state?: string
  physical_country_id?: string
  email?: string
  latitude?: number | null
  longitude?: number | null
  attributes?: Array<{ key: string; value: string }>
  deleted_at?: string | null
  version?: number
}

// ============ Register Types ============

export interface LightspeedRegister {
  id: string
  name: string
  outlet_id?: string
  ask_for_note_on_save?: boolean
  print_note_on_receipt?: boolean
  ask_for_user_on_sale?: boolean
  show_discounts_on_receipts?: boolean
  print_receipt?: boolean
  email_receipt?: boolean
  invoice_prefix?: string
  invoice_suffix?: string
  invoice_sequence?: number
  register_open_sequence_id?: string | null
  register_open_time?: string | null
  register_close_time?: string | null
  status?: 'OPEN' | 'CLOSED'
  deleted_at?: string | null
  version?: number
}

// ============ Tax Types ============

export interface LightspeedTax {
  id: string
  name: string
  rate: number
  is_default?: boolean
  deleted_at?: string | null
  version?: number
}

// ============ Payment Type Types ============

export interface LightspeedPaymentType {
  id: string
  name: string
  type_id?: number
  config?: Record<string, unknown>
  deleted_at?: string | null
  version?: number
}
// ============ Sale/Cart Types ============

export interface LightspeedSaleLineItemInput {
  handle: string
  product_id: string
  product_brand_id: string
  product_supplier_id: string
  product_type_id: string
  product_tag_ids: string[]
  quantity: number
  unit_price: number
  unit_tax_discount: number
}

export interface LightspeedPromotionAdjustment {
  PromotionID: string
  Amount: number
  AmountTax: number
}

export interface LightspeedProductCategory {
  id: string
  category_path: LightspeedCategoryPath[] | null
}

export interface LightspeedSaleLineItem {
  id: string
  handle: string
  product_id: string
  product_brand_id: string
  product_supplier_id: string
  product_type_id: string
  product_category: LightspeedProductCategory
  product_tag_ids: string[]
  variant_parent_id: string
  quantity: number
  unit_price: number
  price_adjusted: boolean
  confirmed: boolean
  loyalty_value: number
  explicit_loyalty_value: boolean
  unit_discount: number
  unit_tax: number
  unit_tax_discount: number
  promotion_ids: string[]
  PromotionAdjustmentDetails: Record<string, LightspeedPromotionAdjustment>
  metadata: Record<string, unknown> | null
}

export interface LightspeedCalculatedSale {
  line_items: LightspeedSaleLineItem[]
  total_price: number
  total_tax: number
  sale_date: string
}

export interface LightspeedPromotionInfo {
  id: string
  name: string
  description: string
  start_time: string
  end_time: string | null
}

export interface LightspeedSaleCalculation {
  sale: LightspeedCalculatedSale
  promotions: LightspeedPromotionInfo[]
  potential_promotion: LightspeedPromotionInfo | null
}
// ============ User Types ============

export interface LightspeedUser {
  id: string
  username?: string
  display_name?: string
  email?: string
  email_verified_at?: string
  restricted_outlet_id?: string | null
  restricted_outlet_ids?: string[]
  account_type?: 'admin' | 'manager' | 'cashier' | 'reporting' | string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  seen_at?: string
  target_daily?: number
  target_weekly?: number
  target_monthly?: number
  version?: number
  is_primary_user?: boolean
  images?: {
    ss?: string
    standard?: string
    st?: string
    original?: string
    thumb?: string
    sl?: string
    sm?: string
  }
}

// ============ Retailer Types ============

export interface LightspeedRetailer {
  id: string
  display_name?: string
  domain_prefix: string
  currency?: string
  currency_symbol?: string
  time_zone?: string
  contact?: LightspeedContact
  physical_address?: LightspeedContact
  postal_address?: LightspeedContact
  business_number?: string
  default_customer_group_id?: string
  created_at?: string
  updated_at?: string
}

// ============ Consignment Types ============

export interface LightspeedConsignment {
  id: string
  outlet_id: string
  name: string
  due_at?: string
  type: 'SUPPLIER' | 'OUTLET' | 'STOCKTAKE' | 'RETURN'
  status:
    | 'OPEN'
    | 'SENT'
    | 'DISPATCHED'
    | 'RECEIVED'
    | 'CANCELLED'
    | 'STOCKTAKE'
    | 'STOCKTAKE_SCHEDULED'
    | 'STOCKTAKE_IN_PROGRESS'
    | 'STOCKTAKE_IN_PROGRESS_PROCESSED'
    | 'STOCKTAKE_COMPLETE'
    | 'CLOSED'
  supplier_id?: string | null
  source_outlet_id?: string | null
  consignment_date?: string
  received_at?: string | null
  show_inactive?: boolean
  supplier_invoice?: string
  reference?: string | null
  total_count_gain?: number | null
  total_cost_gain?: number | null
  total_count_loss?: number | null
  total_cost_loss?: number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
  filters?: unknown[]
}

export interface LightspeedConsignmentProduct {
  id?: string
  product_id: string
  product_sku?: string
  count: string | number
  received: string | number
  cost?: string | number
  is_included?: boolean
  status?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  version?: number
}

// ============ Webhook Types ============

export interface LightspeedWebhook {
  id: string
  retailer_id?: string
  user_id?: string
  url: string
  active: boolean
  type: 'product.update' | 'inventory.update' | 'sale.update' | 'customer.update' | string
  created_at?: string
  updated_at?: string
}

export interface LightspeedWebhookPayload {
  retailer_id: string
  domain_prefix: string
  payload: {
    [key: string]: unknown
  }
  type: string
  version?: number
}

// ============ Search Types ============

export interface LightspeedSearchParams {
  type: 'sales' | 'products' | 'customers'
  order_by?: string
  order_direction?: 'asc' | 'desc'
  page_size?: number
  offset?: number
  deleted?: boolean
  // Sales specific
  status?: string | string[]
  invoice_number?: string
  customer_id?: string
  user_id?: string
  outlet_id?: string
  date_from?: string
  date_to?: string
  // Products specific
  sku?: string | string[]
  supplier_id?: string | string[]
  brand_id?: string | string[]
  tag_id?: string | string[]
  product_type_id?: string | string[]
  variant_parent_id?: string | string[]
  // Customers specific
  customer_code?: string
  email?: string
  first_name?: string
  last_name?: string
  company_name?: string
  mobile?: string
  phone?: string
}

// ============ Cart Types ============

export interface LightspeedCartItem {
  // Shared fields
  id: string // Local client ID (maps to line_items.id or register_sale_products.id)
  product_id: string // Product ID (both APIs)
  quantity: number // Quantity (both APIs)
  max_quantity?: number // Pulled from Payload Type

  // Pricing fields (both APIs but different names)
  unit_price: number // Unit price (line_items) / price (register_sale_products) - SALE PRICE customer pays
  price?: number // Alias for unit_price (register_sale_products)
  original_unit_price?: number // Original price before discount (for strikethrough display)
  unit_discount?: number // Discount value (line_items) - POSITIVE for display
  discount?: number // Alias for unit_discount (register_sale_products)
  unit_tax?: number // Unit tax (line_items) / tax (register_sale_products)
  tax?: number // Alias for unit_tax (register_sale_products)

  // Tax configuration
  tax_id?: string // Tax ID (register_sale_products)
  unit_tax_discount?: number // Unit tax discount (line_items)

  // Totals (calculated)
  total_price: number // Total price for line item
  total_discount?: number // Total discount for line item
  total_tax?: number // Total tax for line item

  // Product details (line_items)
  handle?: string // Product handle (line_items)
  product_brand_id?: string // Brand ID (line_items)
  product_supplier_id?: string // Supplier ID (line_items)
  product_type_id?: string // Type ID (line_items)
  product_tag_ids?: Array<{ tag_id: string }> // Tag IDs (Payload array format)
  variant_parent_id?: string // Variant parent ID (line_items)

  // Price adjustments (line_items)
  price_adjusted?: boolean // Manual price adjustment indicator (line_items)
  confirmed?: boolean // Confirmed for layby/on account (line_items)

  // Loyalty (both APIs)
  loyalty_value?: number // Loyalty value (both)
  explicit_loyalty_value?: boolean // Explicit loyalty flag (line_items)

  // Promotions (line_items)
  promotion_ids?: Array<{ promotion_id: string }> // Applied promotion IDs (Payload array format)
  promotion_names?: Array<{ promotion_name: string }> // Promotion names for display (Payload array format)

  // Register sale specific fields (register_sale_products)
  register_id?: string // Register ID (register_sale_products)
  sequence?: number // Line item order (register_sale_products)
  cost?: number // Unit cost (register_sale_products)
  price_set?: number // Fixed price indicator 0/1 (register_sale_products)
  salesperson_id?: string // Salesperson ID (register_sale_products)
  status?: 'CONFIRMED' | null // Line item status - CONFIRMED locks item (register_sale_products)
  fulfillment_type?: 'DISPATCH' | 'PICKUP' // Fulfillment type (register_sale_products)
  attributes?: Array<{ key: string; value: string }> // Additional attributes (register_sale_products)

  // Display fields (for UI)
  product_name?: string // Product name (UI)
  product_sku?: string // Product SKU (UI)
  variant_name?: string // Variant name (UI)
  image_url?: string // Product image (UI)
}

export interface LightspeedCart {
  id: string // Payload cart ID
  sale_id?: string | null // Lightspeed sale ID (created on first add)
  status: 'active' | 'saved' | 'completed' | 'abandoned'
  customer?: (string | null) | unknown
  customer_id?: string | null
  items?: LightspeedCartItem[] | null
  subtotal: number
  total_discount: number
  total_tax: number
  total: number
  currency: string | null
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | null
  session_metadata?:
    | {
        [k: string]: unknown
      }
    | unknown[]
    | string
    | number
    | boolean
    | null
  updatedAt: string
  createdAt: string
}

export interface LightspeedCartCreateInput {
  customer_id?: string
  items?: LightspeedCartItem[]
}

export interface LightspeedCartUpdateInput {
  items?: LightspeedCartItem[]
  customer_id?: string
  status?: 'active' | 'saved' | 'completed' | 'abandoned'
}

// ============ Error Types ============

export interface LightspeedApiError {
  error?: string
  error_description?: string
  message?: string
  status?: number
  details?: Record<string, unknown>
}

export class LightspeedError extends Error {
  public readonly status?: number
  public readonly code?: string
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    options?: {
      status?: number
      code?: string
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = 'LightspeedError'
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
  }
}

export class LightspeedAuthError extends LightspeedError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { status: 401, code: 'AUTH_ERROR', details })
    this.name = 'LightspeedAuthError'
  }
}

export class LightspeedRateLimitError extends LightspeedError {
  public readonly retryAfter?: number

  constructor(message: string, retryAfter?: number) {
    super(message, { status: 429, code: 'RATE_LIMIT' })
    this.name = 'LightspeedRateLimitError'
    this.retryAfter = retryAfter
  }
}

export class LightspeedNotFoundError extends LightspeedError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with ID ${id} not found` : `${resource} not found`, {
      status: 404,
      code: 'NOT_FOUND',
    })
    this.name = 'LightspeedNotFoundError'
  }
}

export class LightspeedValidationError extends LightspeedError {
  public readonly validationErrors?: Record<string, string[]>

  constructor(message: string, validationErrors?: Record<string, string[]>) {
    super(message, { status: 422, code: 'VALIDATION_ERROR' })
    this.name = 'LightspeedValidationError'
    this.validationErrors = validationErrors
  }
}
