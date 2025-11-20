import type { CartItem, ShippingClass } from '../types'

/**
 * Check if cart items have shipping restrictions
 * Determines which shipping methods are available based on item shipping classes
 */
export interface ShippingRestrictions {
  hasPickupOnlyItems: boolean
  hasShippingOnlyItems: boolean
  requiresPickup: boolean
  availableMethods: {
    shipping: boolean
    pickup: boolean
  }
}

export function checkShippingRestrictions(items: CartItem[]): ShippingRestrictions {
  const pickupOnlyItems = items.filter(item => item.shippingClass === 'pickup-only')
  const shippableItems = items.filter(item => item.shippingClass !== 'pickup-only')
  
  const hasPickupOnlyItems = pickupOnlyItems.length > 0
  const hasShippingOnlyItems = shippableItems.length > 0
  
  // If ALL items are pickup-only, require pickup
  const requiresPickup = items.length > 0 && items.every(item => item.shippingClass === 'pickup-only')
  
  return {
    hasPickupOnlyItems,
    hasShippingOnlyItems,
    requiresPickup,
    availableMethods: {
      // Shipping available if there's at least one shippable item
      shipping: shippableItems.length > 0,
      // Pickup always available
      pickup: true,
    },
  }
}
