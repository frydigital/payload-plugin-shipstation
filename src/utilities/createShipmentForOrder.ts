import { format } from 'date-fns';
import type { Payload } from 'payload';
import type { 
  OrderForShipment, 
  OrderLineItem, 
  ShipStationCreateOrderRequest, 
  ShipStationCreateOrderResponse, 
  ShipStationPluginOptions,
  ShipStationV1OrderItem,
  ShipStationV1Weight,
} from '../types';

// Minimal client shape used here - V1 API uses createOrder
interface ShipStationClient {
  createOrder: (request: ShipStationCreateOrderRequest) => Promise<ShipStationCreateOrderResponse>
}

/**
 * Convert weight to V1 format (pounds as default, with grams as option)
 */
function convertToV1Weight(weight: { value: number; unit: string }): ShipStationV1Weight {
  const unit = weight.unit.toLowerCase()
  switch (unit) {
    case 'kilogram':
    case 'kg':
      // Convert kg to grams
      return { value: weight.value * 1000, units: 'grams' }
    case 'gram':
    case 'g':
      return { value: weight.value, units: 'grams' }
    case 'pound':
    case 'lb':
      return { value: weight.value, units: 'pounds' }
    case 'ounce':
    case 'oz':
      return { value: weight.value, units: 'ounces' }
    default:
      return { value: weight.value, units: 'pounds' }
  }
}

/**
 * Calculate total weight in pounds for the V1 API
 */
function calculateTotalWeightPounds(items: OrderLineItem[]): number {
  return items.reduce((sum, item) => {
    const product = typeof item.product === 'object' ? item.product : undefined
    const variant = typeof item.variant === 'object' ? item.variant : undefined
    
    // Extract weight from item, variant, or product
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
    
    // Convert all to pounds
    switch (unit) {
      case 'kilogram':
      case 'kg':
        return sum + v * 2.20462 // kg to lb
      case 'gram':
      case 'g':
        return sum + v * 0.00220462 // g to lb
      case 'pound':
      case 'lb':
        return sum + v
      case 'ounce':
      case 'oz':
        return sum + v / 16 // oz to lb
      default:
        return sum
    }
  }, 0)
}

/**
 * Helper function to create an order in ShipStation for a Payload order
 * Uses V1 API (POST /orders/createorder)
 * 
 * V1 API workflow:
 * 1. Create order with customer/shipping details
 * 2. Orders appear in ShipStation for fulfillment
 * 3. Labels are created from orders (separately or via ShipStation UI)
 */
