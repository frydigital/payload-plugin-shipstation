/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  listCarriersHandler, 
  getCarrierHandler, 
  listCarrierServicesHandler 
} from '../../src/endpoints/listCarriers'

describe('listCarriers endpoints', () => {
  let mockPayload: any
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      listCarriers: vi.fn(),
      getCarrier: vi.fn(),
      listCarrierServices: vi.fn(),
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
    it('should successfully list carriers', async () => {
      const mockCarriers = [
        {
          carrier_id: 'se-123456',
          carrier_code: 'fedex',
          carrier_name: 'FedEx',
        },
        {
          carrier_id: 'se-789012',
          carrier_code: 'usps',
          carrier_name: 'USPS',
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
        'Fetching carriers from ShipStation...'
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
    it('should successfully get carrier details', async () => {
      const mockCarrier = {
        carrier_id: 'se-123456',
        carrier_code: 'fedex',
        carrier_name: 'FedEx',
        services: [],
      }

      mockClient.getCarrier.mockResolvedValue(mockCarrier)

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/se-123456',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrier: mockCarrier,
      })
      expect(mockClient.getCarrier).toHaveBeenCalledWith('se-123456')
    })

    it('should return 400 if carrier ID missing', async () => {
      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/',
      } as any

      const response = await getCarrierHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'Carrier ID is required',
      })
    })

    it('should handle errors gracefully', async () => {
      mockClient.getCarrier.mockRejectedValue(new Error('Carrier not found'))

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/se-123456',
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
        url: 'http://localhost:3000/api/shipping/carriers/se-123456',
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
    it('should successfully list carrier services', async () => {
      const mockServices = [
        {
          service_code: 'fedex_ground',
          name: 'FedEx Ground',
          domestic: true,
          international: false,
        },
        {
          service_code: 'fedex_2day',
          name: 'FedEx 2Day',
          domestic: true,
          international: false,
        },
      ]

      mockClient.listCarrierServices.mockResolvedValue(mockServices)

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/se-123456/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrier_id: 'se-123456',
        services: mockServices,
        count: 2,
      })
      expect(mockClient.listCarrierServices).toHaveBeenCalledWith('se-123456')
    })

    it('should return empty array when no services', async () => {
      mockClient.listCarrierServices.mockResolvedValue([])

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/se-123456/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(data).toMatchObject({
        carrier_id: 'se-123456',
        services: [],
        count: 0,
      })
    })

    it('should return 400 if carrier ID missing', async () => {
      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers//services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'Carrier ID is required',
      })
    })

    it('should handle errors gracefully', async () => {
      mockClient.listCarrierServices.mockRejectedValue(new Error('API Error'))

      const req = {
        payload: mockPayload,
        url: 'http://localhost:3000/api/shipping/carriers/se-123456/services',
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
        url: 'http://localhost:3000/api/shipping/carriers/se-123456/services',
      } as any

      const response = await listCarrierServicesHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'ShipStation client not initialized',
      })
    })
  })
})
