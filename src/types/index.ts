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
  sandboxMode?: boolean

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
export type ShippingClass = 'standard' | 'expedited' | 'fragile' | 'oversized' | 'custom'

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
  rateId: string
  rateType: 'shipment' | 'estimate'
  carrierId: string
  carrierCode: string
  carrierName: string
  carrierNickname?: string
  serviceCode: string
  serviceType: string
  
  shippingAmount: MoneyAmount
  insuranceAmount: MoneyAmount
  confirmationAmount: MoneyAmount
  otherAmount: MoneyAmount
  
  deliveryDays?: number
  estimatedDeliveryDate?: string
  guaranteedService: boolean
  trackable: boolean
  
  validationStatus?: 'valid' | 'has_warnings' | 'invalid'
  warningMessages?: string[]
  errorMessages?: string[]
  
  packageType?: string
  zone?: number
}

export interface MoneyAmount {
  currency: string
  amount: number
}

export interface RateCalculationResult {
  rates: ShipStationRate[]
  freeShipping: boolean
  appliedRule: 'free_shipping' | 'provincial_rate' | 'zone_rate' | 'calculated' | 'none'
  packages: PackageDetails[]
  cacheHit: boolean
  metadata?: {
    totalWeight?: Weight
    totalDimensions?: Dimensions
    estimatedDeliveryRange?: string
  }
}

export interface PackageDetails {
  packageId?: string
  packageCode?: string
  weight: Weight
  dimensions?: Dimensions
  insuredValue?: MoneyAmount
  items: PackageItem[]
}

export interface PackageItem {
  productId: string
  variantId?: string
  quantity: number
  weight?: Weight
  shippingClass?: ShippingClass
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

// ============================================================================
// Order Shipping Details
// ============================================================================

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

export interface ShipStationPackage {
  packageCode: string
  weight: Weight
  dimensions?: Dimensions
  insuredValue?: MoneyAmount
  labelMessages?: {
    reference1?: string
    reference2?: string
    reference3?: string
  }
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
    invalidRates: any[]
    rateRequestId: string
    shipmentId: string
    createdAt: string
    status: 'completed' | 'working' | 'error'
    errors: string[]
  }
  shipment: ShipStationShipment
}

// ============================================================================
// Error Handling
// ============================================================================

export class ShipStationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ShipStationError'
  }
}

// ============================================================================
// Phase 2: Placeholder Types (Coming Soon)
// ============================================================================

/**
 * @alpha - Phase 2 Feature
 * International shipping configuration for customs forms and duties
 * Target: Q1 2026
 */
export interface InternationalShippingConfig {
  enabled: boolean
  customsFormTemplate?: string
  dutyCalculationProvider?: 'avalara' | 'manual'
  restrictedCountries?: string[]
  hsCodeRequired?: boolean
  defaultContentType?: 'merchandise' | 'documents' | 'sample' | 'returned_goods' | 'gift'
}

/**
 * @alpha - Phase 2 Feature
 * Multi-carrier account management with load balancing
 * Target: Q1 2026
 */
export interface CarrierAccountConfig {
  enabled: boolean
  accounts?: CarrierAccount[]
  selectionStrategy?: 'round_robin' | 'cost_optimize' | 'fastest_delivery' | 'manual'
  fallbackToDefaultAccount?: boolean
}

export interface CarrierAccount {
  id: string
  name: string
  carrierId: string
  accountNumber: string
  warehouseId?: string
  priority: number
  enabled: boolean
  loadBalancingStrategy?: 'round_robin' | 'cost_optimize'
  restrictions?: {
    provinces?: string[]
    zones?: string[]
    maxWeight?: Weight
  }
}

/**
 * @alpha - Phase 2 Feature
 * Shipping analytics and performance tracking
 * Target: Q1 2026
 */
export interface AnalyticsConfig {
  enabled: boolean
  trackRateRequests?: boolean
  trackDeliveryPerformance?: boolean
  trackCustomerSatisfaction?: boolean
  retentionDays?: number
}

export interface ShippingAnalytics {
  id: string
  rateRequestId: string
  timestamp: string
  cartValue: number
  selectedRate?: ShipStationRate
  deliveryEstimate?: string
  actualDeliveryTime?: number // Hours
  cost: number
  customerSatisfaction?: number // 1-5 rating
  carrierPerformance?: {
    onTime: boolean
    daysEarly?: number
    daysLate?: number
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export interface CalculateRatesRequest {
  cartId?: string
  items?: PackageItem[]
  shippingAddress: ShippingAddress
  options?: {
    validateAddress?: boolean
    includeEstimates?: boolean
  }
}

export interface CalculateRatesResponse {
  success: boolean
  rates?: ShipStationRate[]
  freeShipping?: boolean
  packages?: PackageDetails[]
  cacheHit?: boolean
  metadata?: any
  error?: string
}

export interface ValidateAddressRequest {
  address: ShippingAddress
  mode?: 'validate_only' | 'validate_and_clean'
}

export interface ValidateAddressResponse {
  success: boolean
  valid?: boolean
  correctedAddress?: ShippingAddress
  errors?: string[]
  warnings?: string[]
}
