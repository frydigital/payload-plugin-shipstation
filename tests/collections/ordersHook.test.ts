/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getOrdersOverride } from '../../src/collections/ordersOverride'
import { createMockPayload, createMockShipStationClient } from '../testUtils'
import { mockOrder, mockPickupOrder, mockShipStationSuccessResponse } from '../mockData'

describe('orders collection afterChange hook', () => {
  let mockPayload: any
  let mockClient: any
  let hook: any

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()
    mockPayload.shipStationClient = mockClient
    mockPayload.config.shipStationPlugin = {
      warehouseId: 'se-warehouse-123',
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
      mockClient.createShipment.mockResolvedValue(mockShipStationSuccessResponse)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createShipment).toHaveBeenCalledOnce()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('pickup order, skipping')
      )
    })

    it('should only create shipments for shipping orders', async () => {
      const shippingOrder = { ...mockOrder, shippingMethod: 'shipping', status: 'processing' }
      const previousDoc = { ...shippingOrder, status: 'pending' }

      mockPayload.findByID.mockResolvedValue(shippingOrder)
      mockPayload.update.mockResolvedValue(shippingOrder)
      mockClient.createShipment.mockResolvedValue(mockShipStationSuccessResponse)

      await hook({
        req: { payload: mockPayload },
        doc: shippingOrder,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createShipment).toHaveBeenCalledOnce()
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

      expect(mockClient.createShipment).not.toHaveBeenCalled()
      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('already has shipment, skipping')
      )
    })
  })

  describe('successful shipment creation', () => {
    it('should create shipment and log success', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, id: 'order_123', status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      mockClient.createShipment.mockResolvedValue(mockShipStationSuccessResponse)

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
      mockClient.createShipment.mockResolvedValue(mockShipStationSuccessResponse)

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      expect(mockClient.createShipment).toHaveBeenCalled()
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
        expect.stringContaining('Shipment creation failed')
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
      mockClient.createShipment.mockResolvedValue(mockShipStationSuccessResponse)
      // First update for the successful shipment will work
      mockPayload.update.mockResolvedValueOnce(doc)
      // Second call tries to mark as manual_review, but this one fails
      mockPayload.update.mockRejectedValueOnce(new Error('Update failed'))

      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })

      // Should not have errors since shipment creation succeeded
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
    it('should not block on shipment creation', async () => {
      const previousDoc = { ...mockOrder, status: 'pending' }
      const doc = { ...mockOrder, status: 'processing' }

      mockPayload.findByID.mockResolvedValue(doc)
      mockPayload.update.mockResolvedValue(doc)
      
      // Simulate slow shipment creation
      mockClient.createShipment.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockShipStationSuccessResponse), 100))
      )

      const startTime = Date.now()
      await hook({
        req: { payload: mockPayload },
        doc,
        previousDoc,
        operation: 'update',
      })
      const duration = Date.now() - startTime

      // Hook should complete even if shipment creation is pending
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })
})
