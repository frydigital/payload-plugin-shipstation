import type { Endpoint } from 'payload'

const normalizeWeightUnit = (unit: string): string => {
  const map: Record<string, string> = {
    'kg': 'kilogram',
    'g': 'gram',
    'lb': 'pound',
    'oz': 'ounce',
  }
  return map[unit] || unit
}

export const calculateRatesHandler: Endpoint['handler'] = async (req) => {
  const startTime = Date.now()
  try {
    console.log('📦 [ShipStation V1] Calculate rates request received')
    req.payload.logger.info('📦 [ShipStation V1] Calculate rates request received')
    const body = req.json ? await req.json() : req.body
    let { items, shipTo, cartTotal, cartId, toAddress } = body as any

    // Support cart-based requests
    if (cartId && toAddress) {
      console.log(`📦 [ShipStation V1] Fetching cart ${cartId}...`)
      req.payload.logger.info(`📦 [ShipStation V1] Fetching cart ${cartId}...`)
      const cartFetchStart = Date.now()
      try {
        const cart = await req.payload.findByID({
          collection: 'carts',
          id: cartId,
          depth: 2,
        })
        console.log(`📦 [ShipStation V1] Cart fetched in ${Date.now() - cartFetchStart}ms`)
        req.payload.logger.info(`📦 [ShipStation V1] Cart fetched in ${Date.now() - cartFetchStart}ms`)

        if (!cart || !cart.items || cart.items.length === 0) {
          return Response.json({
            error: 'Cart not found or empty',
          }, { status: 404 })
        }

        // Transform cart items to rate calculation format
        console.log(`📦 [ShipStation V1] Processing ${cart.items.length} cart items...`)
        req.payload.logger.info(`📦 [ShipStation V1] Processing ${cart.items.length} cart items...`)
        items = cart.items.map((item: any) => {
          const product = typeof item.product === 'object' ? item.product : null
          const variant = typeof item.variant === 'object' ? item.variant : null
          
          let weight = variant?.weight || product?.weight || { value: 1, unit: 'kilogram' }
          if (weight && weight.unit) {
            weight = { ...weight, unit: normalizeWeightUnit(weight.unit) }
          }

          return {
            weight,
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
        console.log(`📦 [ShipStation V1] Cart total: $${cartTotal}, Ship to: ${shipTo.postalCode}`)
        req.payload.logger.info(`📦 [ShipStation V1] Cart total: $${cartTotal}, Ship to: ${shipTo.postalCode}`)
      } catch (error) {
        console.log(`❌ [ShipStation V1] Failed to fetch cart: ${error}`)
        req.payload.logger.error(`❌ [ShipStation V1] Failed to fetch cart: ${error}`)
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

    console.log('📦 [ShipStation V1] Fetching shipping settings...')
    req.payload.logger.info('📦 [ShipStation V1] Fetching shipping settings...')
    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })
    console.log('📦 [ShipStation V1] Shipping settings fetched')

    // Check if cart qualifies for free shipping
    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const isFreeShipping = freeShippingThreshold > 0 && cartTotal >= freeShippingThreshold

    if (isFreeShipping) {
      console.log(`✅ [ShipStation V1] Free shipping qualified! Total: $${cartTotal} >= $${freeShippingThreshold}`)
      req.payload.logger.info(`✅ [ShipStation V1] Free shipping qualified! Total: $${cartTotal} >= $${freeShippingThreshold}`)
      const elapsed = Date.now() - startTime
      req.payload.logger.info(`📦 [ShipStation V1] Request completed in ${elapsed}ms`)
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

    console.log('📦 [ShipStation V1] Calling ShipStation API for rates...')
    req.payload.logger.info('📦 [ShipStation V1] Calling ShipStation API for rates...')
    
    // Get carrier codes from settings (V1 API uses carrierCode, not carrierId)
    const preferredCarriers = shippingSettings?.preferredCarriers || []
    // Support both carrierCode (V1) and carrierId (legacy V2) for backward compatibility
    // TODO: Remove carrierId fallback in next major version when V2 support is dropped
    const carrierCodes = preferredCarriers
      .filter((c: any) => c.enabled !== false)
      .map((c: any) => c.carrierCode || c.carrierId)
      .filter(Boolean)
    
    console.log('📦 [ShipStation V1] Carrier codes from settings:', carrierCodes)
    
    if (!carrierCodes || carrierCodes.length === 0) {
      console.warn('⚠️ [ShipStation V1] No carrier codes configured in shipping settings - cannot fetch rates')
      req.payload.logger.warn('⚠️ [ShipStation V1] No carrier codes configured in shipping settings')
      return Response.json({
        rates: [],
        freeShipping: false,
        error: 'No carriers configured. Please add carrier codes in shipping settings.',
      })
    }
    
    // Calculate total weight from all items
    const totalWeight = items.reduce((sum: number, item: any) => {
      const weight = item.weight?.value || 1
      const quantity = item.quantity || 1
      return sum + (weight * quantity)
    }, 0)
    
    // Use largest dimensions from items (fallback to settings default)
    const largestDimensions = items.reduce((largest: any, item: any) => {
      if (!item.dimensions) return largest
      if (!largest) return item.dimensions
      const itemVolume = item.dimensions.length * item.dimensions.width * item.dimensions.height
      const largestVolume = largest.length * largest.width * largest.height
      return itemVolume > largestVolume ? item.dimensions : largest
    }, null)

    const defaultDims = shippingSettings?.defaultPackage?.dimensions
    const effectiveDimensions = largestDimensions || (defaultDims ? {
      length: defaultDims.length,
      width: defaultDims.width,
      height: defaultDims.height,
      unit: defaultDims.unit,
    } : undefined)

    // Get ship from address from settings if available
    //const shipFromPostalCode = shippingSettings?.defaultOriginPostalCode || ''
    
    // Build ship to address for V1 API
    const shipToAddress = {
      addressLine1: shipTo.line1 || shipTo.addressLine1 || '',
      city: shipTo.city || '',
      state: shipTo.province || shipTo.state || '',
      postalCode: shipTo.postalCode || '',
      country: shipTo.country || '',
    }

    // Validate required address fields for V1
    if (!shipToAddress.postalCode || !shipToAddress.country) {
      return Response.json({
        error: 'Destination postalCode and country are required for shipping rate calculation.',
      }, { status: 400 })
    }
    // toState and toCity are optional for V1; omit validation per instruction

    // Build ship from address for V1 API (minimal - just postal code needed for rates)
    const originPostal = shippingSettings?.defaultOriginPostalCode
    const shipFromAddress = {
      addressLine1: '',
      city: '',
      state: '',
      postalCode: originPostal || '',
      country: shipTo.country || 'CA', // Default to same country as shipTo
    }

    if (!shipFromAddress.postalCode) {
      return Response.json({
        error: 'Origin postal code is not configured. Please set Default Origin Postal Code in Shipping Settings.',
      }, { status: 400 })
    }
    
    // Ensure weight present and valid
    const defaultWeight = shippingSettings?.defaultPackage?.weight
    const firstUnit = items[0]?.weight?.unit || defaultWeight?.unit || 'kilogram'
    const normalizedUnit = normalizeWeightUnit(firstUnit)
    const weightValue = totalWeight > 0 ? totalWeight : (defaultWeight?.value || 1)

    const getRatesParams = {
      shipTo: shipToAddress,
      shipFrom: shipFromAddress,
      weight: { value: weightValue, unit: normalizedUnit },
      dimensions: effectiveDimensions,
      carrierCodes, // V1 API uses carrierCodes
      requiresSignature: items.some((item: any) => item.requiresSignature),
      residential: shipTo.addressResidentialIndicator === 'yes' ? true : shipTo.addressResidentialIndicator === 'no' ? false : undefined,
    }
    console.log('🔍 [ShipStation V1] getRates params:', JSON.stringify(getRatesParams, null, 2))
    console.log('🔍 [ShipStation V1] Client type:', typeof client, client.constructor.name)
    console.log('🔍 [ShipStation V1] getRates function:', typeof client.getRates)
    
    const apiStart = Date.now()
    const rates = await client.getRates(getRatesParams)
    const apiElapsed = Date.now() - apiStart
    
    console.log(`📦 [ShipStation V1] API responded in ${apiElapsed}ms with ${rates.length} rates`)
    console.log('📦 [ShipStation V1] Rates received:', JSON.stringify(rates, null, 2))
    req.payload.logger.info(`📦 [ShipStation V1] API responded in ${apiElapsed}ms with ${rates.length} rates`)

    const elapsed = Date.now() - startTime
    console.log(`✅ [ShipStation V1] Request completed in ${elapsed}ms`)
    req.payload.logger.info(`✅ [ShipStation V1] Request completed in ${elapsed}ms`)
    return Response.json({
      rates,
      freeShipping: false,
    })
  } catch (err) {
    const elapsed = Date.now() - startTime
    const error = err as any
    console.log(`❌ [ShipStation V1] Rate calculation error after ${elapsed}ms: ${error?.message}`)
    console.log(`❌ [ShipStation V1] Error stack: ${error?.stack}`)
    req.payload.logger.error(`❌ [ShipStation V1] Rate calculation error after ${elapsed}ms: ${error?.message}`)

    // Surface ShipStation V1 error details if present (PascalCase fields)
    const details = error?.details || undefined
    const shipstationMessage = details?.ExceptionMessage || details?.Message
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500

    return Response.json({
      error: shipstationMessage || error?.message || 'Failed to calculate rates',
      details,
    }, { status: statusCode })
  }
}
