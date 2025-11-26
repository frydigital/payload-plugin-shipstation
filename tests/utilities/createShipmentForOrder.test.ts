import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShipmentForOrder } from '../../src/utilities/createShipmentForOrder'
import {
    mockOrder,
    mockOrderInvalidAddress,
    mockOrderNoWeight,
    mockOrderWithVariant,
    mockPickupOrder,
    mockPluginOptions,
    mockShipStationV1OrderResponse,
} from '../mockData'
import {
    createMockPayload,
    createMockShipStationClient,
    mockEnv,
} from '../testUtils'

describe('createShipmentForOrder (V1 API)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPayload: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any
  let cleanupEnv: () => void

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()

    // Mock environment variables - V1 uses numeric warehouse ID
    cleanupEnv = mockEnv({
      SHIPSTATION_WAREHOUSE_ID: '123',
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupEnv()
  })

  describe('successful order creation', () => {
    it('should create order with complete data via V1 API', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      // V1 API uses createOrder instead of createShipment
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)
      // V1 API returns orderId (number) as string
      expect(result.shipmentId).toBe(String(mockShipStationV1OrderResponse.orderId))
      expect(mockClient.createOrder).toHaveBeenCalledOnce()
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'orders',
        id: 'order_123',
        data: expect.objectContaining({
          shippingDetails: expect.objectContaining({
            shipmentId: String(mockShipStationV1OrderResponse.orderId),
            shippingStatus: 'processing',
          }),
        }),
      })
    })

    it('should use variant weight when available', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrderWithVariant)
      mockPayload.update.mockResolvedValue(mockOrderWithVariant)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_456',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)

      // Verify V1 API order request includes weight
      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      expect(orderRequest.weight).toBeDefined()
    })

    it('should calculate total weight correctly in pounds', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      const weight = orderRequest.weight

      // 2 * 1.5kg + 1 * 0.5kg = 3.5kg = ~7.72 pounds
      expect(weight.value).toBeGreaterThan(7)
      expect(weight.value).toBeLessThan(8)
      expect(weight.units).toBe('pounds')
    })

    it('should map order items correctly for V1 API', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      const items = orderRequest.items

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
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      // V1 API uses advancedOptions.warehouseId (numeric)
      expect(orderRequest.advancedOptions.warehouseId).toBe(123)
    })

    it('should use V1 address format', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      // V1 uses street1, state, postalCode instead of snake_case
      expect(orderRequest.shipTo).toMatchObject({
        street1: '123 Main St',
        city: 'Vancouver',
        state: 'BC',
        postalCode: 'V6B1A1',
        country: 'CA',
      })
    })

    it('should convert prices from cents to dollars', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      // V1 API expects dollars, not cents
      // mockOrder.total = 15000 cents = $150
      expect(orderRequest.amountPaid).toBe(150)
    })
  })

  describe('missing data handling', () => {
    it('should handle products without weight', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrderNoWeight)
      mockPayload.update.mockResolvedValue(mockOrderNoWeight)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      const result = await createShipmentForOrder(
        mockPayload,
        'order_789',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(true)

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      // Should not include weight when totalWeight is 0
      expect(orderRequest.weight).toBeUndefined()
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
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      const orderRequest = mockClient.createOrder.mock.calls[0][0]
      const weight = orderRequest.weight

      // Only first item with weight: 2 * 1.5kg = 3kg = ~6.61 pounds
      expect(weight.value).toBeGreaterThan(6)
      expect(weight.value).toBeLessThan(7)
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
      expect(mockClient.createOrder).not.toHaveBeenCalled()
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
      expect(mockClient.createOrder).not.toHaveBeenCalled()
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
      expect(mockClient.createOrder).not.toHaveBeenCalled()
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

    it('should handle ShipStation V1 API errors', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      // V1 API returns null orderId on failure
      mockClient.createOrder.mockResolvedValue({ orderId: null })

      const result = await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('ShipStation returned no order')
    })

    it('should handle network errors', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockRejectedValue(
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
    it('should log order creation start', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating order in ShipStation for order_123')
      )
    })

    it('should log successful creation', async () => {
      mockPayload.findByID.mockResolvedValue(mockOrder)
      mockPayload.update.mockResolvedValue(mockOrder)
      mockClient.createOrder.mockResolvedValue(mockShipStationV1OrderResponse)

      await createShipmentForOrder(
        mockPayload,
        'order_123',
        mockClient,
        mockPluginOptions
      )

      expect(mockPayload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Order created successfully in ShipStation: ${mockShipStationV1OrderResponse.orderId}`)
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
        expect.stringContaining('Order creation failed')
      )
    })
  })
})
