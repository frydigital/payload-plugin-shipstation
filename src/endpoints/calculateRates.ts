import type { Endpoint } from 'payload'
import { GetRatesParams } from '../api/shipstation'
import { ShipStationV1Address, ShipStationV1Dimensions, ShipStationV1Weight } from '../types'

const normalizeWeightUnit = (unit: string): string => {
  const map: Record<string, string> = {
    kg: 'kilogram',
    g: 'gram',
    lb: 'pound',
    oz: 'ounce',
  }
  return map[unit] || unit
}

interface BodyParams {
  address: ShipStationV1Address
  weight: ShipStationV1Weight
  dimensions: ShipStationV1Dimensions
  value: number
}

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  const startTime = Date.now()

  try {
    const client = (req.payload as any).shipStationClient
    const body = (req.json ? await req.json() : req.body) as BodyParams

    if (!body.address || !body.address.postalCode || !body.address.country) {
      return Response.json(
        {
          error: 'Invalid request: toAddress address with postalCode and country is required',
        },
        { status: 400 },
      )
    }

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
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 200
    const isFreeShipping = freeShippingThreshold > 0 && body.value >= freeShippingThreshold

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

    const defaultDims = shippingSettings?.defaultPackage?.dimensions
    const effectiveDimensions =
      body.dimensions ||
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

    // Validate required address fields for V1
    if (!body.address.postalCode || !body.address.country) {
      return Response.json(
        {
          error: 'Destination postalCode and country are required for shipping rate calculation.',
        },
        { status: 400 },
      )
    }
    // toState and toCity are optional for V1; omit validation per instruction

    // Build ship from address for V1 API (minimal - just postal code needed for rates)
    const shipFromAddress = {
      addressLine1: '',
      city: '',
      state: '',
      postalCode: shippingSettings?.defaultOriginPostalCode || '',
      country: 'CA', // Default to same country as toAddress
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
    const weightUnit = body.weight?.units || defaultWeight?.unit || 'grams'
    const normalizedUnit = normalizeWeightUnit(weightUnit)
    const weightValue = body.weight?.value || defaultWeight?.value || 1

    const getRatesParams = {
      shipTo: {
        addressLine1: body.address.street1 || '',
        addressLine2: body.address.street2 || '',
        city: body.address.city || '',
        state: body.address.state || '',
        postalCode: body.address.postalCode,
        country: body.address.country,
      },
      shipFrom: shipFromAddress,
      weight: {
        value: weightValue,
        unit: normalizedUnit,
      },
      dimensions: effectiveDimensions,
      carrierCodes, // V1 API uses carrierCodes
      //requiresSignature: items.some((item) => item.requiresSignature),
      //residential: toAddress.addressResidentialIndicator,
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
