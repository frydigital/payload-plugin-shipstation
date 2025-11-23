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
    // Simplified implementation - full implementation would call ShipStation API
    return []
  }

  async validateAddress(address: any): Promise<any> {
    return { isValid: true }
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
