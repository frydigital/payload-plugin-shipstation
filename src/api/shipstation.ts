import type {
  ShipStationRate,
  ShippingAddress,
  Weight,
  Dimensions,
  ShipStationShipment,
  ShipStationPackage,
  ShipStationError as ShipStationErrorType,
  ShipStationCreateShipmentRequest,
  ShipStationCreateShipmentResponse,
  ShipStationGetShipmentResponse,
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
  warehouseId: string
  sandboxMode?: boolean
  maxRetries?: number
  retryDelay?: number
}

export class ShipStationClient {
  private apiKey: string
  private warehouseId: string
  private baseUrl: string
  private maxRetries: number
  private retryDelay: number

  constructor(config: ShipStationClientConfig) {
    this.apiKey = config.apiKey
    this.warehouseId = config.warehouseId
    this.baseUrl = config.sandboxMode
      ? 'https://docs.shipstation.com/_mock/openapi'
      : 'https://api.shipstation.com'
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 1000
  }

  async getRates(params: {
    shipTo: ShippingAddress
    shipFrom?: ShippingAddress
    weight: Weight
    dimensions?: Dimensions
    carrierCode?: string
    serviceCode?: string
    requiresSignature?: boolean
    residential?: boolean
  }): Promise<ShipStationRate[]> {
    console.log('🚀 [ShipStation] getRates called with params:', JSON.stringify(params, null, 2))
    const url = `${this.baseUrl}/v2/rates`
    console.log('🚀 [ShipStation] Base URL:', this.baseUrl)
    console.log('🚀 [ShipStation] Full URL:', url)
    
    const requestBody: any = {
      rate_options: {
        carrier_ids: params.carrierCode ? [params.carrierCode] : undefined,
        service_codes: params.serviceCode ? [params.serviceCode] : undefined,
      },
      shipment: {
        validate_address: 'validate_and_clean',
        ship_to: {
          name: params.shipTo.name || 'Recipient',
          address_line1: params.shipTo.addressLine1 || (params.shipTo as any).line1,
          address_line2: params.shipTo.addressLine2 || (params.shipTo as any).line2,
          city_locality: params.shipTo.city,
          state_province: params.shipTo.state || (params.shipTo as any).province,
          postal_code: params.shipTo.postalCode,
          country_code: params.shipTo.country,
          address_residential_indicator: params.residential === true ? 'yes' : params.residential === false ? 'no' : 'unknown',
        },
        packages: [
          {
            weight: {
              value: params.weight.value,
              unit: params.weight.unit,
            },
            dimensions: params.dimensions ? {
              length: params.dimensions.length,
              width: params.dimensions.width,
              height: params.dimensions.height,
              unit: params.dimensions.unit,
            } : undefined,
          },
        ],
      },
    }
    
    // Add ship_from or warehouse_id at shipment level based on API spec
    if (params.shipFrom) {
      requestBody.shipment.ship_from = {
        name: params.shipFrom.name || 'Sender',
        address_line1: params.shipFrom.addressLine1,
        address_line2: params.shipFrom.addressLine2,
        city_locality: params.shipFrom.city,
        state_province: params.shipFrom.state,
        postal_code: params.shipFrom.postalCode,
        country_code: params.shipFrom.country,
      }
    } else {
      requestBody.shipment.warehouse_id = this.warehouseId
    }
    
    try {
      console.log('📤 [ShipStation] POST', url)
      console.log('📤 [ShipStation] Request Body:', JSON.stringify(requestBody, null, 2))
      console.log('📤 [ShipStation] Auth:', `API-Key ${this.apiKey.substring(0, 20)}...`)
      
      const response = await this.makeRequest<any>('POST', url, requestBody)
      
      console.log('📥 [ShipStation] Response:', JSON.stringify(response, null, 2))
      
      // ShipStation v2 API returns rate_response with rates array
      if (response.rate_response?.rates) {
        return response.rate_response.rates.map((rate: any) => ({
          serviceName: rate.service_type || rate.service_code,
          serviceCode: rate.service_code,
          carrierCode: rate.carrier_code || rate.carrier_id,
          shipmentCost: rate.shipping_amount?.amount || 0,
          otherCost: rate.other_amount?.amount || 0,
          deliveryDays: rate.delivery_days,
          carrierDeliveryDays: rate.carrier_delivery_days,
          shipDate: rate.ship_date,
          estimatedDeliveryDate: rate.estimated_delivery_date,
        }))
      }
      
      return []
    } catch (error) {
      // Log error but don't throw - return empty array so fallback rates can be used
      console.error('❌ [ShipStation] getRates error:', error)
      if (error instanceof Error) {
        console.error('❌ [ShipStation] Error message:', error.message)
        console.error('❌ [ShipStation] Error stack:', error.stack)
      }
      return []
    }
  }

