/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ShipStationClient, ShipStationError } from '../../src/api/shipstation'
import {
  mockShipStationRequest,
  mockShipStationSuccessResponse,
  mockShipStationGetResponse,
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
      sandboxMode: true,
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

    it('should initialize with sandbox URL when sandboxMode is true', () => {
      const sandboxClient = new ShipStationClient({
        apiKey: mockApiKey,
        warehouseId: mockWarehouseId,
        sandboxMode: true,
      })
      expect(sandboxClient).toBeDefined()
    })
  })

  describe('createShipment', () => {
    it('should successfully create a shipment', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi-sandbox.shipstation.com/v2/shipments':
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
        'https://ssapi-sandbox.shipstation.com/v2/shipments',
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
        'POST https://ssapi-sandbox.shipstation.com/v2/shipments': {
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
        [`GET https://ssapi-sandbox.shipstation.com/v2/shipments/${shipmentId}`]:
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
        [`GET https://ssapi-sandbox.shipstation.com/v2/shipments/${shipmentId}`]:
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
        [`POST https://ssapi-sandbox.shipstation.com/v2/shipments/${shipmentId}/cancel`]:
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
        [`POST https://ssapi-sandbox.shipstation.com/v2/shipments/${shipmentId}/cancel`]:
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
    it('should return empty array (not implemented)', async () => {
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

      expect(rates).toEqual([])
    })
  })
})
