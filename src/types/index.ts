/**
 * ShipStation Payload Plugin Types
 * Comprehensive type definitions for shipping functionality
 */

// ============================================================================
// Core Plugin Configuration
// ============================================================================

export interface ShipStationPluginOptions {
  /** Core API configuration */
  apiKey: string
  warehouseId: string

  /** Feature flags */
  enabledFeatures?: {
    addressValidation?: boolean
    multiPackage?: boolean
    autoCreateShipments?: boolean
    webhooks?: boolean
  }

  /** Rate configuration */
  provincialRates?: ProvincialRate[]
  shippingZones?: boolean // Enable shipping zones collection
  freeShippingConfig?: FreeShippingConfig
  shippingClassModifiers?: Record<ShippingClass, number>
  maxPackageWeight?: { value: number; unit: WeightUnit }
  maxPackageDimensions?: { length: number; width: number; height: number; unit: DimensionUnit }

  /** Cache configuration */
  cache?: CacheConfig

  /** Webhook configuration */
  webhookSecret?: string
  enabledWebhookEvents?: ShipStationWebhookEvent[]

  /** Phase 2: International Shipping (placeholder) */
  /** @alpha - Coming in Phase 2 */
  internationalShipping?: InternationalShippingConfig

  /** Phase 2: Multi-carrier account management (placeholder) */
  /** @alpha - Coming in Phase 2 */
  carrierAccounts?: CarrierAccountConfig

  /** Phase 2: Shipping analytics (placeholder) */
  /** @alpha - Coming in Phase 2 */
  analytics?: AnalyticsConfig
}

// ============================================================================
// Shipping Address & Location
// ============================================================================

export interface ShippingAddress {
  name?: string
  company?: string
  addressLine1: string
  addressLine2?: string
  addressLine3?: string
  city: string
  state: string // Province for Canada
  postalCode: string
  country: string
  phone?: string
  addressResidentialIndicator?: 'yes' | 'no' | 'unknown'
}

export interface AddressValidationResult {
  valid: boolean
  correctedAddress?: ShippingAddress
  errors?: string[]
  warnings?: string[]
}

// ============================================================================
// Product Shipping Details
// ============================================================================

export type WeightUnit = 'ounce' | 'pound' | 'gram' | 'kilogram'
export type DimensionUnit = 'inch' | 'centimeter'
export type ShippingClass = 'standard' | 'expedited' | 'fragile' | 'oversized' | 'pickup-only' | 'custom'
export type ShippingMethod = 'shipping' | 'pickup'

export interface Weight {
  value: number
  unit: WeightUnit
}

export interface Dimensions {
  length: number
  width: number
  height: number
  unit: DimensionUnit
}

export interface ProductShippingDetails {
  weight?: Weight
  dimensions?: Dimensions
  shippingClass?: ShippingClass
  requiresSignature?: boolean
  hazardousMaterials?: boolean
  
  /** Phase 2: International fields */
  customsValue?: number
  hsCode?: string
  countryOfOrigin?: string
}

// ============================================================================
// Rate Calculation
// ============================================================================

export interface ShipStationRate {
  rateId?: string
  rateType?: 'shipment' | 'estimate'
  carrierId?: string
  carrierCode?: string
  carrierName?: string
  carrierNickname?: string
  serviceCode: string
  serviceName?: string
  serviceType?: string
  
  shippingAmount: MoneyAmount
  insuranceAmount?: MoneyAmount
  confirmationAmount?: MoneyAmount
  otherAmount?: MoneyAmount
  
  deliveryDays?: number
  estimatedDeliveryDate?: string
  carrierDeliveryDays?: string
  shipDate?: string
  
  guaranteedService?: boolean
  trackable?: boolean
  
  validationStatus?: 'valid' | 'has_warnings' | 'invalid'
  warningMessages?: string[]
}

// ============================================================================
// Shipping Zones & Provincial Rates
// ============================================================================

export interface ProvincialRate {
  province: 'BC' | 'AB' | 'SK' | 'MB' | 'ON' | 'QC' | 'NB' | 'NS' | 'PE' | 'NL' | 'YT' | 'NT' | 'NU'
  baseRate: number // In cents (CAD)
  enabled: boolean
}

export interface ShippingZone {
  id: string
  name: string
  enabled: boolean
  priority: number
  postalCodePatterns: string[] // Regex patterns
  countries: string[]
  provinces?: string[]
  rateType: 'flat' | 'per_kg' | 'per_item' | 'calculated'
  baseRate?: number
  perKgRate?: number
  perItemRate?: number
  freeShippingThreshold?: number
  excludedShippingClasses?: ShippingClass[]
}

export interface FreeShippingConfig {
  threshold: number // Amount in cents
  eligibleCountries: string[] // Default: ['CA']
  excludedShippingClasses?: ShippingClass[]
}

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  enableCache: boolean
  cacheTTL: number // Seconds
  redisUrl?: string
  fallbackToMemory?: boolean
}

export interface CacheKey {
  type: 'rate' | 'address' | 'zone'
  hash: string
}

// ============================================================================
// Webhooks
// ============================================================================

