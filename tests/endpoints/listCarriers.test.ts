/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  listCarriersHandler, 
  getCarrierHandler, 
  listCarrierServicesHandler,
  listCarrierPackagesHandler 
} from '../../src/endpoints/listCarriers'

describe('listCarriers endpoints (V1 API)', () => {
  let mockPayload: any
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      listCarriers: vi.fn(),
      getCarrier: vi.fn(),
      listCarrierServices: vi.fn(),
      listCarrierPackages: vi.fn(),
    }

    mockPayload = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      shipStationClient: mockClient,
    }
  })

  describe('listCarriersHandler', () => {
    it('should successfully list carriers (V1 format)', async () => {
      // V1 API returns different format than V2
      const mockCarriers = [
        {
          name: 'FedEx',
          code: 'fedex',
          accountNumber: '12345',
        },
        {
          name: 'USPS',
          code: 'stamps_com',
          accountNumber: '67890',
        },
      ]

      mockClient.listCarriers.mockResolvedValue(mockCarriers)

      const req = {
        payload: mockPayload,
      } as any

      const response = await listCarriersHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carriers: mockCarriers,
        count: 2,
      })
      expect(mockClient.listCarriers).toHaveBeenCalledOnce()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        'Fetching carriers from ShipStation V1 API...'
      )
    })

    it('should return empty array when no carriers', async () => {
      mockClient.listCarriers.mockResolvedValue([])

      const req = {
        payload: mockPayload,
      } as any

      const response = await listCarriersHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carriers: [],
        count: 0,
      })
    })

    it('should handle errors gracefully', async () => {
      mockClient.listCarriers.mockRejectedValue(new Error('API Error'))

      const req = {
        payload: mockPayload,
      } as any

      const response = await listCarriersHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'API Error',
      })
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        'Failed to list carriers: API Error'
      )
    })

    it('should return 500 if client not initialized', async () => {
      const req = {
        payload: {
          ...mockPayload,
          shipStationClient: undefined,
        },
      } as any

      const response = await listCarriersHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'ShipStation client not initialized',
      })
    })
  })

  describe('getCarrierHandler', () => {
    it('should successfully get carrier details using carrierCode', async () => {
      // V1 API uses carrierCode instead of carrierId
      const mockCarrier = {
        name: 'FedEx',
        code: 'fedex',
        accountNumber: '12345',
        requiresFundedAccount: false,
      }

      mockClient.getCarrier.mockResolvedValue(mockCarrier)

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/fedex',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrier: mockCarrier,
      })
      expect(mockClient.getCarrier).toHaveBeenCalledWith('fedex')
    })

    it('should return 400 if carrier code missing', async () => {
      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'Carrier code is required',
      })
    })

    it('should handle errors gracefully', async () => {
      mockClient.getCarrier.mockRejectedValue(new Error('Carrier not found'))

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/invalid',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'Carrier not found',
      })
    })

    it('should return 500 if client not initialized', async () => {
      const req = {
        payload: {
          ...mockPayload,
          shipStationClient: undefined,
        },
        url: 'http://localhost:3000/api/shipping/carriers/fedex',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'ShipStation client not initialized',
      })
    })
  })

  describe('listCarrierServicesHandler', () => {
    it('should successfully list carrier services using carrierCode', async () => {
      // V1 API service format
      const mockServices = [
        {
          carrierCode: 'fedex',
          code: 'fedex_ground',
          name: 'FedEx Ground',
          domestic: true,
          international: false,
        },
        {
          carrierCode: 'fedex',
          code: 'fedex_2day',
          name: 'FedEx 2Day',
          domestic: true,
          international: false,
        },
      ]

      mockClient.listCarrierServices.mockResolvedValue(mockServices)

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/fedex/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrierCode: 'fedex',
        services: mockServices,
        count: 2,
      })
      expect(mockClient.listCarrierServices).toHaveBeenCalledWith('fedex')
    })

    it('should return empty array when no services', async () => {
      mockClient.listCarrierServices.mockResolvedValue([])

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/test/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrierCode: 'test',
        services: [],
        count: 0,
      })
    })

    it('should return 400 if carrier code missing', async () => {
      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers//services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'Carrier code is required',
      })
    })

    it('should handle errors gracefully', async () => {
      mockClient.listCarrierServices.mockRejectedValue(new Error('API Error'))

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/fedex/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'API Error',
      })
    })

    it('should return 500 if client not initialized', async () => {
      const req = {
        payload: {
          ...mockPayload,
          shipStationClient: undefined,
        },
        url: 'http://localhost:3000/api/shipping/carriers/fedex/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'ShipStation client not initialized',
      })
    })
  })

  describe('listCarrierPackagesHandler', () => {
    it('should successfully list carrier packages', async () => {
      const mockPackages = [
        {
          carrierCode: 'fedex',
          code: 'package',
          name: 'Package',
          domestic: true,
          international: true,
        },
        {
          carrierCode: 'fedex',
          code: 'fedex_envelope',
          name: 'FedEx Envelope',
          domestic: true,
          international: false,
        },
      ]

      mockClient.listCarrierPackages.mockResolvedValue(mockPackages)

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/fedex/packages',
      } as any

      const response = await listCarrierPackagesHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrierCode: 'fedex',
        packages: mockPackages,
        count: 2,
      })
      expect(mockClient.listCarrierPackages).toHaveBeenCalledWith('fedex')
    })

    it('should return 400 if carrier code missing', async () => {
      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers//packages',
      } as any

      const response = await listCarrierPackagesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'Carrier code is required',
      })
    })

    it('should return 500 if client not initialized', async () => {
      const req = {
        payload: {
          ...mockPayload,
          shipStationClient: undefined,
        },
        url: 'http://localhost:3000/api/shipping/carriers/fedex/packages',
      } as any

      const response = await listCarrierPackagesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'ShipStation client not initialized',
      })
    })
  })
})
