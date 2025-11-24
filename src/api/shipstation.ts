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
      ? 'https://ssapi-sandbox.shipstation.com'
      : 'https://ssapi.shipstation.com'
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 1000
  }

  async getRates(params: {
    shipTo: ShippingAddress
    shipFrom: ShippingAddress
    weight: Weight
    dimensions?: Dimensions
    carrierCode?: string
    serviceCode?: string
    requiresSignature?: boolean
    residential?: boolean
  }): Promise<ShipStationRate[]> {
    const url = `${this.baseUrl}/v2/rates`
    
    const requestBody = {
      rate_options: {
        carrier_ids: params.carrierCode ? [params.carrierCode] : undefined,
        service_codes: params.serviceCode ? [params.serviceCode] : undefined,
      },
      shipment: {
        validate_address: 'no_validation',
        ship_to: {
          name: 'Recipient',
          address_line1: params.shipTo.line1 || params.shipTo.street1 || '',
          address_line2: params.shipTo.line2 || params.shipTo.street2,
          city_locality: params.shipTo.city,
          state_province: params.shipTo.province || params.shipTo.state || '',
          postal_code: params.shipTo.postalCode,
          country_code: params.shipTo.country,
          address_residential_indicator: params.residential ? 'yes' : 'unknown',
        },
        ship_from: {
          name: 'Sender',
          address_line1: params.shipFrom.line1 || params.shipFrom.street1 || '',
          address_line2: params.shipFrom.line2 || params.shipFrom.street2,
          city_locality: params.shipFrom.city,
          state_province: params.shipFrom.province || params.shipFrom.state || '',
          postal_code: params.shipFrom.postalCode,
          country_code: params.shipFrom.country,
        },
        packages: [
          {
            weight: {
              value: params.weight.value,
              unit: params.weight.unit === 'kg' ? 'kilogram' : params.weight.unit,
            },
            dimensions: params.dimensions ? {
              length: params.dimensions.length,
              width: params.dimensions.width,
              height: params.dimensions.height,
              unit: params.dimensions.unit === 'cm' ? 'centimeter' : params.dimensions.unit,
            } : undefined,
          },
        ],
      },
    }
    
    try {
      const response = await this.makeRequest<any>('POST', url, requestBody)
      
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
      console.error('ShipStation getRates error:', error)
      return []
    }
  }

  async validateAddress(address: {
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
    const url = `${this.baseUrl}/v2/addresses/validate`
    
    const requestBody = {
      address: {
        name: 'Address Validation',
        address_line1: address.street1,
        address_line2: address.street2,
        city_locality: address.city,
        state_province: address.state,
        postal_code: address.postalCode,
        country_code: address.country,
      },
    }
    
    try {
      const response = await this.makeRequest<any>('POST', url, requestBody)
      
      // ShipStation v2 returns validation status
      const isValid = response.status === 'verified' || response.status === 'valid'
      
      return {
        isValid,
        normalizedAddress: response.matched_address ? {
          street1: response.matched_address.address_line1,
          street2: response.matched_address.address_line2,
          city: response.matched_address.city_locality,
          state: response.matched_address.state_province,
          postalCode: response.matched_address.postal_code,
          country: response.matched_address.country_code,
        } : undefined,
        warnings: response.messages?.filter((m: any) => m.type === 'warning').map((m: any) => m.message) || [],
        errors: response.messages?.filter((m: any) => m.type === 'error').map((m: any) => m.message) || [],
      }
    } catch (error) {
      // If validation fails, return as invalid but don't throw
      console.error('ShipStation validateAddress error:', error)
      return {
        isValid: false,
        errors: ['Address validation service unavailable'],
      }
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
      await this.makeRequest<void>('POST', url)
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
      'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
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
          let errorData: any
          try {
            errorData = JSON.parse(errorBody)
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
