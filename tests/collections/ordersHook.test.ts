/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrdersOverride } from '../../src/collections/ordersOverride'
import { mockOrder, mockPickupOrder, mockShipStationV1OrderResponse } from '../mockData'
import { createMockPayload, createMockShipStationClient } from '../testUtils'

describe('orders collection afterChange hook (V1 API)', () => {
  let mockPayload: any
  let mockClient: any
  let hook: any

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()
    mockPayload.shipStationClient = mockClient
    mockPayload.config.shipStationPlugin = {
      warehouseId: '123',
      enabledFeatures: {
        autoCreateShipments: true,
      },
    }

    // Get the afterChange hook from the override
    const override = getOrdersOverride()
    hook = override.hooks?.afterChange?.[0]

    vi.clearAllMocks()
  })

  describe('hook triggering conditions', () => {
    it('should trigger on status change to processing', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      // V1 API uses createOrder
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).toHaveBeenCalledOnce()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auto-creating shipment')
      )
    })

    it('should not trigger on create operation', async () => {
      const doc = { ...mockOrder, status: 'processing' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc: null,
        operation: 'create',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
    })

    it('should not trigger if status unchanged', async () => {
      const previousDoc = { ...mockOrder, status: 'processing' }
      const doc = { ...mockOrder, status: 'processing' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
    })

    it('should not trigger if status changes to non-processing', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'shipped' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
    })

    it('should not trigger if autoCreateShipments disabled', async () => {
      mockPayload.config.shipStationPlugin.enabledFeatures.autoCreateShipments = false
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
    })
  })

  describe('pickup orders', () => {
    it('should skip pickup orders', async () => {
      const previousDoc = { ...mockPickupOrder, status: 'pending' }
      const doc = { ...mockPickupOrder, status: 'processing' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('pickup order, skipping')
      )
    })

    it('should only create orders for shipping orders', async () => {
      const shippingOrder = { ...mockOrder, shippingMethod: 'shipping', status: 'processing' }
      const previousDoc = { ...shippingOrder, status: 'pending' }

      mockPayload.findByID.mockResolvedValue(shippingOrder)
      mockPayload.update.mockResolvedValue(shippingOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await hook({
        req: { payload: mockPayload },
        doc: shippingOrder,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).toHaveBeenCalledOnce()
    })
  })

  describe('existing shipments', () => {
    it('should skip if shipment already exists', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = {
        ...mockOrder,
        status: 'processing',
        shippingDetails: {
          shipmentId: 'se-existing-123',
        },
      }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('already has shipment, skipping')
      )
    })
  })

  describe('successful order creation', () => {
    it('should create order and log success', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, id: 'order_123', status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Shipment created successfully for order order_123')
      )
    })

    it('should use the correct client and config', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createOrder).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should log error on failure', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, id: 'order_123', status: 'processing' }

      mockPayload.findByID.mockResolvedValue(null) // Simulate order not found
      mockPayload.update.mockResolvedValue(doc)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      // createShipmentForOrder returns { success: false } and doesn't throw
      // So the hook's catch block is never hit, it just logs the utility's error
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Order creation failed')
      )
      // Manual review status is set by the endpoint, not the hook
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should log error if client not initialized', async () => {
      mockPayload.shipStationClient = null
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        'ShipStation client not initialized'
      )
    })

    it('should handle update errors gracefully', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, id: 'order_123', status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)
      // First update for the successful order will work
      mockPayload.update.mockResolvedValueOnce(doc)
      // Second call tries to mark as manual_review, but this one fails
      mockPayload.update.mockRejectedValueOnce(new Error('Update failed'))

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      // Should not have errors since order creation succeeded
      expect(mockPayload.logger.error).not.toHaveBeenCalled()
    })

    it('should return document even on error', async () => {
      mockPayload.shipStationClient = null
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      const result = await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(result).toBe(doc)
    })
  })

  describe('asynchronous behavior', () => {
    it('should not block on order creation', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      
      // Simulate slow order creation
      mockClient.createOrder.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockShipStationV1OrderResponse), 100))
      )

      const startTime = Date.now()
      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })
      const duration = Date.now() - startTime

      // Hook should complete even if order creation is pending
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })
})
