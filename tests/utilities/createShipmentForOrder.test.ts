import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createShipmentForOrder } from '../../src/utilities/createShipmentForOrder'
import {
  createMockPayload,
  createMockShipStationClient,
  mockEnv,
} from '../testUtils'
import {
  mockOrder,
  mockOrderWithVariant,
  mockOrderNoWeight,
  mockPickupOrder,
  mockOrderInvalidAddress,
  mockShipStationSuccessResponse,
  mockShipStationErrorResponse,
  mockPluginOptions,
} from '../mockData'

describe('createShipmentForOrder', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPayload: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any
  let cleanupEnv: () => void

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()

    // Mock environment variables
    cleanupEnv = mockEnv({
      SHIPSTATION_WAREHOUSE_ID: 'se-warehouse-123',
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupEnv()
  })

  describe('successful shipment creation', () => {
    it('should create shipment with complete order data', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)
      expect(result.shipmentId).toBe('se-123456789')
      expect(mockClient.createShipment).toHaveBeenCalledOnce()
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'orders',
        id: 'order_123',
        data: expect.objectContaining({
          shippingDetails: expect.objectContaining({
            shipmentId: 'se-123456789',
            shippingStatus: 'processing',
          }),
        }),
      })
    })

    it('should use variant weight when available', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrderWithVariant)
      mockPayload.update.mockResolvedValue(mockOrderWithVariant)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      const result = await createShipmentForOrder(
        mockPayload,
        'order_456',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)

      // Verify weight from variant is used
      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      expect(shipmentRequest.shipments[0].packages[0].weight.value).toBe(2.5)
    })

    it('should calculate total weight correctly', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      const totalWeight = shipmentRequest.shipments[0].packages[0].weight.value

      // 2 * 1.5kg + 1 * 0.5kg = 3.5kg
      expect(totalWeight).toBe(3.5)
    })

    it('should map order items correctly', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      const items = shipmentRequest.shipments[0].items

      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({
        name: 'Test Product 1',
        sku: 'TEST-001',
        quantity: 2,
      })
    })

    it('should use warehouse_id from environment variable', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      expect(shipmentRequest.shipments[0].warehouse_id).toBe(
        'se-warehouse-123'
      )
    })
  })

  describe('missing data handling', () => {
    it('should handle products without weight', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrderNoWeight)
      mockPayload.update.mockResolvedValue(mockOrderNoWeight)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      const result = await createShipmentForOrder(
        mockPayload,
        'order_789',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)

      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      // Should not include packages when totalWeight is 0
      expect(shipmentRequest.shipments[0].packages).toBeUndefined()
    })

    it('should skip items without weight in calculation', async () => {
      const orderMixedWeights = {
        ...mockOrder,
        items: [
          mockOrder.items[0], // Has weight
          {
            quantity: 1,
            price: 5000,
            product: {
              id: 'prod_no_weight',
              title: 'Product Without Weight',
              sku: 'TEST-004',
              shippingDetails: {},
            },
            variant: null,
          },
        ],
      }

      mockPayload.findByID.mockResolvedValue(orderMixedWeights)
      mockPayload.update.mockResolvedValue(orderMixedWeights)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const shipmentRequest = mockClient.createShipment.mock.calls[0][0]
      const totalWeight = shipmentRequest.shipments[0].packages[0].weight.value

      // Only first item with weight: 2 * 1.5kg = 3kg
      expect(totalWeight).toBe(3)
    })
  })

  describe('error handling', () => {
    it('should fail if order not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      const result = await createShipmentForOrder(
        mockPayload,
        'invalid_order',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Order not found')
      expect(mockClient.createShipment).not.toHaveBeenCalled()
    })

    it('should fail for pickup orders', async () => {
      mockPayload.findByID.mockResolvedValue(mockPickupOrder)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_pickup_1',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not flagged for shipping')
      expect(mockClient.createShipment).not.toHaveBeenCalled()
    })

    it('should fail with invalid shipping address', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrderInvalidAddress)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_invalid',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('missing required shipping address')
      expect(mockClient.createShipment).not.toHaveBeenCalled()
    })

    it('should fail if warehouse ID not configured', async () => {
      cleanupEnv()
      cleanupEnv = mockEnv({}) // No warehouse ID

      mockPayload.findByID.mockResolvedValue(mockOrder)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        { ...mockPluginOptions, warehouseId: undefined }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Warehouse ID not configured')
    })

    it('should handle ShipStation API errors', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationErrorResponse
      )

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid address')
    })

    it('should handle network errors', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockRejectedValue(
        new Error('Network timeout')
      )

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network timeout')
    })
  })

  describe('logging', () => {
    it('should log shipment creation start', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating shipment for order order_123')
      )
    })

    it('should log successful creation', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createShipment.mockResolvedValue(
        mockShipStationSuccessResponse
      )

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Shipment created successfully: se-123456789')
      )
    })

    it('should log errors', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      await createShipmentForOrder(
        mockPayload,
        'invalid_order',
        mockClient,
        mockPluginOptions
      )

      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Shipment creation failed')
      )
    })
  })
})
