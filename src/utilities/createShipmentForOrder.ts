import type { Payload } from 'payload';
import type { ShipStationCreateShipmentRequest } from '../types';

/**
 * Helper function to create a shipment for an order
 * Used by both the endpoint and the afterChange hook
 */
export async function createShipmentForOrder(
  payload: Payload,
  orderId: string,
  client: any,
  pluginOptions: any,
  orderDoc?: any
): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
  try {
    console.warn(`🔥 [createShipmentForOrder] START: Order ID: ${orderId}`)
    console.warn(`🔥 [createShipmentForOrder] Client exists: ${!!client}`)
    console.warn(`🔥 [createShipmentForOrder] PluginOptions exists: ${!!pluginOptions}`)
    console.warn(`🔥 [createShipmentForOrder] OrderDoc provided: ${!!orderDoc}`)
    
    // Use provided order doc or fetch it
    let order
    if (orderDoc) {
      console.warn(`🔥 [createShipmentForOrder] Using provided order doc`)
      order = orderDoc
    } else {
      console.warn(`🔥 [createShipmentForOrder] Fetching order...`)
      order = await payload.findByID({
        collection: 'orders',
        id: orderId,
      })
      console.warn(`🔥 [createShipmentForOrder] Order fetched successfully`)
    }

    if (!order) {
      throw new Error('Order not found')
    }

    // Validate order is for shipping (not pickup)
    if (order.shippingMethod !== 'shipping') {
      throw new Error('Order is not flagged for shipping')
    }

    // Validate order has shipping address
    const shippingAddress = order.shippingAddress
    if (
      !shippingAddress ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.postalCode ||
      !shippingAddress.country
    ) {
      throw new Error('Order missing required shipping address fields')
    }

    // Use warehouse ID from environment variable or plugin config
    const warehouseId = process.env.SHIPSTATION_WAREHOUSE_ID || pluginOptions.warehouseId
    
    if (!warehouseId) {
      throw new Error('Warehouse ID not configured (set SHIPSTATION_WAREHOUSE_ID environment variable)')
    }

    // Map order items to ShipStation format
    const items = (order.items || []).map((item: any) => {
      const product = item.product
      const variant = item.variant
      
      return {
        name: variant?.title || product?.title || 'Unknown Product',
        sku: variant?.sku || product?.sku || undefined,
        quantity: item.quantity || 1,
        unit_price: item.price ? {
          currency: (order as any).currency || 'USD', // TODO: Get from order currency field
          amount: item.price,
        } : undefined,
        weight: variant?.shippingDetails?.weight || product?.shippingDetails?.weight ? {
          value: variant?.shippingDetails?.weight?.value || product?.shippingDetails?.weight?.value,
          unit: variant?.shippingDetails?.weight?.unit || product?.shippingDetails?.weight?.unit,
        } : undefined,
      }
    })

    // Calculate total weight for package
    const totalWeight = items.reduce((sum: number, item: any) => {
      if (item.weight?.value && item.weight?.unit === 'kg') {
        return sum + (item.weight.value * item.quantity)
      }
      return sum
    }, 0)

    // Build ShipStation shipment request
    const shipmentRequest: ShipStationCreateShipmentRequest = {
      shipments: [
        {
          validate_address: 'validate_and_clean',
          external_shipment_id: orderId,
          shipment_status: 'pending',
          warehouse_id: warehouseId,
          // Only include carrier_id if present; service_code is not part of v2 create shipments schema
          ...( (order as any).selectedRate?.carrierId ? { carrier_id: (order as any).selectedRate?.carrierId } : {} ),
          create_sales_order: true,
          ship_to: {
            name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() || 'Customer',
            company_name: shippingAddress.company || undefined,
            address_line1: shippingAddress.addressLine1 || '',
            address_line2: shippingAddress.addressLine2 || undefined,
            city_locality: shippingAddress.city || '',
            state_province: shippingAddress.state || '',
            postal_code: shippingAddress.postalCode || '',
            country_code: shippingAddress.country || '',
            phone: shippingAddress.phone || undefined,
            address_residential_indicator: 'yes',
          },
          items,
          packages: totalWeight > 0 ? [
            {
              weight: {
                value: totalWeight,
                unit: 'kilogram',
              },
            },
          ] : undefined,
          amount_paid: (order as any).total ? {
            currency: (order as any).currency || 'CAD',
            amount: (order as any).total / 100, // Convert cents to dollars
          } : undefined,
          shipping_paid: (order as any).shippingCost ? {
            currency: (order as any).currency || 'CAD',
            amount: (order as any).shippingCost / 100, // Convert cents to dollars
          } : undefined,
          notes_from_buyer: (order as any).customerNotes,
        },
      ],
    }

    console.warn(`🔥 [createShipmentForOrder] Prepared Request for Order ${orderId}:`, JSON.stringify(shipmentRequest, null, 2))

    // Create shipment in ShipStation
    payload.logger.info(`Creating shipment for order ${orderId}`)
    try {
      const shipmentResponse = await client.createShipment(shipmentRequest)

      if (!shipmentResponse.shipments || shipmentResponse.shipments.length === 0) {
        throw new Error('ShipStation returned no shipments')
      }

      const createdShipment = shipmentResponse.shipments[0]

      // Check for errors in response
      if (createdShipment.errors && createdShipment.errors.length > 0) {
        const errorMessages = createdShipment.errors.map((e: any) => e.message).join(', ')
        throw new Error(`ShipStation errors: ${errorMessages}`)
      }

      console.warn(`✅ [createShipmentForOrder] ShipStation API success! Shipment ID: ${createdShipment.shipment_id}`)
      payload.logger.info(`Shipment created successfully: ${createdShipment.shipment_id}`)

      // Return shipment data - let the hook update the doc directly
      return {
        success: true,
        shipmentId: createdShipment.shipment_id,
      }
    } catch (apiError) {
      payload.logger.error(`ShipStation API Error: ${(apiError as Error).message}`)
      if ((apiError as any).details) {
        payload.logger.error(`ShipStation API Error Details: ${JSON.stringify((apiError as any).details)}`)
      }
      throw apiError
    }
  } catch (error) {
    payload.logger.error(`Shipment creation failed: ${(error as Error).message}`)
    
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}
