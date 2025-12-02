import type {
  Dimensions,
  ShipStationCarrier,
  ShipStationCreateOrderRequest,
  ShipStationCreateOrderResponse,
  ShipStationError as ShipStationErrorType,
  ShipStationRate,
  ShipStationV1Address,
  ShipStationV1CreateLabelRequest,
  ShipStationV1CreateLabelResponse,
  ShipStationV1Dimensions,
  ShipStationV1GetRatesRequest,
  ShipStationV1RateResponse,
  ShipStationV1Service,
  ShipStationV1Shipment,
  ShipStationV1ValidateAddressRequest,
  ShipStationV1ValidateAddressResponse,
  ShipStationV1Warehouse,
  ShipStationV1Weight,
  ShippingAddress,
  Weight,
  WeightUnit,
} from '../types'

export class ShipStationError extends Error implements ShipStationErrorType {
  code: string
  statusCode?: number
  details?: unknown

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message)
    this.name = 'ShipStationError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

interface ShipStationClientConfig {
  apiKey: string
  apiSecret?: string
  warehouseId: string
  apiUrl?: string
  maxRetries?: number
  retryDelay?: number
}

/**
 * ShipStation V1 API Client
 * 
 * Uses the V1 API (https://ssapi.shipstation.com)
 * Documentation: https://www.shipstation.com/docs/api/
 * 
 * Authentication: Basic Auth with API Key:Secret
 */
export class ShipStationClient {
  private apiKey: string
  private apiSecret: string
  private warehouseId: string
  private baseUrl: string
  private maxRetries: number
  private retryDelay: number

  constructor(config: ShipStationClientConfig) {
    this.apiKey = config.apiKey
    // V1 API uses API Key:Secret format - if only apiKey provided, use it as both
    // The apiKey format can be "key:secret" or just "key" (in which case apiSecret should be provided separately)
    if (config.apiKey.includes(':')) {
      const [key, secret] = config.apiKey.split(':')
      this.apiKey = key
      this.apiSecret = secret
    } else {
      this.apiKey = config.apiKey
      this.apiSecret = config.apiSecret || config.apiKey
    }
    this.warehouseId = config.warehouseId
    // V1 API base URL
    this.baseUrl = config.apiUrl || process.env.SHIPSTATION_API_URL || 'https://ssapi.shipstation.com'
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 1000
  }

  public getApiKey(): string {
    return this.apiKey
  }

  public getWarehouseId(): string {
    return this.warehouseId
  }

  // Weight conversion constant for kg to grams
  private static readonly KG_TO_GRAMS = 1000

  /**
   * Convert internal weight unit to ShipStation V1 weight unit
   */
  private toV1WeightUnit(unit: WeightUnit): 'pounds' | 'ounces' | 'grams' {
    switch (unit) {
      case 'pound':
        return 'pounds'
      case 'ounce':
        return 'ounces'
      case 'gram':
        return 'grams'
      case 'kilogram':
        // Convert kg to grams for V1 API
        return 'grams'
      default:
        return 'pounds'
    }
  }

  /**
   * Convert weight value if needed (for kilogram -> grams conversion)
   */
  private convertWeightValue(value: number, unit: WeightUnit): number {
    if (unit === 'kilogram') {
      return value * ShipStationClient.KG_TO_GRAMS
    }
    return value
  }

