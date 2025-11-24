/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipStationClient, ShipStationError } from '../../src/api/shipstation'
import {
  mockShipStationGetResponse,
  mockShipStationRequest,
  mockShipStationSuccessResponse,
} from '../mockData'
import { createMockFetch } from '../testUtils'

describe('ShipStationClient', () => {
  let client: ShipStationClient
  const mockApiKey = 'TEST_API_KEY'
  const mockWarehouseId = 'se-warehouse-123'

  beforeEach(() => {
    client = new ShipStationClient({
      apiKey: mockApiKey,
      warehouseId: mockWarehouseId,
    })
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with production URL by default', () => {
      const prodClient = new ShipStationClient({
        apiKey: mockApiKey,
        warehouseId: mockWarehouseId,
      })
      expect(prodClient).toBeDefined()
    })
  })

  describe('createShipment', () => {
    it('should successfully create a shipment', async () => {
      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/shipments':
          mockShipStationSuccessResponse,
      })
      global.fetch = mockFetch as any

      const request = {
        shipments: [
          {
            external_shipment_id: 'order_123',
            warehouse_id: mockWarehouseId,
            ship_to: {
              name: 'John Doe',
              address_line1: '123 Main St',
              city_locality: 'Vancouver',
              state_province: 'BC',
              postal_code: 'V6B1A1',
              country_code: 'CA',
            },
          },
        ],
      }

      const response = await client.createShipment(request)

      expect(response).toEqual(mockShipStationSuccessResponse)
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.shipstation.com/v2/shipments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should throw ShipStationError on API error', async () => {
      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/shipments': {
          error: true,
          status: 400,
          message: 'Invalid request',
          error_code: 'INVALID_REQUEST',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.createShipment(mockShipStationRequest)).rejects.toThrow(
        ShipStationError
      )
    })

    it('should retry on 5xx errors', async () => {
      let callCount = 0
      const mockFetch = vi.fn(async () => {
        callCount++
        if (callCount < 2) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Server Error',
            json: async () => ({ error: 'Server Error' }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockShipStationSuccessResponse,
        }
      })
      global.fetch = mockFetch as any

      const response = await client.createShipment(mockShipStationRequest)

      expect(response).toEqual(mockShipStationSuccessResponse)
      expect(callCount).toBeGreaterThan(1) // Should have retried
    })

    it('should not retry on 4xx errors', async () => {
      const mockFetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => JSON.stringify({ error: 'Bad Request' }),
          json: async () => ({ error: 'Bad Request' }),
        }
      })
      global.fetch = mockFetch as any

      await expect(client.createShipment(mockShipStationRequest)).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledOnce() // Should not retry
    })
  })

  describe('getShipment', () => {
    it('should successfully get a shipment', async () => {
      const shipmentId = 'se-123456789'
      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/shipments/${shipmentId}`]:
          mockShipStationGetResponse,
      })
      global.fetch = mockFetch as any

      const response = await client.getShipment(shipmentId)

      expect(response).toEqual(mockShipStationGetResponse)
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if shipment not found', async () => {
      const shipmentId = 'invalid_id'
      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/shipments/${shipmentId}`]:
          {
            error: true,
            status: 404,
            message: 'Shipment not found',
          },
      })
      global.fetch = mockFetch as any

      await expect(client.getShipment(shipmentId)).rejects.toThrow(
        ShipStationError
      )
    })
  })

  describe('cancelShipment', () => {
    it('should successfully cancel a shipment', async () => {
      const shipmentId = 'se-123456789'
      const mockFetch = createMockFetch({
        [`PUT https://api.shipstation.com/v2/shipments/${shipmentId}/cancel`]:
          {},
      })
      global.fetch = mockFetch as any

      const response = await client.cancelShipment(shipmentId)

      expect(response).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if cancellation fails', async () => {
      const shipmentId = 'se-123456789'
      const mockFetch = createMockFetch({
        [`PUT https://api.shipstation.com/v2/shipments/${shipmentId}/cancel`]:
          {
            error: true,
            status: 400,
            message: 'Cannot cancel shipped shipment',
          },
      })
      global.fetch = mockFetch as any

      await expect(client.cancelShipment(shipmentId)).rejects.toThrow(
        ShipStationError
      )
    })
  })

  describe('getRates', () => {
    it('should successfully fetch rates from ShipStation API', async () => {
      const mockRatesResponse = {
        rate_response: {
          rates: [
            {
              service_code: 'usps_priority_mail',
              service_type: 'USPS Priority Mail',
              carrier_code: 'stamps_com',
              carrier_id: 'se-123456',
              shipping_amount: { amount: 12.50, currency: 'usd' },
              other_amount: { amount: 0, currency: 'usd' },
              delivery_days: 3,
              carrier_delivery_days: '2-3',
              ship_date: '2025-11-23',
              estimated_delivery_date: '2025-11-26',
            },
            {
              service_code: 'fedex_ground',
              service_type: 'FedEx Ground',
              carrier_code: 'fedex',
              carrier_id: 'se-789012',
              shipping_amount: { amount: 15.75, currency: 'usd' },
              other_amount: { amount: 1.25, currency: 'usd' },
              delivery_days: 5,
              carrier_delivery_days: '3-5',
              ship_date: '2025-11-23',
              estimated_delivery_date: '2025-11-28',
            },
          ],
        },
      }

      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/rates': mockRatesResponse,
      })
      global.fetch = mockFetch as any

      const rates = await client.getRates({
        shipTo: {
          addressLine1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
        shipFrom: {
          addressLine1: '456 Test St',
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V1A1',
          country: 'CA',
        },
        weight: {
          value: 1.5,
          unit: 'kilogram',
        },
      })

      expect(rates).toHaveLength(2)
      expect(rates[0]).toMatchObject({
        serviceName: 'USPS Priority Mail',
        serviceCode: 'usps_priority_mail',
        carrierCode: 'stamps_com',
        shippingAmount: { amount: 12.50, currency: 'usd' },
        otherAmount: { amount: 0, currency: 'usd' },
        deliveryDays: 3,
      })
      expect(rates[1]).toMatchObject({
        serviceName: 'FedEx Ground',
        serviceCode: 'fedex_ground',
        carrierCode: 'fedex',
        shippingAmount: { amount: 15.75, currency: 'usd' },
        otherAmount: { amount: 1.25, currency: 'usd' },
        deliveryDays: 5,
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when API response has no rates', async () => {
      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/rates': {},
      })
      global.fetch = mockFetch as any

      const rates = await client.getRates({
        shipTo: {
          addressLine1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
        shipFrom: {
          addressLine1: '456 Test St',
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V1A1',
          country: 'CA',
        },
        weight: {
          value: 1.5,
          unit: 'kilogram',
        },
        carrierIds: ['se-123456'],
      })

      expect(rates).toEqual([])
    })

    it('should return empty array on API error', async () => {
      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/rates': {
          error: true,
          status: 400,
          message: 'Invalid shipment data',
        },
      })
      global.fetch = mockFetch as any

      const rates = await client.getRates({
        shipTo: {
          addressLine1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
        shipFrom: {
          addressLine1: '456 Test St',
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V1A1',
          country: 'CA',
        },
        weight: {
          value: 1.5,
          unit: 'kilogram',
        },
        carrierIds: ['se-123456'],
      })

      expect(rates).toEqual([])
    })

    it('should include optional parameters in request when provided', async () => {
      const mockRatesResponse = {
        rate_response: { rates: [] },
      }

      const mockFetch = createMockFetch({
        'POST https://api.shipstation.com/v2/rates': mockRatesResponse,
      })
      global.fetch = mockFetch as any

      await client.getRates({
        shipTo: {
          addressLine1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
        shipFrom: {
          addressLine1: '456 Test St',
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V1A1',
          country: 'CA',
        },
        weight: {
          value: 1.5,
          unit: 'kilogram',
        },
        dimensions: {
          length: 10,
          width: 8,
          height: 5,
          unit: 'centimeter',
        },
        carrierIds: ['se-fedex-123'],
        serviceCode: 'fedex_ground',
        requiresSignature: true,
        residential: false,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.shipstation.com/v2/rates',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"carrier_ids":["se-fedex-123"]'),
        })
      )
    })
  })

  describe('listCarriers', () => {
    it('should successfully list carriers', async () => {
      const mockCarriersResponse = {
        carriers: [
          {
            carrier_id: 'se-123456',
            carrier_code: 'fedex',
            carrier_name: 'FedEx',
            nickname: 'FedEx Account',
            account_number: '12345',
            services: [
              {
                service_code: 'fedex_ground',
                name: 'FedEx Ground',
                domestic: true,
                international: false,
              },
            ],
          },
          {
            carrier_id: 'se-789012',
            carrier_code: 'usps',
            carrier_name: 'USPS',
            services: [
              {
                service_code: 'usps_priority_mail',
                name: 'Priority Mail',
                domestic: true,
                international: false,
              },
            ],
          },
        ],
      }

      const mockFetch = createMockFetch({
        'GET https://api.shipstation.com/v2/carriers': mockCarriersResponse,
      })
      global.fetch = mockFetch as any

      const carriers = await client.listCarriers()

      expect(carriers).toHaveLength(2)
      expect(carriers[0]).toMatchObject({
        carrier_id: 'se-123456',
        carrier_code: 'fedex',
        carrier_name: 'FedEx',
      })
      expect(carriers[1]).toMatchObject({
        carrier_id: 'se-789012',
        carrier_code: 'usps',
        carrier_name: 'USPS',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when no carriers', async () => {
      const mockFetch = createMockFetch({
        'GET https://api.shipstation.com/v2/carriers': { carriers: [] },
      })
      global.fetch = mockFetch as any

      const carriers = await client.listCarriers()

      expect(carriers).toEqual([])
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error on API failure', async () => {
      const mockFetch = createMockFetch({
        'GET https://api.shipstation.com/v2/carriers': {
          error: true,
          status: 400,
          message: 'Bad Request',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.listCarriers()).rejects.toThrow(ShipStationError)
    })
  })

  describe('getCarrier', () => {
    it('should successfully get carrier details', async () => {
      const carrierId = 'se-123456'
      const mockCarrierResponse = {
        carrier_id: 'se-123456',
        carrier_code: 'fedex',
        carrier_name: 'FedEx',
        services: [
          {
            service_code: 'fedex_ground',
            name: 'FedEx Ground',
            domestic: true,
            international: false,
          },
        ],
        packages: [
          {
            package_code: 'package',
            name: 'Package',
          },
        ],
        options: [
          {
            option_code: 'saturday_delivery',
            name: 'Saturday Delivery',
          },
        ],
      }

      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/carriers/${carrierId}`]:
          mockCarrierResponse,
      })
      global.fetch = mockFetch as any

      const carrier = await client.getCarrier(carrierId)

      expect(carrier).toMatchObject({
        carrier_id: 'se-123456',
        carrier_code: 'fedex',
        carrier_name: 'FedEx',
      })
      expect(carrier.services).toHaveLength(1)
      expect(carrier.packages).toHaveLength(1)
      expect(carrier.options).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if carrier not found', async () => {
      const carrierId = 'invalid_id'
      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/carriers/${carrierId}`]: {
          error: true,
          status: 404,
          message: 'Carrier not found',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.getCarrier(carrierId)).rejects.toThrow(ShipStationError)
    })
  })

  describe('listCarrierServices', () => {
    it('should successfully list carrier services', async () => {
      const carrierId = 'se-123456'
      const mockServicesResponse = {
        services: [
          {
            service_code: 'fedex_ground',
            name: 'FedEx Ground',
            domestic: true,
            international: false,
            description: 'Ground delivery service',
          },
          {
            service_code: 'fedex_2day',
            name: 'FedEx 2Day',
            domestic: true,
            international: false,
            description: '2-day delivery service',
          },
        ],
      }

      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/carriers/${carrierId}/services`]:
          mockServicesResponse,
      })
      global.fetch = mockFetch as any

      const services = await client.listCarrierServices(carrierId)

      expect(services).toHaveLength(2)
      expect(services[0]).toMatchObject({
        service_code: 'fedex_ground',
        name: 'FedEx Ground',
        domestic: true,
        international: false,
      })
      expect(services[1]).toMatchObject({
        service_code: 'fedex_2day',
        name: 'FedEx 2Day',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when no services', async () => {
      const carrierId = 'se-123456'
      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/carriers/${carrierId}/services`]: {
          services: [],
        },
      })
      global.fetch = mockFetch as any

      const services = await client.listCarrierServices(carrierId)

      expect(services).toEqual([])
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error on API failure', async () => {
      const carrierId = 'se-123456'
      const mockFetch = createMockFetch({
        [`GET https://api.shipstation.com/v2/carriers/${carrierId}/services`]: {
          error: true,
          status: 400,
          message: 'Bad Request',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.listCarrierServices(carrierId)).rejects.toThrow(ShipStationError)
    })
  })
})