export type ShipStationWebhookEvent =
  | 'shipment.created'
  | 'label.created'
  | 'tracking.updated'
  | 'tracking.delivered'
  | 'tracking.exception'

export interface WebhookEvent {
  eventType: ShipStationWebhookEvent
  timestamp: string
  data: {
    shipmentId?: string
    labelId?: string
    trackingNumber?: string
    carrierCode?: string
    status?: string
    location?: string
    description?: string
  }
}

export interface TrackingUpdate {
  timestamp: string
  status: ShipmentStatus
  location?: string
  description?: string
}

export type ShipmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned'
  | 'manual_review'

// ============================================================================
// Order Shipping Details
// ============================================================================

// Minimal representation of a product/variant used in shipment creation
export interface OrderProductRef {
  id?: string
  title?: string
  sku?: string
}

export interface OrderVariantRef {
  id?: string
  title?: string
  sku?: string
}

export interface OrderLineItem {
  product?: OrderProductRef | string
  variant?: OrderVariantRef | string
  quantity: number
  /** Allocation status from ShipStation (openapi: allocation_status) */
  allocationStatus?: string
  /** Image URL for the item (openapi: image_url) */
  imageUrl?: string
  /** Individual item weight; value stored in source unit */
  weight?: {
    value?: number
    unit?: WeightUnit
  }
  /** Unit price in cents (internal representation). Converted to dollars for ShipStation unit_price */
  unitPrice?: number
  /** Tax amount for the line item in cents */
  taxAmount?: number
  /** Shipping amount attributable to this item in cents */
  shippingAmount?: number
  /** Inventory location reference (openapi: inventory_location) */
  inventoryLocation?: string
  /** Variant/options selections (openapi: options) */
  options?: Array<{ name?: string; value?: string }>
  /** ShipStation product_id */
  productId?: string
  /** ShipStation fullfilment_sku (note spec spelling) */
  fullfilmentSku?: string
  /** Universal Product Code */
  upc?: string
  /** Currency override if different from order currency */
  currency?: string
}

/**
 * Subset of Order fields required for shipment creation.
 * This mirrors the fields accessed within createShipmentForOrder.
 */
export interface OrderForShipment {
  id: string
  shippingMethod: ShippingMethod
  shippingAddress: {
    firstName?: string
    lastName?: string
    company?: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    country: string
    phone?: string
  }
  items: OrderLineItem[]
  selectedRate?: {
    serviceName?: string
    serviceCode?: string
    carrierCode?: string
    carrierId?: string
    cost?: number
    currency?: string
  }
  total?: number
  amount?: number
  shippingCost?: number
  currency?: string
  customerNotes?: string
  shippingDetails?: {
    shipstationShipmentId?: string
    shipmentId?: string
    carrierCode?: string
    serviceCode?: string
    shippingStatus?: string
  }
}

export interface OrderShippingDetails {
  shipstationShipmentId?: string
  shipstationLabelId?: string
  labelUrl?: string
  trackingNumber?: string
  trackingUrl?: string
  carrierCode?: string
  carrierName?: string
  serviceCode?: string
  serviceName?: string
  packageCount?: number
  estimatedDeliveryDate?: string
  actualDeliveryDate?: string
  shipmentStatus?: ShipmentStatus
  shippingCost?: ShippingCostBreakdown
  trackingHistory?: TrackingUpdate[]
  
  /** Phase 2: International fields */
  customsFormUrl?: string
  dutyAmount?: number
  carrierAccountUsed?: string
}

export interface ShippingCostBreakdown {
  base: number
  modifiers: number
  taxes: number
  total: number
}

// ============================================================================
// ShipStation API Types
// ============================================================================

export interface ShipStationShipment {
  shipmentId?: string
  carrierId?: string
  serviceCode?: string
  externalShipmentId?: string
  shipDate?: string
  shipTo: ShippingAddress
  shipFrom: ShippingAddress
  returnTo?: ShippingAddress
  packages: ShipStationPackage[]
  confirmation?: 'none' | 'delivery' | 'signature' | 'adult_signature' | 'direct_signature'
  insuranceProvider?: 'none' | 'shipsurance' | 'carrier'
  advancedOptions?: ShipStationAdvancedOptions
  validateAddress?: 'no_validation' | 'validate_only' | 'validate_and_clean'
}



export interface ShipStationAdvancedOptions {
  billToAccount?: string
  billToCountryCode?: string
  billToParty?: 'recipient' | 'third_party'
  billToPostalCode?: string
  containsAlcohol?: boolean
  deliveredDutyPaid?: boolean
  nonMachinable?: boolean
  saturdayDelivery?: boolean
  dryIce?: boolean
  dryIceWeight?: Weight
}

export interface ShipStationRateRequest {
  shipment?: ShipStationShipment
  shipmentId?: string
  rateOptions: {
    carrierIds: string[]
    serviceCodes?: string[]
    packageTypes?: string[]
  }
}

export interface ShipStationRateResponse {
  rateResponse: {
    rates: ShipStationRate[]
    invalidRates: unknown[]
    rateRequestId: string
    shipmentId: string
    createdAt: string
    status: 'completed' | 'working' | 'error'
    errors: string[]
  }
  shipment: ShipStationShipment
}

