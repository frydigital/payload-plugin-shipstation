/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipStationClient, ShipStationError } from '../../src/api/shipstation'
import {
  mockShipStationV1CarriersResponse,
  mockShipStationV1OrderResponse,
  mockShipStationV1RatesResponse,
  mockShipStationV1ServicesResponse,
  mockShipStationV1Shipment,
  mockShipStationV1ValidateAddressResponse,
} from '../mockData'
import { createMockFetch } from '../testUtils'

describe('ShipStationClient V1 API', () => {
  let client: ShipStationClient
  const mockApiKey = 'TEST_API_KEY'
  const mockApiSecret = 'TEST_API_SECRET'
  const mockWarehouseId = '123'

  beforeEach(() => {
    client = new ShipStationClient({
      apiKey: `${mockApiKey}:${mockApiSecret}`,
      warehouseId: mockWarehouseId,
    })
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with V1 API URL by default', () => {
      const prodClient = new ShipStationClient({
        apiKey: mockApiKey,
        warehouseId: mockWarehouseId,
      })
      expect(prodClient).toBeDefined()
    })

    it('should parse API key:secret format', () => {
      const clientWithAuth = new ShipStationClient({
        apiKey: 'mykey:mysecret',
        warehouseId: mockWarehouseId,
      })
      expect(clientWithAuth.getApiKey()).toBe('mykey')
    })

    it('should use apiKey as both key and secret if no colon', () => {
      const clientSimple = new ShipStationClient({
        apiKey: 'mykey',
        warehouseId: mockWarehouseId,
      })
      expect(clientSimple.getApiKey()).toBe('mykey')
    })
  })

  describe('createOrder', () => {
    it('should successfully create an order', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/orders/createorder':
          mockShipStationV1OrderResponse,
      })
      global.fetch = mockFetch as any

      const request = {
        orderNumber: 'order_123',
        orderKey: 'order_123',
        orderDate: '2025-11-23T10:00:00',
        orderStatus: 'awaiting_shipment' as const,
        shipTo: {
          name: 'John Doe',
          street1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }

      const response = await client.createOrder(request)

      expect(response).toEqual(mockShipStationV1OrderResponse)
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ssapi.shipstation.com/orders/createorder',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Basic /),
          }),
        })
      )
    })

    it('should throw ShipStationError on API error', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/orders/createorder': {
          error: true,
          status: 400,
          Message: 'Invalid request',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.createOrder({
        orderNumber: 'test',
        orderDate: '2025-11-23',
        orderStatus: 'awaiting_shipment',
        shipTo: { name: 'Test', street1: '123', city: 'Test', state: 'BC', postalCode: '12345', country: 'CA' },
      })).rejects.toThrow(ShipStationError)
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
          json: async () => mockShipStationV1OrderResponse,
        }
      })
      global.fetch = mockFetch as any

      const response = await client.createOrder({
        orderNumber: 'test',
        orderDate: '2025-11-23',
        orderStatus: 'awaiting_shipment',
        shipTo: { name: 'Test', street1: '123', city: 'Test', state: 'BC', postalCode: '12345', country: 'CA' },
      })

      expect(response).toEqual(mockShipStationV1OrderResponse)
      expect(callCount).toBeGreaterThan(1)
    })

    it('should not retry on 4xx errors', async () => {
      const mockFetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => JSON.stringify({ Message: 'Bad Request' }),
          json: async () => ({ Message: 'Bad Request' }),
        }
      })
      global.fetch = mockFetch as any

      await expect(client.createOrder({
        orderNumber: 'test',
        orderDate: '2025-11-23',
        orderStatus: 'awaiting_shipment',
        shipTo: { name: 'Test', street1: '123', city: 'Test', state: 'BC', postalCode: '12345', country: 'CA' },
      })).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledOnce()
    })
  })

  describe('getShipment', () => {
    it('should successfully get a shipment', async () => {
      const shipmentId = 123456789
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/shipments?shipmentId=${shipmentId}`]:
          { shipments: [mockShipStationV1Shipment] },
      })
      global.fetch = mockFetch as any

      const response = await client.getShipment(shipmentId)

      expect(response).toEqual(mockShipStationV1Shipment)
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if shipment not found', async () => {
      const shipmentId = 999999999
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/shipments?shipmentId=${shipmentId}`]:
          { shipments: [] },
      })
      global.fetch = mockFetch as any

      await expect(client.getShipment(shipmentId)).rejects.toThrow(ShipStationError)
    })
  })

  describe('voidLabel', () => {
    it('should successfully void a label', async () => {
      const shipmentId = 123456789
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/shipments/voidlabel':
          { approved: true },
      })
      global.fetch = mockFetch as any

      const response = await client.voidLabel(shipmentId)

      expect(response).toEqual({ approved: true })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if void fails', async () => {
      const shipmentId = 123456789
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/shipments/voidlabel':
          {
            error: true,
            status: 400,
            Message: 'Cannot void shipped label',
          },
      })
      global.fetch = mockFetch as any

      await expect(client.voidLabel(shipmentId)).rejects.toThrow(ShipStationError)
    })
  })

  describe('getRates', () => {
    it('should successfully fetch rates from ShipStation V1 API', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/shipments/getrates': mockShipStationV1RatesResponse,
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
        carrierCodes: ['canada_post'],
      })

      expect(rates).toHaveLength(2)
      expect(rates[0]).toMatchObject({
        serviceName: 'Canada Post Expedited',
        serviceCode: 'expedited',
        carrierCode: 'canada_post',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when no carrier codes provided', async () => {
      const rates = await client.getRates({
        shipTo: {
          addressLine1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
        weight: {
          value: 1.5,
          unit: 'kilogram',
        },
        carrierCodes: [],
      })

      expect(rates).toEqual([])
    })

    it('should return empty array on API error', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/shipments/getrates': {
          error: true,
          status: 400,
          Message: 'Invalid shipment data',
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
        carrierCodes: ['canada_post'],
      })

      expect(rates).toEqual([])
    })
  })

  describe('validateAddress', () => {
    it('should successfully validate an address', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/addresses/validate': mockShipStationV1ValidateAddressResponse,
      })
      global.fetch = mockFetch as any

      const result = await client.validateAddress({
        name: 'John Doe',
        street1: '123 Main St',
        city: 'Vancouver',
        state: 'BC',
        postalCode: 'V6B1A1',
        country: 'CA',
      })

      expect(result.isValid).toBe(true)
      expect(result.normalizedAddress).toBeDefined()
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return isValid false on validation failure', async () => {
      const mockFetch = createMockFetch({
        'POST https://ssapi.shipstation.com/addresses/validate': {
          error: true,
          status: 400,
          Message: 'Address not found',
        },
      })
      global.fetch = mockFetch as any

      const result = await client.validateAddress({
        street1: 'Invalid Address',
        city: 'Nowhere',
        state: 'XX',
        postalCode: '00000',
        country: 'US',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('listCarriers', () => {
    it('should successfully list carriers', async () => {
      const mockFetch = createMockFetch({
        'GET https://ssapi.shipstation.com/carriers': mockShipStationV1CarriersResponse,
      })
      global.fetch = mockFetch as any

      const carriers = await client.listCarriers()

      expect(carriers).toHaveLength(2)
      expect(carriers[0]).toMatchObject({
        name: 'FedEx',
        code: 'fedex',
      })
      expect(carriers[1]).toMatchObject({
        name: 'USPS',
        code: 'stamps_com',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when no carriers', async () => {
      const mockFetch = createMockFetch({
        'GET https://ssapi.shipstation.com/carriers': [],
      })
      global.fetch = mockFetch as any

      const carriers = await client.listCarriers()

      expect(carriers).toEqual([])
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error on API failure', async () => {
      const mockFetch = createMockFetch({
        'GET https://ssapi.shipstation.com/carriers': {
          error: true,
          status: 400,
          Message: 'Bad Request',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.listCarriers()).rejects.toThrow(ShipStationError)
    })
  })

  describe('getCarrier', () => {
    it('should successfully get carrier details', async () => {
      const carrierCode = 'fedex'
      const mockCarrierResponse = {
        name: 'FedEx',
        code: 'fedex',
        accountNumber: '12345',
        requiresFundedAccount: false,
      }

      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/getcarrier?carrierCode=${carrierCode}`]:
          mockCarrierResponse,
      })
      global.fetch = mockFetch as any

      const carrier = await client.getCarrier(carrierCode)

      expect(carrier).toMatchObject({
        name: 'FedEx',
        code: 'fedex',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error if carrier not found', async () => {
      const carrierCode = 'invalid_carrier'
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/getcarrier?carrierCode=${carrierCode}`]: {
          error: true,
          status: 404,
          Message: 'Carrier not found',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.getCarrier(carrierCode)).rejects.toThrow(ShipStationError)
    })
  })

  describe('listCarrierServices', () => {
    it('should successfully list carrier services', async () => {
      const carrierCode = 'fedex'
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/listservices?carrierCode=${carrierCode}`]:
          mockShipStationV1ServicesResponse,
      })
      global.fetch = mockFetch as any

      const services = await client.listCarrierServices(carrierCode)

      expect(services).toHaveLength(2)
      expect(services[0]).toMatchObject({
        carrierCode: 'fedex',
        code: 'fedex_ground',
        name: 'FedEx Ground',
        domestic: true,
        international: false,
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should return empty array when no services', async () => {
      const carrierCode = 'test_carrier'
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/listservices?carrierCode=${carrierCode}`]: [],
      })
      global.fetch = mockFetch as any

      const services = await client.listCarrierServices(carrierCode)

      expect(services).toEqual([])
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('should throw error on API failure', async () => {
      const carrierCode = 'fedex'
      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/listservices?carrierCode=${carrierCode}`]: {
          error: true,
          status: 400,
          Message: 'Bad Request',
        },
      })
      global.fetch = mockFetch as any

      await expect(client.listCarrierServices(carrierCode)).rejects.toThrow(ShipStationError)
    })
  })

  describe('listCarrierPackages', () => {
    it('should successfully list carrier packages', async () => {
      const carrierCode = 'fedex'
      const mockPackagesResponse = [
        { carrierCode: 'fedex', code: 'package', name: 'Package', domestic: true, international: true },
        { carrierCode: 'fedex', code: 'fedex_envelope', name: 'FedEx Envelope', domestic: true, international: false },
      ]

      const mockFetch = createMockFetch({
        [`GET https://ssapi.shipstation.com/carriers/listpackages?carrierCode=${carrierCode}`]:
          mockPackagesResponse,
      })
      global.fetch = mockFetch as any

      const packages = await client.listCarrierPackages(carrierCode)

      expect(packages).toHaveLength(2)
      expect(packages[0]).toMatchObject({
        carrierCode: 'fedex',
        code: 'package',
        name: 'Package',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })
  })

  describe('listWarehouses', () => {
    it('should successfully list warehouses', async () => {
      const mockWarehousesResponse = [
        {
          warehouseId: 123,
          warehouseName: 'Main Warehouse',
          originAddress: { street1: '123 Main St', city: 'Vancouver', state: 'BC', postalCode: 'V6B1A1', country: 'CA' },
          createDate: '2025-01-01T00:00:00',
          isDefault: true,
        },
      ]

      const mockFetch = createMockFetch({
        'GET https://ssapi.shipstation.com/warehouses': mockWarehousesResponse,
      })
      global.fetch = mockFetch as any

      const warehouses = await client.listWarehouses()

      expect(warehouses).toHaveLength(1)
      expect(warehouses[0]).toMatchObject({
        warehouseId: 123,
        warehouseName: 'Main Warehouse',
      })
      expect(mockFetch).toHaveBeenCalledOnce()
    })
  })
})