  /**
   * Get shipping rates from ShipStation V1 API
   * https://www.shipstation.com/docs/api/shipments/get-rates/
   * 
   * Note: V1 API requires a carrier code for each rate request (unlike V2 which accepted multiple carrier_ids)
   * If carrierCodes array is provided, will make multiple requests and combine results
   */
  async getRates(params: {
    shipTo: ShippingAddress
    shipFrom?: ShippingAddress
    weight: Weight
    dimensions?: Dimensions
    carrierCodes?: string[]
    serviceCode?: string
    requiresSignature?: boolean
    residential?: boolean
  }): Promise<ShipStationRate[]> {
    console.log('🚀 [ShipStation V1] getRates called with params:', JSON.stringify(params, null, 2))
    
    const carrierCodes = params.carrierCodes || []
    if (carrierCodes.length === 0) {
      console.warn('⚠️ [ShipStation V1] No carrier codes provided - cannot fetch rates')
      return []
    }

    // V1 API requires fromPostalCode - get it from shipFrom or use warehouse
    const fromPostalCode = params.shipFrom?.postalCode || ''
    if (!fromPostalCode) {
      console.warn('⚠️ [ShipStation V1] No fromPostalCode provided - using default')
    }

    // Convert weight to V1 format
    const weight: ShipStationV1Weight = {
      value: this.convertWeightValue(params.weight.value, params.weight.unit),
      units: this.toV1WeightUnit(params.weight.unit),
    }

    // Convert dimensions to V1 format if provided
    let dimensions: ShipStationV1Dimensions | undefined
    if (params.dimensions) {
      dimensions = {
        length: params.dimensions.length,
        width: params.dimensions.width,
        height: params.dimensions.height,
        units: params.dimensions.unit === 'centimeter' ? 'centimeters' : 'inches',
      }
    }

    // Collect rates from all carriers
    const allRates: ShipStationRate[] = []

    for (const carrierCode of carrierCodes) {
      try {
        const requestBody: ShipStationV1GetRatesRequest = {
          carrierCode,
          fromPostalCode: fromPostalCode || 'V8E0Y2', // Fallback if not provided
          toCountry: params.shipTo.country,
          toPostalCode: params.shipTo.postalCode,
          weight,
          dimensions,
          confirmation: params.requiresSignature ? 'signature' : 'none',
          residential: params.residential,
        }
            // Removed toState and toCity as per user instruction

        if (params.serviceCode) {
          requestBody.serviceCode = params.serviceCode
        }

        const url = `${this.baseUrl}/shipments/getrates`
        console.log(`📤 [ShipStation V1] POST ${url} for carrier ${carrierCode}`)
        console.log('📤 [ShipStation V1] Request Body:', JSON.stringify(requestBody, null, 2))

        const response = await this.makeRequest<ShipStationV1RateResponse[]>('POST', url, requestBody)
        console.log('📥 [ShipStation V1] Response:', JSON.stringify(response, null, 2))

        // V1 API returns an array of rates directly
        if (Array.isArray(response)) {
          const rates = response.map((rate) => ({
            serviceName: rate.serviceName,
            serviceCode: rate.serviceCode,
            carrierCode: carrierCode,
            shippingAmount: {
              amount: rate.shipmentCost || 0,
              currency: 'USD', // V1 API returns USD by default
            },
            otherAmount: {
              amount: rate.otherCost || 0,
              currency: 'USD',
            },
          }))
          allRates.push(...rates)
        }
      } catch (error) {
        console.error(`❌ [ShipStation V1] getRates error for carrier ${carrierCode}:`, error)
        // Continue with other carriers even if one fails
      }
    }

    return allRates
  }

  /**
   * Validate an address using ShipStation V1 API
   * https://www.shipstation.com/docs/api/addresses/validate-an-address/
   */
  async validateAddress(address: {
    name?: string
    company?: string
    street1: string
    street2?: string
    city: string
    state: string
    postalCode: string
    country: string
    phone?: string
    residential?: boolean
  }): Promise<{
    isValid: boolean
    normalizedAddress?: ShipStationV1Address
    warnings?: string[]
    errors?: string[]
  }> {
    const url = `${this.baseUrl}/addresses/validate`
    
    const requestBody: ShipStationV1ValidateAddressRequest = {
      name: address.name,
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      residential: address.residential,
    }

    try {
      console.log('📤 [ShipStation V1] POST', url)
      console.log('📤 [ShipStation V1] Request Body:', JSON.stringify(requestBody, null, 2))

      const response = await this.makeRequest<ShipStationV1ValidateAddressResponse>('POST', url, requestBody)
      console.log('📥 [ShipStation V1] Response:', JSON.stringify(response, null, 2))

      return {
        isValid: response.valid === true,
        normalizedAddress: response.address,
        warnings: response.messages?.filter(m => !m.toLowerCase().includes('error')),
        errors: response.messages?.filter(m => m.toLowerCase().includes('error')),
      }
    } catch (error) {
      console.error('❌ [ShipStation V1] validateAddress error:', error)
      return {
        isValid: false,
        errors: [(error as Error).message || 'Address validation failed'],
      }
    }
  }

