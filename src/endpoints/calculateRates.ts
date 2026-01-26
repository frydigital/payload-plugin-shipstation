import type { Endpoint } from 'payload'
import { GetRatesParams } from '../api/shipstation'
import type { LightspeedCart, LightspeedCartItem } from '../types/lightspeed'

const normalizeWeightUnit = (unit: string): string => {
  const map: Record<string, string> = {
    kg: 'kilogram',
    g: 'gram',
    lb: 'pound',
    oz: 'ounce',
  }
  return map[unit] || unit
}

interface ShipAddress {
  line1: string
  line2?: string
  city?: string
  province?: string
  postalCode: string
  country: string
  addressResidentialIndicator?: boolean
}

interface ShipItem {
  weight: { value: number; unit: string }
  dimensions: ItemDimensions
  quantity: number
  requiresSignature: boolean
}

interface ItemDimensions {
  length: number
  width: number
  height: number
}

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  const startTime = Date.now()

  try {
    const body = (req.json ? await req.json() : req.body) as any
    const cart = body.cart as LightspeedCart
    const toAddress = body.toAddress as ShipAddress

    let cartTotal = 0 as number
    let items = null as ShipItem[] | null

    // Support cart-based requests
    if (cart.items && toAddress) {
      req.payload.logger.info('[ShipStation V1] Cart Items and Address received')
      console.log('[ShipStation V1] Cart Items and Address received', cart.items)

      if (!cart.items || cart.items.length === 0) {
        return Response.json(
          {
            error: 'Cart not found or empty',
          },
          { status: 404 },
        )
      }

      // Transform cart items to rate calculation format
      // Future addition of Lightspeed Ship Details
      items = cart.items.map((item: LightspeedCartItem) => {
        let weight = { value: 1, unit: 'kilogram' }
        if (weight && weight.unit) {
          weight = { ...weight, unit: normalizeWeightUnit(weight.unit) }
        }

        const fallbackDimensions = {
          length: 10,
          width: 10,
          height: 10,
        } as ItemDimensions

        return {
          weight,
          dimensions: fallbackDimensions,
          quantity: item.quantity || 1,
          requiresSignature: false,
        }
      })

      cartTotal = cart.subtotal || 0
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        {
          error: 'Invalid request: items array is required',
        },
        { status: 400 },
      )
    }

    if (!toAddress || !toAddress.postalCode || !toAddress.country) {
      return Response.json(
        {
          error: 'Invalid request: toAddress address with postalCode and country is required',
        },
        { status: 400 },
      )
    }

    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json(
        {
          error: 'ShipStation client not initialized',
        },
        { status: 500 },
      )
    }

    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    // Check if cart qualifies for free shipping
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const isFreeShipping = freeShippingThreshold > 0 && cartTotal >= freeShippingThreshold

    if (isFreeShipping) {
      return Response.json({
        rates: [
          {
            serviceName: 'Free Shipping',
            serviceCode: 'FREE',
            carrierCode: 'FREE',
            shipmentCost: 0,
            otherCost: 0,
          },
        ],
        freeShipping: true,
      })
    }

    // Get carrier codes from settings (V1 API uses carrierCode, not carrierId)
    const preferredCarriers = shippingSettings?.preferredCarriers || []
    // Support both carrierCode (V1) and carrierId (legacy V2) for backward compatibility
    // TODO: Remove carrierId fallback in next major version when V2 support is dropped
    const carrierCodes = preferredCarriers
      .filter((c: any) => c.enabled !== false)
      .map((c: any) => c.carrierCode || c.carrierId)
      .filter(Boolean)

    if (!carrierCodes || carrierCodes.length === 0) {
      return Response.json({
        rates: [],
        freeShipping: false,
        error: 'No carriers configured. Please add carrier codes in shipping settings.',
      })
    }

    // Calculate total weight from all items
    const totalWeight = items.reduce((sum: number, item: ShipItem) => {
      const weight = item.weight?.value || 1
      const quantity = item.quantity || 1
      return sum + weight * quantity
    }, 0)

    // Use largest dimensions from items (fallback to settings default)
    const largestDimensions =
      items.length > 0
        ? items.reduce((largest: ItemDimensions, item: ShipItem) => {
            if (!item.dimensions) return largest
            const itemVolume =
              item.dimensions.length * item.dimensions.width * item.dimensions.height
            const largestVolume = largest.length * largest.width * largest.height
            return itemVolume > largestVolume ? item.dimensions : largest
          }, items[0].dimensions)
        : undefined

    const defaultDims = shippingSettings?.defaultPackage?.dimensions
    const effectiveDimensions =
      largestDimensions ||
      (defaultDims
        ? {
            length: defaultDims.length,
            width: defaultDims.width,
            height: defaultDims.height,
            unit: defaultDims.unit,
          }
        : undefined)

    // Get ship from address from settings if available
    //const shipFromPostalCode = shippingSettings?.defaultOriginPostalCode || ''

    // Build ship to address for V1 API
    const toAddressAddress = {
      addressLine1: toAddress.line1 || toAddress.line2 || '',
      city: toAddress.city || '',
      state: toAddress.province || '',
      postalCode: toAddress.postalCode || '',
      country: toAddress.country || 'CA',
    }

    // Validate required address fields for V1
    if (!toAddressAddress.postalCode || !toAddressAddress.country) {
      return Response.json(
        {
          error: 'Destination postalCode and country are required for shipping rate calculation.',
        },
        { status: 400 },
      )
    }
    // toState and toCity are optional for V1; omit validation per instruction

    // Build ship from address for V1 API (minimal - just postal code needed for rates)
    const originPostal = shippingSettings?.defaultOriginPostalCode
    const shipFromAddress = {
      addressLine1: '',
      city: '',
      state: '',
      postalCode: originPostal || '',
      country: toAddress.country || 'CA', // Default to same country as toAddress
    }

    if (!shipFromAddress.postalCode) {
      return Response.json(
        {
          error:
            'Origin postal code is not configured. Please set Default Origin Postal Code in Shipping Settings.',
        },
        { status: 400 },
      )
    }

    // Ensure weight present and valid
    const defaultWeight = shippingSettings?.defaultPackage?.weight
    const firstUnit = items[0]?.weight?.unit || defaultWeight?.unit || 'kilogram'
    const normalizedUnit = normalizeWeightUnit(firstUnit)
    const weightValue = totalWeight > 0 ? totalWeight : defaultWeight?.value || 1

    const getRatesParams = {
      shipTo: toAddressAddress,
      shipFrom: shipFromAddress,
      weight: { value: weightValue, unit: normalizedUnit },
      dimensions: effectiveDimensions,
      carrierCodes, // V1 API uses carrierCodes
      requiresSignature: items.some((item) => item.requiresSignature),
      residential: toAddress.addressResidentialIndicator,
    } as GetRatesParams

    const rates = await client.getRates(getRatesParams)

    return Response.json({
      rates,
      freeShipping: false,
    })
  } catch (err) {
    const elapsed = Date.now() - startTime
    const error = err as any
    console.log(`[ShipStation V1] Rate calculation error after ${elapsed}ms: ${error?.message}`)
    console.log(`[ShipStation V1] Error stack: ${error?.stack}`)

    // Surface ShipStation V1 error details if present (PascalCase fields)
    const details = error?.details || undefined
    const shipstationMessage = details?.ExceptionMessage || details?.Message
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500

    return Response.json(
      {
        error: shipstationMessage || error?.message || 'Failed to calculate rates',
        details,
      },
      { status: statusCode },
    )
  }
}
