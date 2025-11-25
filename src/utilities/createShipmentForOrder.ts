import type { Payload } from 'payload';
import type { OrderForShipment, OrderLineItem, ShipStationCreateShipmentRequest, ShipStationCreateShipmentResponse, ShipStationPluginOptions } from '../types';

// Minimal client shape used here
interface ShipStationClient {
  createShipment: (request: ShipStationCreateShipmentRequest) => Promise<ShipStationCreateShipmentResponse>
}

/**
 * Helper function to create a shipment for an order
 * Used by both the endpoint and the afterChange hook
 */
export async function createShipmentForOrder(
  payload: Payload,
  orderId: string,
  client: ShipStationClient,
  pluginOptions: ShipStationPluginOptions,
  orderDoc?: OrderForShipment,
): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
  try {
    // Resolve order document
    const order: OrderForShipment = orderDoc
      ? orderDoc
      : (await payload.findByID({ collection: 'orders', id: orderId })) as unknown as OrderForShipment

    if (!order) throw new Error('Order not found')
    if (order.shippingMethod !== 'shipping') throw new Error('Order is not flagged for shipping')

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

    const warehouseId = process.env.SHIPSTATION_WAREHOUSE_ID || pluginOptions.warehouseId
    if (!warehouseId) throw new Error('Warehouse ID not configured (set SHIPSTATION_WAREHOUSE_ID)')

    const items = (order.items || []).map((item: OrderLineItem) => {
      const product = typeof item.product === 'object' ? item.product : undefined
      const variant = typeof item.variant === 'object' ? item.variant : undefined
      const unitPrice = typeof item.unitPrice === 'number' ? { currency: item.currency || order.currency || 'CAD', amount: item.unitPrice / 100 } : undefined
      
      // Extract weight from item, variant shippingDetails, or product shippingDetails
      let weight: { value: number; unit: 'kilogram' | 'gram' | 'pound' | 'ounce' } | undefined
      if (item.weight?.value && item.weight.unit) {
        weight = { value: item.weight.value, unit: item.weight.unit as 'kilogram' | 'gram' | 'pound' | 'ounce' }
      } else if ((variant as any)?.shippingDetails?.weight?.value && (variant as any)?.shippingDetails?.weight?.unit) {
        weight = { value: (variant as any).shippingDetails.weight.value, unit: (variant as any).shippingDetails.weight.unit }
      } else if ((product as any)?.shippingDetails?.weight?.value && (product as any)?.shippingDetails?.weight?.unit) {
        weight = { value: (product as any).shippingDetails.weight.value, unit: (product as any).shippingDetails.weight.unit }
      }
      
      return {
        name: variant?.title || product?.title || 'Unknown Product',
        sku: variant?.sku || product?.sku || undefined,
        quantity: item.quantity || 1,
        unit_price: unitPrice,
        weight,
      }
    })

    // Weight aggregation across items -> kilograms
    const totalWeightKg = (order.items || []).reduce((sum, item) => {
      const product = typeof item.product === 'object' ? item.product : undefined
      const variant = typeof item.variant === 'object' ? item.variant : undefined
      
      // Extract weight from item, variant, or product (same cascade as above)
      let w: { value: number; unit: string } | undefined
      if (item.weight?.value && item.weight.unit) {
        w = { value: item.weight.value, unit: item.weight.unit }
      } else if ((variant as any)?.shippingDetails?.weight?.value && (variant as any)?.shippingDetails?.weight?.unit) {
        w = (variant as any).shippingDetails.weight
      } else if ((product as any)?.shippingDetails?.weight?.value && (product as any)?.shippingDetails?.weight?.unit) {
        w = (product as any).shippingDetails.weight
      }
      
      if (!w?.value || !w.unit) return sum
      
      const quantity = item.quantity || 1
      const v = w.value * quantity
      const unit = w.unit.toLowerCase()
      
      switch (unit) {
        case 'kilogram':
        case 'kg':
          return sum + v
        case 'gram':
        case 'g':
          return sum + v / 1000
        case 'pound':
        case 'lb':
          return sum + v * 0.45359237
        case 'ounce':
        case 'oz':
          return sum + v * 0.0283495231
        default:
          return sum
      }
    }, 0)

    const shipmentRequest: ShipStationCreateShipmentRequest = {
      shipments: [
        {
          validate_address: 'validate_and_clean',
          external_shipment_id: orderId,
          shipment_status: 'pending',
          warehouse_id: warehouseId,
          ...(order.selectedRate?.carrierId ? { carrier_id: order.selectedRate.carrierId } : {}),
          ...(order.selectedRate?.serviceCode ? { service_code: order.selectedRate.serviceCode } : {}),
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
          packages: totalWeightKg > 0 ? [
            {
              weight: { value: parseFloat(totalWeightKg.toFixed(3)), unit: 'kilogram' },
            },
          ] : undefined,
          amount_paid: order.total ? { currency: order.currency || 'CAD', amount: order.total / 100 } : order.amount ? { currency: order.currency || 'CAD', amount: order.amount / 100 } : undefined,
          shipping_paid: order.shippingCost ? { currency: order.currency || 'CAD', amount: order.shippingCost / 100 } : order.selectedRate?.cost ? { currency: order.selectedRate?.currency || order.currency || 'CAD', amount: order.selectedRate.cost / 100 } : (order.total && order.amount && order.total > order.amount) ? { currency: order.currency || 'CAD', amount: (order.total - order.amount) / 100 } : undefined,
          notes_from_buyer: order.customerNotes,
        },
      ],
    }

    if (!order.selectedRate?.serviceCode) {
      console.warn('[ShipStation Debug] WARNING: selectedRate.serviceCode missing; service_code will be absent')
    }
    if (!shipmentRequest.shipments[0].shipping_paid) {
      console.warn('[ShipStation Debug] WARNING: shipping_paid unresolved (no shippingCost, selectedRate.cost, or derivable difference)')
    } else {
      console.warn('[ShipStation Debug] shipping_paid resolved:', shipmentRequest.shipments[0].shipping_paid)
    }
    console.warn('[ShipStation Debug] amount_paid resolved:', shipmentRequest.shipments[0].amount_paid)
    console.warn(`🔥 [createShipmentForOrder] Prepared Request for Order ${orderId}:`, JSON.stringify(shipmentRequest, null, 2))

    payload.logger.info(`Creating shipment for order ${orderId}`)
    const shipmentResponse = await client.createShipment(shipmentRequest)
    if (!shipmentResponse.shipments || shipmentResponse.shipments.length === 0) {
      throw new Error('ShipStation returned no shipments')
    }
    const createdShipment = shipmentResponse.shipments[0]
    if (createdShipment.errors && createdShipment.errors.length > 0) {
      const errorMessages = createdShipment.errors.map((e) => e.message).join(', ')
      throw new Error(`ShipStation errors: ${errorMessages}`)
    }
    
    // Update order with shipment details
    const shippingCost = order.shippingCost ?? order.selectedRate?.cost ?? (order.total && order.amount && order.total > order.amount ? order.total - order.amount : undefined)
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        shippingDetails: {
          shipmentId: createdShipment.shipment_id,
          shipstationShipmentId: createdShipment.shipment_id,
          shippingStatus: 'processing',
          shippingCost,
          carrierCode: order.selectedRate?.carrierCode,
          serviceCode: order.selectedRate?.serviceCode,
        },
      },
    })
    payload.logger.info(`Shipment created successfully: ${createdShipment.shipment_id}`)
    
    return { success: true, shipmentId: createdShipment.shipment_id }
  } catch (error) {
    payload.logger.error(`Shipment creation failed: ${(error as Error).message}`)
    return { success: false, error: (error as Error).message }
  }
}
