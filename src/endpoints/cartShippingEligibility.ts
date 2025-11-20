import type { Endpoint } from 'payload'
import type { CartShippingEligibility, CartItem, ShippingClass } from '../types'
import { checkShippingRestrictions } from '../utilities/checkShippingRestrictions'
import { calculateEligibleSubtotal } from '../utilities/calculateEligibleSubtotal'

// Type for populated product/variant with shipping fields
interface ShippingData {
  id: string
  shippingClass?: ShippingClass
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
}

export const cartShippingEligibilityHandler: Endpoint['handler'] = async (req) => {
  try {
    const body = req.json ? await req.json() : req.body
    const { cartId } = body as { cartId?: string }

    if (!cartId) {
      return Response.json({
        success: false,
        error: 'Cart ID is required',
      }, { status: 400 })
    }

    // Fetch the cart
    const cart = await req.payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 2, // Include product/variant data
    })

    if (!cart) {
      return Response.json({
        success: false,
        error: 'Cart not found',
      }, { status: 404 })
    }

    // Get shipping settings
    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    const freeShippingThreshold = shippingSettings?.freeShippingThreshold || 0
    const excludedClasses = shippingSettings?.freeShippingExcludedClasses || []

    // Transform cart items to CartItem format
    const cartItems: CartItem[] = (cart.items || []).map((item: Record<string, unknown>) => {
      // Get product and variant data with proper typing
      const product = typeof item.product === 'object' ? (item.product as ShippingData) : null
      const variant = typeof item.variant === 'object' ? (item.variant as ShippingData) : null

      // Determine shipping class (variant overrides product)
      const shippingClass = variant?.shippingClass || product?.shippingClass

      return {
        id: item.id as string,
        productId: typeof item.product === 'string' ? item.product : product?.id,
        variantId: typeof item.variant === 'string' ? item.variant : variant?.id,
        quantity: (item.quantity as number) || 1,
        price: (item.price as number) || 0,
        shippingClass,
        weight: variant?.weight || product?.weight,
        dimensions: variant?.dimensions || product?.dimensions,
      }
    })

    // Check shipping restrictions
    const restrictions = checkShippingRestrictions(cartItems)

    // Calculate eligible subtotal for free shipping
    const { eligibleSubtotal, excludedItems } = calculateEligibleSubtotal(
      cartItems,
      excludedClasses
    )

    // Separate items by shipping requirement
    const shippableItems = cartItems.filter(item => item.shippingClass !== 'pickup-only')
    const pickupOnlyItems = cartItems.filter(item => item.shippingClass === 'pickup-only')

    // Determine if cart qualifies for free shipping
    const eligibleForFreeShipping = 
      freeShippingThreshold > 0 && 
      eligibleSubtotal >= freeShippingThreshold &&
      shippableItems.length > 0 // Must have shippable items

    const remainingAmount = eligibleForFreeShipping 
      ? 0 
      : Math.max(0, freeShippingThreshold - eligibleSubtotal)

    const response: CartShippingEligibility = {
      eligibleForFreeShipping,
      eligibleSubtotal,
      threshold: freeShippingThreshold,
      remainingAmount,
      itemBreakdown: {
        shippable: shippableItems,
        pickupOnly: pickupOnlyItems,
        excludedFromFreeShipping: excludedItems,
      },
      availableMethods: restrictions.availableMethods,
      restrictions: {
        hasPickupOnlyItems: restrictions.hasPickupOnlyItems,
        hasShippingOnlyItems: restrictions.hasShippingOnlyItems,
        requiresPickup: restrictions.requiresPickup,
      },
    }

    return Response.json({
      success: true,
      data: response,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    req.payload.logger.error(`Cart shipping eligibility error: ${errorMessage}`)
    return Response.json({
      success: false,
      error: errorMessage || 'Failed to calculate shipping eligibility',
    }, { status: 500 })
  }
}

export const cartShippingEligibilityEndpoint: Endpoint = {
  path: '/cart/shipping-eligibility',
  method: 'post',
  handler: cartShippingEligibilityHandler,
}