export async function createShipmentForOrder(
  payload: Payload,
  orderId: string,
  client: ShipStationClient,
  pluginOptions: ShipStationPluginOptions,
  orderDoc?: OrderForShipment,
): Promise<{ success: boolean; shipmentId?: string; orderId?: number; error?: string }> {
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

    // Convert items to V1 format
    const items: ShipStationV1OrderItem[] = (order.items || []).map((item: OrderLineItem) => {
      const product = typeof item.product === 'object' ? item.product : undefined
      const variant = typeof item.variant === 'object' ? item.variant : undefined
      
      // Extract weight from item, variant shippingDetails, or product shippingDetails
      let weight: ShipStationV1Weight | undefined
      if (item.weight?.value && item.weight.unit) {
        weight = convertToV1Weight({ value: item.weight.value, unit: item.weight.unit })
      } else if ((variant as any)?.shippingDetails?.weight?.value && (variant as any)?.shippingDetails?.weight?.unit) {
        weight = convertToV1Weight((variant as any).shippingDetails.weight)
      } else if ((product as any)?.shippingDetails?.weight?.value && (product as any)?.shippingDetails?.weight?.unit) {
        weight = convertToV1Weight((product as any).shippingDetails.weight)
      }
      
      // Unit price in dollars (V1 API expects dollars, not cents)
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice / 100 : undefined
      
      return {
        lineItemKey: item.product && typeof item.product === 'object' ? item.product.id : undefined,
        sku: variant?.sku || product?.sku,
        name: variant?.title || product?.title || 'Unknown Product',
        quantity: item.quantity || 1,
        unitPrice,
        weight,
      }
    })

    // Calculate total weight in pounds for the order level
    const totalWeightPounds = calculateTotalWeightPounds(order.items || [])
    const orderWeight: ShipStationV1Weight | undefined = totalWeightPounds > 0 
      ? { value: parseFloat(totalWeightPounds.toFixed(2)), units: 'pounds' }
      : undefined

    // Build V1 order request
    // https://www.shipstation.com/docs/api/orders/create-update-order/
    const orderRequest: ShipStationCreateOrderRequest = {
      orderNumber: orderId,
      orderKey: orderId, // Use orderId as orderKey for idempotency
      orderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      orderStatus: 'awaiting_shipment',
      shipTo: {
        name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() || 'Customer',
        company: shippingAddress.company,
        street1: shippingAddress.addressLine1,
        street2: shippingAddress.addressLine2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
        phone: shippingAddress.phone,
        residential: true,
      },
      items,
      // Amount paid in dollars (V1 API expects dollars, not cents)
      amountPaid: order.total ? order.total / 100 : order.amount ? order.amount / 100 : undefined,
      // Tax amount in dollars
      taxAmount: 0,
      // Shipping amount in dollars
      shippingAmount: order.shippingCost 
        ? order.shippingCost / 100 
        : order.selectedRate?.cost 
          ? order.selectedRate.cost / 100 
          : undefined,
      customerNotes: order.customerNotes,
      // Carrier and service from selected rate
      carrierCode: order.selectedRate?.carrierCode,
      serviceCode: order.selectedRate?.serviceCode,
      // Total weight at order level
      weight: orderWeight,
      // Advanced options with warehouse ID
      advancedOptions: {
        warehouseId: parseInt(warehouseId, 10) || undefined,
      },
    }

    if (!order.selectedRate?.serviceCode) {
      console.warn('[ShipStation V1 Debug] WARNING: selectedRate.serviceCode missing; serviceCode will be absent')
    }
    if (!orderRequest.shippingAmount) {
      console.warn('[ShipStation V1 Debug] WARNING: shippingAmount unresolved (no shippingCost or selectedRate.cost)')
    } else {
      console.warn('[ShipStation V1 Debug] shippingAmount resolved:', orderRequest.shippingAmount)
    }
    console.warn('[ShipStation V1 Debug] amountPaid resolved:', orderRequest.amountPaid)
    console.warn(`🔥 [createShipmentForOrder V1] Prepared Request for Order ${orderId}:`, JSON.stringify(orderRequest, null, 2))

    payload.logger.info(`Creating order in ShipStation for ${orderId}`)
    const orderResponse = await client.createOrder(orderRequest)
    
    if (!orderResponse || !orderResponse.orderId) {
      throw new Error('ShipStation returned no order')
    }
    
    // Update local order with ShipStation details
    const shippingCost = order.shippingCost ?? order.selectedRate?.cost ?? (order.total && order.amount && order.total > order.amount ? order.total - order.amount : undefined)
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        shippingDetails: {
          // V1 API returns orderId (number) not shipmentId (string)
          shipmentId: String(orderResponse.orderId),
          shippingStatus: 'processing',
          shippingCost,
          carrierCode: order.selectedRate?.carrierCode,
          serviceCode: order.selectedRate?.serviceCode,
        },
      },
    })
    payload.logger.info(`Order created successfully in ShipStation: ${orderResponse.orderId}`)
    
    return { success: true, shipmentId: String(orderResponse.orderId), orderId: orderResponse.orderId }
  } catch (error) {
    payload.logger.error(`Order creation failed: ${(error as Error).message}`)
    return { success: false, error: (error as Error).message }
  }
}
