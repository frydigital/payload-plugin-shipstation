import type {
  ShipStationRate,
  ShippingAddress,
  Weight,
  Dimensions,
  ShipStationShipment,
  ShipStationPackage,
  ShipStationError as ShipStationErrorType,
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

  async createShipment(shipment: ShipStationShipment): Promise<any> {
    return {}
  }

  async createLabel(params: any): Promise<any> {
    return {}
  }

  async voidLabel(labelId: string): Promise<any> {
    return { success: true }
  }

  async getTracking(trackingNumber: string): Promise<any> {
    return { trackingNumber, status: 'unknown', events: [] }
  }
}
