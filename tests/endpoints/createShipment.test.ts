/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createShipmentHandler } from '../../src/endpoints/createShipment'
import { createMockPayload, createMockRequest, createMockShipStationClient } from '../testUtils'
import { mockOrder, mockShipStationV1OrderResponse } from '../mockData'

describe('createShipment endpoint (V1 API)', () => {
  let mockPayload: any
  let mockClient: any
  let mockReq: any

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()
    mockPayload.shipStationClient = mockClient
    mockPayload.config.shipStationPlugin = {
      warehouseId: '123',
    }

    vi.clearAllMocks()
  })

  describe('success cases', () => {
    it('should create order successfully via V1 API', async () => {
      const requestBody = { orderId: 'order_123' }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      // V1 API uses createOrder instead of createShipment
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(200)
      expect(jsonData.success).toBe(true)
      // V1 API returns orderId (number) not shipmentId (string)
      expect(jsonData.shipmentId).toBe(String(mockShipStationV1OrderResponse.orderId))
      expect(jsonData.orderId).toBe('order_123')
      expect(jsonData.status).toBe('processing')
    })

    it('should return order details on success', async () => {
      const requestBody = { orderId: 'order_456' }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(jsonData).toMatchObject({
        success: true,
        shipmentId: String(mockShipStationV1OrderResponse.orderId),
        orderId: 'order_456',
        status: 'processing',
      })
    })
  })

  describe('validation errors', () => {
    it('should return 400 if orderId is missing', async () => {
      const requestBody = {}
      mockReq = createMockRequest(requestBody, mockPayload)

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(400)
      expect(jsonData.success).toBe(false)
      expect(jsonData.error).toContain('Order ID is required')
    })

    it('should return 500 if client not initialized', async () => {
      const requestBody = { orderId: 'order_123' }
      mockPayload.shipStationClient = null
      mockReq = createMockRequest(requestBody, mockPayload)

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.success).toBe(false)
      expect(jsonData.error).toContain('ShipStation client not initialized')
    })
  })

  describe('error handling', () => {
    it('should mark order as manual_review on failure', async () => {
      const requestBody = { orderId: 'order_123' }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findByID.mockResolvedValue(null) // Order not found
      mockPayload.update.mockResolvedValue({})

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.success).toBe(false)
      expect(jsonData.status).toBe('manual_review')
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'orders',
        id: 'order_123',
        data: {
          shippingDetails: {
            shippingStatus: 'manual_review',
          },
        },
      })
    })

    it('should handle order creation errors gracefully', async () => {
      const requestBody = { orderId: 'order_123' }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockRejectedValue(new Error('API timeout'))
      mockPayload.update.mockResolvedValue({})

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.success).toBe(false)
      expect(jsonData.error).toBeDefined()
    })

    it('should log errors when status update fails', async () => {
      const requestBody = { orderId: 'order_123' }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findByID.mockResolvedValue(null)
      mockPayload.update.mockRejectedValue(new Error('Update failed'))

      await createShipmentHandler(mockReq)

      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update order status')
      )
    })

    it('should handle unexpected errors', async () => {
      const requestBody = { orderId: 'order_123' }
      mockReq = createMockRequest(requestBody, mockPayload)

      // Simulate an unexpected error
      mockPayload.findByID.mockImplementation(() => {
        throw new Error('Unexpected database error')
      })

      const response = await createShipmentHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.success).toBe(false)
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Order creation failed')
      )
    })
  })
})
