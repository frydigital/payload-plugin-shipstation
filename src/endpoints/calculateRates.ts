import type { Endpoint } from 'payload'

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  const startTime = Date.now()
  try {
    req.payload.logger.info('📦 [ShipStation] Calculate rates request received')
    const body = req.json ? await req.json() : req.body
    let { items, shipTo, cartTotal, cartId, toAddress } = body as any

    // Support cart-based requests
    if (cartId && toAddress) {
      req.payload.logger.info(`📦 [ShipStation] Fetching cart ${cartId}...`)
      const cartFetchStart = Date.now()
      try {
        const cart = await req.payload.findByID({
          collection: 'carts',
          id: cartId,
          depth: 2,
        })
        req.payload.logger.info(`📦 [ShipStation] Cart fetched in ${Date.now() - cartFetchStart}ms`)

        if (!cart || !cart.items || cart.items.length === 0) {
          return Response.json({
            error: 'Cart not found or empty',
          }, { status: 404 })
        }

        // Transform cart items to rate calculation format
        req.payload.logger.info(`📦 [ShipStation] Processing ${cart.items.length} cart items...`)
        items = cart.items.map((item: any) => {
          const product = typeof item.product === 'object' ? item.product : null
          const variant = typeof item.variant === 'object' ? item.variant : null
          
          return {
            weight: variant?.weight || product?.weight || { value: 1, unit: 'kg' },
            dimensions: variant?.dimensions || product?.dimensions,
            quantity: item.quantity || 1,
            requiresSignature: variant?.requiresSignature || product?.requiresSignature || false,
          }
        })

        cartTotal = cart.subtotal || 0
        shipTo = {
          line1: toAddress.line1,
          line2: toAddress.line2,
          city: toAddress.city,
          province: toAddress.province,
          postalCode: toAddress.postalCode,
          country: toAddress.country || 'CA',
        }
        req.payload.logger.info(`📦 [ShipStation] Cart total: $${cartTotal}, Ship to: ${shipTo.postalCode}`)
      } catch (error) {
        req.payload.logger.error(`❌ [ShipStation] Failed to fetch cart: ${error}`)
        return Response.json({
          error: 'Failed to fetch cart data',
        }, { status: 500 })
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({
        error: 'Invalid request: items array is required',
      }, { status: 400 })
    }

    if (!shipTo || !shipTo.postalCode || !shipTo.country) {
      return Response.json({
        error: 'Invalid request: shipTo address with postalCode and country is required',
      }, { status: 400 })
    }

    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    req.payload.logger.info('📦 [ShipStation] Fetching shipping settings...')
    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    // Check if cart qualifies for free shipping
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const isFreeShipping = freeShippingThreshold > 0 && cartTotal >= freeShippingThreshold

    if (isFreeShipping) {
      req.payload.logger.info(`✅ [ShipStation] Free shipping qualified! Total: $${cartTotal} >= $${freeShippingThreshold}`)
      const elapsed = Date.now() - startTime
      req.payload.logger.info(`📦 [ShipStation] Request completed in ${elapsed}ms`)
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

    req.payload.logger.info('📦 [ShipStation] Calling ShipStation API for rates...')
    const apiStart = Date.now()
    const rates = await client.getRates({
      shipTo,
      shipFrom: { postalCode: 'V6B 1A1', country: 'CA' },
      weight: items[0]?.weight || { value: 1, unit: 'kg' },
      dimensions: items[0]?.dimensions,
      requiresSignature: items.some((item: any) => item.requiresSignature),
      residential: true,
    })
    const apiElapsed = Date.now() - apiStart
    req.payload.logger.info(`📦 [ShipStation] API responded in ${apiElapsed}ms with ${rates.length} rates`)

    const elapsed = Date.now() - startTime
    req.payload.logger.info(`✅ [ShipStation] Request completed in ${elapsed}ms`)
    return Response.json({
      rates,
      freeShipping: false,
    })
  } catch (err) {
    const error = err as Error
    const elapsed = Date.now() - startTime
    req.payload.logger.error(`❌ [ShipStation] Rate calculation error after ${elapsed}ms: ${error.message}`)
    return Response.json({
      error: error.message || 'Failed to calculate rates',
    }, { status: 500 })
  }
}
