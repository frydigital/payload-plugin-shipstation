import type { Endpoint } from 'payload'
import type {
  CreateShipmentRequest,
  CreateShipmentResponse,
} from '../types'
import { createShipmentForOrder } from '../utilities/createShipmentForOrder'

/**
 * Create Shipment Endpoint
 * 
 * Creates a shipment in ShipStation based on a Payload order.
 * 
 * Workflow:
 * 1. Fetch order from Payload
 * 2. Validate order has shipping address and is flagged for shipping
 * 3. Optionally validate/correct address via ShipStation
 * 4. Map order data to ShipStation shipment format
 * 5. Create shipment in ShipStation
 * 6. Update order with shipment ID and status
 * 7. Handle errors with manual review status
 */
export const createShipmentHandler: Endpoint['handler'] = async (req) => {
  try {
    const body = req.json ? await req.json() : req.body
    const { orderId } = body as CreateShipmentRequest

    if (!orderId) {
      return Response.json(
        { success: false, error: 'Order ID is required' } as CreateShipmentResponse,
        { status: 400 }
      )
    }

    const client = (req.payload as any).shipStationClient
    const config = req.payload.config as any
    const pluginOptions = config.shipStationPlugin

    if (!client) {
      return Response.json(
        { success: false, error: 'ShipStation client not initialized' } as CreateShipmentResponse,
        { status: 500 }
      )
    }

    // Use the helper utility to create shipment
    const result = await createShipmentForOrder(req.payload, orderId, client, pluginOptions)

    if (!result.success) {
      // Update order to manual review status
      try {
        await req.payload.update({
          collection: 'orders',
          id: orderId,
          data: {
            shippingDetails: {
              shippingStatus: 'manual_review',
            },
          },
        })
      } catch (updateError) {
        req.payload.logger.error(`Failed to update order status: ${(updateError as Error).message}`)
      }

      return Response.json(
        {
          success: false,
          error: result.error,
          orderId,
          status: 'manual_review',
        } as CreateShipmentResponse,
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      shipmentId: result.shipmentId,
      orderId,
      status: 'processing',
    } as CreateShipmentResponse)

  } catch (err) {
    const error = err as Error
    req.payload.logger.error(`Shipment creation endpoint error: ${error.message}`)

    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to create shipment',
      } as CreateShipmentResponse,
      { status: 500 }
    )
  }
}
