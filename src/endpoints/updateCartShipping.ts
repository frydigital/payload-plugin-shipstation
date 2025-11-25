import type { Endpoint } from 'payload'

export const updateCartShippingHandler: Endpoint['handler'] = async (req) => {
  try {
    let body
    if (req.json && typeof req.json === 'function') {
      body = await req.json()
    } else {
      body = (req as any).body
    }

    const { cartId, shippingMethod, shippingCost, selectedRate, selectedShippingRate } = body as any

    if (!cartId) {
      return Response.json({ error: 'Cart ID is required' }, { status: 400 })
    }

    // Fetch the cart first to check existence
    const cart = await req.payload.findByID({
      collection: 'carts',
      id: cartId,
    })
    
    if (!cart) {
      return Response.json({ error: 'Cart not found' }, { status: 404 })
    }
    
    // Update the cart with shipping details
    await req.payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        shippingMethod,
        shippingCost,
        selectedRate: selectedRate || selectedShippingRate,
      } as any,
      overrideAccess: true,
    })

    return Response.json({ success: true })
  } catch (error) {
    req.payload.logger.error(`Failed to update cart shipping: ${(error as Error).message}`)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