  /**
   * Create or update an order in ShipStation V1 API
   * https://www.shipstation.com/docs/api/orders/create-update-order/
   * 
   * This replaces the V2 createShipment method. In V1, you create orders first,
   * then create labels/shipments from those orders.
   */
  async createOrder(
    request: ShipStationCreateOrderRequest
  ): Promise<ShipStationCreateOrderResponse> {
    const url = `${this.baseUrl}/orders/createorder`

    console.log('🔥 [ShipStation V1] createOrder called')
    console.log('🔥 [ShipStation V1] Base URL:', this.baseUrl)
    console.log('🔥 [ShipStation V1] Full URL:', url)
    console.log('🔥 [ShipStation V1] Request Body:', JSON.stringify(request, null, 2))

    try {
      const response = await this.makeRequest<ShipStationCreateOrderResponse>('POST', url, request)
      console.log('📥 [ShipStation V1] createOrder Response:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      console.error('❌ [ShipStation V1] createOrder error:', error)
      throw this.handleError(error, 'Failed to create order')
    }
  }

  /**
   * Get an order from ShipStation V1 API
   * https://www.shipstation.com/docs/api/orders/get-order/
   */
  async getOrder(orderId: number): Promise<ShipStationCreateOrderResponse> {
    const url = `${this.baseUrl}/orders/${orderId}`

    try {
      const response = await this.makeRequest<ShipStationCreateOrderResponse>('GET', url)
      return response
    } catch (error) {
      throw this.handleError(error, 'Failed to get order')
    }
  }

  /**
   * Delete an order from ShipStation V1 API
   * https://www.shipstation.com/docs/api/orders/delete-order/
   */
  async deleteOrder(orderId: number): Promise<{ success: boolean; message?: string }> {
    const url = `${this.baseUrl}/orders/${orderId}`

    try {
      await this.makeRequest<void>('DELETE', url)
      return { success: true }
    } catch (error) {
      throw this.handleError(error, 'Failed to delete order')
    }
  }

  /**
   * Create a shipping label for an order
   * https://www.shipstation.com/docs/api/shipments/create-label/
   */
  async createLabel(params: ShipStationV1CreateLabelRequest): Promise<ShipStationV1CreateLabelResponse> {
    const url = `${this.baseUrl}/shipments/createlabel`

    console.log('🔥 [ShipStation V1] createLabel called')
    console.log('🔥 [ShipStation V1] Request Body:', JSON.stringify(params, null, 2))

    try {
      const response = await this.makeRequest<ShipStationV1CreateLabelResponse>('POST', url, params)
      console.log('📥 [ShipStation V1] createLabel Response:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      console.error('❌ [ShipStation V1] createLabel error:', error)
      throw this.handleError(error, 'Failed to create label')
    }
  }

  /**
   * Void a shipping label
   * https://www.shipstation.com/docs/api/shipments/void-label/
   */
  async voidLabel(shipmentId: number): Promise<{ approved: boolean }> {
    const url = `${this.baseUrl}/shipments/voidlabel`

    try {
      const response = await this.makeRequest<{ approved: boolean }>('POST', url, { shipmentId })
      return response
    } catch (error) {
      throw this.handleError(error, 'Failed to void label')
    }
  }

  /**
   * Get a shipment from ShipStation V1 API
   * https://www.shipstation.com/docs/api/shipments/get/
   */
  async getShipment(shipmentId: number): Promise<ShipStationV1Shipment> {
    // V1 API uses query params for shipment lookup
    const url = `${this.baseUrl}/shipments?shipmentId=${shipmentId}`

    try {
      const response = await this.makeRequest<{ shipments: ShipStationV1Shipment[] }>('GET', url)
      if (!response.shipments || response.shipments.length === 0) {
        throw new ShipStationError('Shipment not found', 'NOT_FOUND', 404)
      }
      return response.shipments[0]
    } catch (error) {
      throw this.handleError(error, 'Failed to get shipment')
    }
  }

  /**
   * List all carriers connected to the account
   * https://www.shipstation.com/docs/api/carriers/list/
   */
  async listCarriers(): Promise<ShipStationCarrier[]> {
    const url = `${this.baseUrl}/carriers`

    try {
      const response = await this.makeRequest<ShipStationCarrier[]>('GET', url)
      // V1 API returns array directly
      return response || []
    } catch (error) {
      throw this.handleError(error, 'Failed to list carriers')
    }
  }

  /**
   * Get details for a specific carrier including available services
   * https://www.shipstation.com/docs/api/carriers/get-carrier/
   */
  async getCarrier(carrierCode: string): Promise<ShipStationCarrier | null> {
    const url = `${this.baseUrl}/carriers/getcarrier?carrierCode=${encodeURIComponent(carrierCode)}`

    try {
      const response = await this.makeRequest<ShipStationCarrier>('GET', url)
      return response
    } catch (error) {
      throw this.handleError(error, `Failed to get carrier ${carrierCode}`)
    }
  }

  /**
   * List available services for a specific carrier
   * https://www.shipstation.com/docs/api/carriers/list-services/
   */
  async listCarrierServices(carrierCode: string): Promise<ShipStationV1Service[]> {
    const url = `${this.baseUrl}/carriers/listservices?carrierCode=${encodeURIComponent(carrierCode)}`

    try {
      const response = await this.makeRequest<ShipStationV1Service[]>('GET', url)
      // V1 API returns array directly
      return response || []
    } catch (error) {
      throw this.handleError(error, `Failed to list services for carrier ${carrierCode}`)
    }
  }

  /**
   * List packages available for a specific carrier
   * https://www.shipstation.com/docs/api/carriers/list-packages/
   */
  async listCarrierPackages(carrierCode: string): Promise<Array<{ carrierCode: string; code: string; name: string; domestic: boolean; international: boolean }>> {
    const url = `${this.baseUrl}/carriers/listpackages?carrierCode=${encodeURIComponent(carrierCode)}`

    try {
      const response = await this.makeRequest<Array<{ carrierCode: string; code: string; name: string; domestic: boolean; international: boolean }>>('GET', url)
      return response || []
    } catch (error) {
      throw this.handleError(error, `Failed to list packages for carrier ${carrierCode}`)
    }
  }

  /**
   * Get tracking information
   * https://www.shipstation.com/docs/api/shipments/get/
   */
  async getTracking(trackingNumber: string, carrierCode?: string): Promise<ShipStationV1Shipment | null> {
    let url = `${this.baseUrl}/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`
    if (carrierCode) {
      url += `&carrierCode=${encodeURIComponent(carrierCode)}`
    }

    try {
      const response = await this.makeRequest<{ shipments: ShipStationV1Shipment[] }>('GET', url)
      if (!response.shipments || response.shipments.length === 0) {
        return null
      }
      return response.shipments[0]
    } catch (error) {
      throw this.handleError(error, 'Failed to get tracking')
    }
  }

  /**
   * List warehouses
   * https://www.shipstation.com/docs/api/warehouses/list-warehouses/
   */
  async listWarehouses(): Promise<ShipStationV1Warehouse[]> {
    const url = `${this.baseUrl}/warehouses`

    try {
      const response = await this.makeRequest<ShipStationV1Warehouse[]>('GET', url)
      return response || []
    } catch (error) {
      throw this.handleError(error, 'Failed to list warehouses')
    }
  }

  /**
   * Get a specific warehouse
   * https://www.shipstation.com/docs/api/warehouses/get-warehouse/
   */
  async getWarehouse(warehouseId: number): Promise<ShipStationV1Warehouse> {
    const url = `${this.baseUrl}/warehouses/${warehouseId}`

    try {
      const response = await this.makeRequest<ShipStationV1Warehouse>('GET', url)
      return response
    } catch (error) {
      throw this.handleError(error, `Failed to get warehouse ${warehouseId}`)
    }
  }

  /**
   * Make HTTP request to ShipStation V1 API
   * Uses Basic Auth with API Key:Secret
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown
  ): Promise<T> {
    // V1 API uses Basic Auth with API Key:Secret
    const authString = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`,
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      console.log(`🔥 [ShipStation V1 API] Request Body for ${method} ${url}:`)
      console.log(JSON.stringify(body, null, 2))
      options.body = JSON.stringify(body)
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔥 [ShipStation V1 API] Attempt ${attempt + 1}: Fetching ${url}`)
        // Log a masked curl for easy reproduction
        try {
          const maskedAuth = authString.length > 10 ? `${authString.slice(0, 5)}***${authString.slice(-5)}` : '***'
          const curlBody = body ? ` -d '${JSON.stringify(body)}'` : ''
          console.log(`🧪 cURL: curl -X ${method} '${url}' -H 'Content-Type: application/json' -H 'Authorization: Basic ${maskedAuth}'${curlBody}`)
        } catch {}

        let response: Response
        try {
          console.log(`🔥 [ShipStation V1 API] About to call fetch()...`)
          response = await fetch(url, options)
          console.log(`✅ [ShipStation V1 API] Fetch completed! Status: ${response.status} ${response.statusText}`)
        } catch (fetchError) {
          console.error(`❌ [ShipStation V1 API] FETCH THREW ERROR:`, fetchError)
          console.error(`❌ [ShipStation V1 API] Error name: ${(fetchError as Error).name}`)
          console.error(`❌ [ShipStation V1 API] Error message: ${(fetchError as Error).message}`)
          throw fetchError
        }

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`❌ [ShipStation V1 API] HTTP ${response.status}: ${response.statusText}`)
          console.error(`❌ [ShipStation V1 API] URL: ${url}`)
          console.error(`❌ [ShipStation V1 API] Response Body:`, errorBody)

          let errorData: unknown
          try {
            errorData = JSON.parse(errorBody)
            console.error(`❌ [ShipStation V1 API] Parsed Error:`, JSON.stringify(errorData, null, 2))
          } catch {
            errorData = { Message: errorBody }
          }

          // Handle ShipStation V1 API error format (uses PascalCase)
          if (errorData) {
            const data = errorData as { Message?: string; ExceptionMessage?: string; message?: string }

            throw new ShipStationError(
              data.Message || data.ExceptionMessage || data.message || `HTTP ${response.status}`,
              `HTTP_${response.status}`,
              response.status,
              errorData
            )
          }
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return {} as T
        }

        const data = await response.json()
        return data as T
      } catch (error) {
        lastError = error as Error

        // Don't retry on client errors (4xx)
        if (error instanceof ShipStationError && error.statusCode && error.statusCode < 500) {
          throw error
        }

        // Retry on network errors or 5xx errors
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        throw error
      }
    }

    throw lastError
  }

  private handleError(error: unknown, message: string): ShipStationError {
    if (error instanceof ShipStationError) {
      return error
    }

    if (error instanceof Error) {
      return new ShipStationError(
        `${message}: ${error.message}`,
        'UNKNOWN_ERROR',
        undefined,
        error
      )
    }

    return new ShipStationError(message, 'UNKNOWN_ERROR')
  }
}