  /**
   * @deprecated ShipStation v2 API does not have a dedicated address validation endpoint.
   * Address validation is done inline when creating rates/shipments using the validate_address parameter.
   * This method is kept for backwards compatibility but always returns valid=false.
   */
  async validateAddress(_address: {
    street1: string
    street2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }): Promise<{
    isValid: boolean
    normalizedAddress?: any
    warnings?: string[]
    errors?: string[]
  }> {
    // ShipStation v2 doesn't have /v2/addresses/validate endpoint
    // Address validation happens inline with rate/shipment creation via validate_address parameter
    console.warn('[ShipStation] validateAddress is deprecated - use validate_address parameter in rate/shipment calls')
    
    return {
      isValid: false,
      errors: ['Address validation must be done inline with rate/shipment creation in ShipStation v2 API'],
    }
  }

  async createShipment(
    request: ShipStationCreateShipmentRequest
  ): Promise<ShipStationCreateShipmentResponse> {
    const url = `${this.baseUrl}/v2/shipments`
    
    try {
      const response = await this.makeRequest<ShipStationCreateShipmentResponse>('POST', url, request)
      return response
    } catch (error) {
      throw this.handleError(error, 'Failed to create shipment')
    }
  }

  async getShipment(shipmentId: string): Promise<ShipStationGetShipmentResponse> {
    const url = `${this.baseUrl}/v2/shipments/${shipmentId}`
    
    try {
      const response = await this.makeRequest<ShipStationGetShipmentResponse>('GET', url)
      return response
    } catch (error) {
      throw this.handleError(error, 'Failed to get shipment')
    }
  }

  async cancelShipment(shipmentId: string): Promise<{ success: boolean; message?: string }> {
    const url = `${this.baseUrl}/v2/shipments/${shipmentId}/cancel`
    
    try {
      await this.makeRequest<void>('PUT', url)
      return { success: true }
    } catch (error) {
      throw this.handleError(error, 'Failed to cancel shipment')
    }
  }

  async createLabel(params: any): Promise<any> {
    // To be implemented in Phase 2
    return {}
  }

  async voidLabel(labelId: string): Promise<any> {
    // To be implemented in Phase 2
    return { success: true }
  }

  async getTracking(trackingNumber: string): Promise<any> {
    // To be implemented in Phase 2
    return { trackingNumber, status: 'unknown', events: [] }
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: any
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'API-Key': this.apiKey,
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        
        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`❌ [ShipStation API] HTTP ${response.status}: ${response.statusText}`)
          console.error(`❌ [ShipStation API] URL: ${url}`)
          console.error(`❌ [ShipStation API] Response Body:`, errorBody)
          
          let errorData: any
          try {
            errorData = JSON.parse(errorBody)
            console.error(`❌ [ShipStation API] Parsed Error:`, JSON.stringify(errorData, null, 2))
          } catch {
            errorData = { message: errorBody }
          }
          
          throw new ShipStationError(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            errorData.error_code || `HTTP_${response.status}`,
            response.status,
            errorData
          )
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
