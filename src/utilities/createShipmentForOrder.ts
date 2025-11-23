import type { Payload } from 'payload'
import type { ShipStationCreateShipmentRequest } from '../types'

/**
 * Helper function to create a shipment for an order
 * Used by both the endpoint and the afterChange hook
 */
export async function createShipmentForOrder(
  payload: Payload,
  orderId: string,
  client: any,
  pluginOptions: any
): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
  try {
    // Fetch the order
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
    })

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
          currency: 'CAD',
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
          warehouse_id: warehouseId,
          shipment_status: 'pending',
          ship_to: {
            name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() || 'Customer',
            company_name: shippingAddress.company,
            address_line1: shippingAddress.addressLine1,
            address_line2: shippingAddress.addressLine2,
            address_line3: shippingAddress.addressLine3,
            city_locality: shippingAddress.city,
            state_province: shippingAddress.state,
            postal_code: shippingAddress.postalCode,
            country_code: shippingAddress.country,
            phone: shippingAddress.phone,
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
          amount_paid: order.total ? {
            currency: 'CAD',
            amount: order.total,
          } : undefined,
          shipping_paid: order.selectedRate?.cost ? {
            currency: 'CAD',
            amount: order.selectedRate.cost,
          } : undefined,
          notes_from_buyer: order.customerNotes,
        },
      ],
    }

    // Create shipment in ShipStation
    payload.logger.info(`Creating shipment for order ${orderId}`)
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

    // Update order with shipment information
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        shippingDetails: {
          ...order.shippingDetails,
          shipstationShipmentId: createdShipment.shipment_id,
          shippingStatus: 'processing',
        },
      },
    })

    payload.logger.info(`Shipment created successfully: ${createdShipment.shipment_id}`)

    return {
      success: true,
      shipmentId: createdShipment.shipment_id,
    }
  } catch (error) {
    payload.logger.error(`Shipment creation failed: ${(error as Error).message}`)
    
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}
