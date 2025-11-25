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
    let order
    if (orderDoc) {
      order = orderDoc
    } else {
      order = await payload.findByID({
        collection: 'orders',
        id: orderId,
      })
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

    // ShipStation v2 item unit_price is optional; pricing is driven by amount_paid / shipping_paid.
    // Order line items do not contain a stored unit price field, so we omit unit_price to avoid inaccurate data.
    const items = (order.items || []).map((item: any) => {
      const product = item.product
      const variant = item.variant
      return {
        name: variant?.title || product?.title || 'Unknown Product',
        sku: variant?.sku || product?.sku || undefined,
        quantity: item.quantity || 1,
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
          // Include carrier_id and service_code from selected rate (log if missing)
          ...( (order as any).selectedRate?.carrierId ? { carrier_id: (order as any).selectedRate?.carrierId } : {} ),
          ...( (order as any).selectedRate?.serviceCode ? { service_code: (order as any).selectedRate?.serviceCode } : {} ),
          ...(!(order as any).selectedRate?.serviceCode ? { } : {}),
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
          // amount_paid should reflect total paid (subtotal + shipping). If total missing, fallback to amount (subtotal without shipping).
          amount_paid: (order as any).total ? {
            currency: (order as any).currency || 'CAD',
            amount: (order as any).total / 100,
          } : (order as any).amount ? {
            currency: (order as any).currency || 'CAD',
            amount: (order as any).amount / 100,
          } : undefined,
          // shipping_paid reflects shipping cost only; fallback cascade: shippingCost -> selectedRate.cost -> derived (total - amount)
          shipping_paid: (order as any).shippingCost ? {
            currency: (order as any).currency || 'CAD',
            amount: (order as any).shippingCost / 100,
          } : (order as any).selectedRate?.cost ? {
            currency: (order as any).selectedRate?.currency || (order as any).currency || 'CAD',
            amount: (order as any).selectedRate.cost / 100,
          } : (order as any).total && (order as any).amount && (order as any).total > (order as any).amount ? {
            currency: (order as any).currency || 'CAD',
            amount: ((order as any).total - (order as any).amount) / 100,
          } : undefined,
          notes_from_buyer: (order as any).customerNotes,
        },
      ],
    }
    if (!(order as any).selectedRate?.serviceCode) {
      console.warn('[ShipStation Debug] WARNING: selectedRate.serviceCode missing; service_code will be absent')
    }
    if (!shipmentRequest.shipments[0].shipping_paid) {
      console.warn('[ShipStation Debug] WARNING: shipping_paid unresolved (no shippingCost, selectedRate.cost, or derivable difference)')
    } else {
      console.warn('[ShipStation Debug] shipping_paid resolved:', shipmentRequest.shipments[0].shipping_paid)
    }
    console.warn('[ShipStation Debug] amount_paid resolved:', shipmentRequest.shipments[0].amount_paid)
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
