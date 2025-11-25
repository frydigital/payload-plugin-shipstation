import type { CartItem, ShippingClass } from '../types'

/**
 * Calculate the cart subtotal eligible for free shipping
 * Excludes items with shipping classes that don't qualify for free shipping
 */
export interface EligibleSubtotalResult {
  eligibleSubtotal: number
  eligibleItems: CartItem[]
  excludedItems: CartItem[]
}

export function calculateEligibleSubtotal(
  items: CartItem[],
  excludedShippingClasses: ShippingClass[] = []
): EligibleSubtotalResult {
  const eligibleItems: CartItem[] = []
  const excludedItems: CartItem[] = []
  
  let eligibleSubtotal = 0
  
  for (const item of items) {
    // Skip pickup-only items (they don't ship)
    if (item.shippingClass === 'pickup-only') {
      excludedItems.push(item)
      continue
    }
    
    // Check if this shipping class is excluded from free shipping
    const isExcluded = item.shippingClass && excludedShippingClasses.includes(item.shippingClass)
    
    if (isExcluded) {
      excludedItems.push(item)
    } else {
      eligibleItems.push(item)
      eligibleSubtotal += (item.price || 0) * item.quantity
    }
  }
  
  return {
    eligibleSubtotal,
    eligibleItems,
    excludedItems,
  }
}
