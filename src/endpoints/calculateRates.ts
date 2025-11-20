import type { Endpoint } from 'payload'

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  try {
    const body = req.json ? await req.json() : req.body
    const { items, shipTo, cartTotal } = body as any

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({
        error: 'Invalid request: items array is required',
      }, { status: 400 })
    }

    if (!shipTo || !shipTo.postalCode || !shipTo.province || !shipTo.country) {
      return Response.json({
        error: 'Invalid request: shipTo address is required',
      }, { status: 400 })
    }

    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    // Check if cart qualifies for free shipping
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const isFreeShipping = freeShippingThreshold > 0 && cartTotal >= freeShippingThreshold

    if (isFreeShipping) {
      return Response.json({
        rates: [{
          serviceName: 'Free Shipping',
          serviceCode: 'FREE',
          carrierCode: 'FREE',
          cost: 0,
          currency: 'CAD',
        }],
        freeShipping: true,
      })
    }

    const rates = await client.getRates({
      shipTo,
      shipFrom: { postalCode: 'V6B 1A1', country: 'CA' },
      weight: items[0]?.weight || { value: 1, unit: 'kg' },
      dimensions: items[0]?.dimensions,
      requiresSignature: items.some((item: any) => item.requiresSignature),
      residential: true,
    })

    return Response.json({
      rates,
      freeShipping: false,
    })
  } catch (err) {
    const error = err as Error
    req.payload.logger.error(`Rate calculation error: ${error.message}`)
    return Response.json({
      error: error.message || 'Failed to calculate rates',
    }, { status: 500 })
  }
}