export interface ShipStationCalculateRatesRequest {
  rate_options: {
    carrier_ids: string[]
    package_types?: string[]
    service_codes?: string[]
    calculate_tax_amount?: boolean
    preferred_currency?: string
    is_return?: boolean
  }
  shipment: {
    validate_address?: 'no_validation' | 'validate_only' | 'validate_and_clean'
    ship_to: ShipStationAddress
    ship_from?: ShipStationAddress
    warehouse_id?: string
    packages: ShipStationPackage[]
    confirmation?: 'none' | 'delivery' | 'signature' | 'adult_signature' | 'direct_signature'
  }
}

export interface ShipStationCreateShipmentRequest {
  shipments: Array<{
    validate_address?: 'no_validation' | 'validate_only' | 'validate_and_clean'
    external_shipment_id?: string
    warehouse_id?: string
    carrier_id?: string
    service_code?: string
    carrier_code?: string
    create_sales_order?: boolean
    store_id?: string
    notes_from_buyer?: string
    notes_for_gift?: string
    is_gift?: boolean
    shipment_status?: string
    amount_paid?: {
      currency: string
      amount: number
    }
    shipping_paid?: {
      currency: string
      amount: number
    }
    tax_paid?: {
      currency: string
      amount: number
    }
    ship_to: ShipStationAddress
    ship_from?: ShipStationAddress
    items?: Array<{
      name: string
      sku?: string
      quantity: number
      unit_price?: {
        currency: string
        amount: number
      }
      weight?: {
        value: number
        unit: WeightUnit
      }
    }>
    packages?: ShipStationPackage[]
  }>
}

export interface ShipStationCreateShipmentResponse {
  shipments: Array<{
    shipment_id: string
    external_shipment_id?: string
    shipment_number?: string
    created_at: string
    modified_at: string
    shipment_status: string
    errors?: Array<{
      message: string
      error_code: string
    }>
  }>
  errors?: Array<{
    message: string
    error_code: string
  }>
}

export interface ShipStationGetShipmentResponse {
  shipment_id: string
  external_shipment_id?: string
  shipment_number?: string
  carrier_id?: string
  service_code?: string
  shipment_status: string
  ship_to: ShipStationAddress
  ship_from?: ShipStationAddress
  items?: unknown[]
  packages?: ShipStationPackage[]
  created_at: string
  modified_at: string
}

export interface ShipStationCalculateRatesResponse {
  rate_response: {
    rates: Array<{
      service_name?: string
      service_type?: string
      service_code: string
      carrier_code?: string
      carrier_id?: string
      shipping_amount: {
        amount: number
        currency: string
      }
      other_amount?: {
        amount: number
        currency: string
      }
      delivery_days?: number
      carrier_delivery_days?: string
      ship_date?: string
      estimated_delivery_date?: string
    }>
  }
}

export interface ShipStationAddress {
  name?: string
  company_name?: string
  address_line1: string
  address_line2?: string
  address_line3?: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code: string
  phone?: string
  address_residential_indicator?: 'yes' | 'no' | 'unknown'
}

export interface ShipStationPackage {
  weight: {
    value: number
    unit: WeightUnit
  }
  dimensions?: {
    length: number
    width: number
    height: number
    unit: DimensionUnit
  }
}

// Placeholders for future features
export type InternationalShippingConfig = Record<string, unknown>
export type CarrierAccountConfig = Record<string, unknown>
export type AnalyticsConfig = Record<string, unknown>

export interface ShipStationError {
  code: string
  statusCode?: number
  details?: unknown
  message: string
  name: string
}

// ============================================================================
// Cart & Checkout
// ============================================================================

export interface CartItem {
  id: string
  product: unknown
  quantity: number
  shippingClass?: ShippingClass
  price?: number
  // Add other fields as needed
}

export interface CartShippingEligibility {
  eligibleForFreeShipping: boolean
  eligibleSubtotal: number
  threshold: number
  remainingAmount: number
  itemBreakdown: {
    shippable: CartItem[]
    pickupOnly: CartItem[]
    excludedFromFreeShipping: CartItem[]
  }
  availableMethods: {
    shipping: boolean
    pickup: boolean
  }
  restrictions: {
    hasPickupOnlyItems: boolean
    hasShippingOnlyItems: boolean
    requiresPickup: boolean
  }
}

// ============================================================================
// Shipment Creation Types
// ============================================================================

export interface CreateShipmentRequest {
  orderId: string
  validateAddress?: boolean
  testLabel?: boolean
}

export interface CreateShipmentResponse {
  success: boolean
  shipmentId?: string
  externalShipmentId?: string
  orderId?: string
  status?: ShipmentStatus
  validationResults?: AddressValidationResult
  error?: string
  warnings?: string[]
}

export interface MoneyAmount {
  currency: string
  amount: number
}

export interface ShipStationCarrier {
  carrier_id: string
  carrier_code: string
  carrier_name: string
  nickname?: string
  account_number?: string
  services?: Array<{
    service_code: string
    name: string
    domestic: boolean
    international: boolean
  }>
}
