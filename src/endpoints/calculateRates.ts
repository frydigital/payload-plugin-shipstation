import type { Endpoint } from 'payload'

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  const startTime = Date.now()
  try {
    console.log('📦 [ShipStation] Calculate rates request received')
    req.payload.logger.info('📦 [ShipStation] Calculate rates request received')
    const body = req.json ? await req.json() : req.body
    let { items, shipTo, cartTotal, cartId, toAddress } = body as any

    // Support cart-based requests
    if (cartId && toAddress) {
      console.log(`📦 [ShipStation] Fetching cart ${cartId}...`)
      req.payload.logger.info(`📦 [ShipStation] Fetching cart ${cartId}...`)
      const cartFetchStart = Date.now()
      try {
        const cart = await req.payload.findByID({
          collection: 'carts',
          id: cartId,
          depth: 2,
        })
        console.log(`📦 [ShipStation] Cart fetched in ${Date.now() - cartFetchStart}ms`)
        req.payload.logger.info(`📦 [ShipStation] Cart fetched in ${Date.now() - cartFetchStart}ms`)

        if (!cart || !cart.items || cart.items.length === 0) {
          return Response.json({
            error: 'Cart not found or empty',
          }, { status: 404 })
        }

        // Transform cart items to rate calculation format
        console.log(`📦 [ShipStation] Processing ${cart.items.length} cart items...`)
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
          country: toAddress.country, // Required field - no default
        }
        console.log(`📦 [ShipStation] Cart total: $${cartTotal}, Ship to: ${shipTo.postalCode}`)
        req.payload.logger.info(`📦 [ShipStation] Cart total: $${cartTotal}, Ship to: ${shipTo.postalCode}`)
      } catch (error) {
        console.log(`❌ [ShipStation] Failed to fetch cart: ${error}`)
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

    console.log('📦 [ShipStation] Fetching shipping settings...')
    req.payload.logger.info('📦 [ShipStation] Fetching shipping settings...')
    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })
    console.log('📦 [ShipStation] Shipping settings fetched')

    // Check if cart qualifies for free shipping
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const isFreeShipping = freeShippingThreshold > 0 && cartTotal >= freeShippingThreshold

    if (isFreeShipping) {
      console.log(`✅ [ShipStation] Free shipping qualified! Total: $${cartTotal} >= $${freeShippingThreshold}`)
      req.payload.logger.info(`✅ [ShipStation] Free shipping qualified! Total: $${cartTotal} >= $${freeShippingThreshold}`)
      const elapsed = Date.now() - startTime
      req.payload.logger.info(`📦 [ShipStation] Request completed in ${elapsed}ms`)
      return Response.json({
        rates: [{
          serviceName: 'Free Shipping',
          serviceCode: 'FREE',
          carrierCode: 'FREE',
          shipmentCost: 0,
          otherCost: 0,
        }],
        freeShipping: true,
      })
    }

    console.log('📦 [ShipStation] Calling ShipStation API for rates...')
    req.payload.logger.info('📦 [ShipStation] Calling ShipStation API for rates...')
    
    // Get carrier IDs from settings (REQUIRED by v2 API)
    const preferredCarriers = shippingSettings?.preferredCarriers || []
    const carrierIds = preferredCarriers
      .filter((c: any) => c.enabled !== false)
      .map((c: any) => c.carrierId)
      .filter(Boolean)
    
    console.log('📦 [ShipStation] Carrier IDs from settings:', carrierIds)
    
    if (!carrierIds || carrierIds.length === 0) {
      console.warn('⚠️ [ShipStation] No carrier IDs configured in shipping settings - cannot fetch rates')
      req.payload.logger.warn('⚠️ [ShipStation] No carrier IDs configured in shipping settings')
      return Response.json({
        rates: [],
        freeShipping: false,
        error: 'No carriers configured. Please add carrier IDs in shipping settings.',
      })
    }
    
    // Calculate total weight from all items
    const totalWeight = items.reduce((sum: number, item: any) => {
      const weight = item.weight?.value || 1
      return sum + weight
    }, 0)
    
    // Use largest dimensions from items (ShipStation will calculate based on package size)
    const largestDimensions = items.reduce((largest: any, item: any) => {
      if (!item.dimensions) return largest
      if (!largest) return item.dimensions
      const itemVolume = item.dimensions.length * item.dimensions.width * item.dimensions.height
      const largestVolume = largest.length * largest.width * largest.height
      return itemVolume > largestVolume ? item.dimensions : largest
    }, null)
    
    const getRatesParams = {
      shipTo,
      // shipFrom not needed - client will use warehouse_id internally
      weight: { value: totalWeight, unit: items[0]?.weight?.unit || 'kilogram' }, // Default to kilogram if not specified
      dimensions: largestDimensions,
      carrierIds, // REQUIRED by v2 API
      requiresSignature: items.some((item: any) => item.requiresSignature),
      residential: shipTo.addressResidentialIndicator === 'yes' ? true : shipTo.addressResidentialIndicator === 'no' ? false : undefined, // Pass undefined to default to 'unknown'
    }
    console.log('🔍 [ShipStation] getRates params:', JSON.stringify(getRatesParams, null, 2))
    console.log('🔍 [ShipStation] Client type:', typeof client, client.constructor.name)
    console.log('🔍 [ShipStation] getRates function:', typeof client.getRates)
    
    const apiStart = Date.now()
    const rates = await client.getRates(getRatesParams)
    const apiElapsed = Date.now() - apiStart
    
    console.log(`📦 [ShipStation] API responded in ${apiElapsed}ms with ${rates.length} rates`)
    console.log('📦 [ShipStation] Rates received:', JSON.stringify(rates, null, 2))
    req.payload.logger.info(`📦 [ShipStation] API responded in ${apiElapsed}ms with ${rates.length} rates`)

    const elapsed = Date.now() - startTime
    console.log(`✅ [ShipStation] Request completed in ${elapsed}ms`)
    req.payload.logger.info(`✅ [ShipStation] Request completed in ${elapsed}ms`)
    return Response.json({
      rates,
      freeShipping: false,
    })
  } catch (err) {
    const error = err as Error
    const elapsed = Date.now() - startTime
    console.log(`❌ [ShipStation] Rate calculation error after ${elapsed}ms: ${error.message}`)
    console.log(`❌ [ShipStation] Error stack: ${error.stack}`)
    req.payload.logger.error(`❌ [ShipStation] Rate calculation error after ${elapsed}ms: ${error.message}`)
    return Response.json({
      error: error.message || 'Failed to calculate rates',
    }, { status: 500 })
  }
}
