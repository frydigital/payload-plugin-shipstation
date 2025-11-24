import type { Endpoint } from 'payload'
import { calculateRatesHandler } from './calculateRates'
import { cartShippingEligibilityHandler } from './cartShippingEligibility'
import { validateAddressHandler } from './validateAddress'
import { webhooksHandler } from './webhooks'
import { createShipmentHandler } from './createShipment'
import { 
  listCarriersHandler, 
  getCarrierHandler, 
  listCarrierServicesHandler 
} from './listCarriers'
import { updateCartShippingHandler } from './updateCartShipping'

/**
 * Get all shipping endpoints
 */
export function getShippingEndpoints(): Endpoint[] {
  return [
    {
      path: '/shipping/calculate-rates',
      method: 'post',
      handler: calculateRatesHandler,
    },
    {
      path: '/cart/update-shipping',
      method: 'post',
      handler: updateCartShippingHandler,
    },
    {
      path: '/shipping/validate-address',
      method: 'post',
      handler: validateAddressHandler,
    },
    {
      path: '/shipping/create-shipment',
      method: 'post',
      handler: createShipmentHandler,
    },
    {
      path: '/shipping/webhooks',
      method: 'post',
      handler: webhooksHandler,
    },
    {
      path: '/cart/shipping-eligibility',
      method: 'post',
      handler: cartShippingEligibilityHandler,
    },
    {
      path: '/shipping/carriers',
      method: 'get',
      handler: listCarriersHandler,
    },
    {
      path: '/shipping/carriers/:carrierId',
      method: 'get',
      handler: getCarrierHandler,
    },
    {
      path: '/shipping/carriers/:carrierId/services',
      method: 'get',
      handler: listCarrierServicesHandler,
    },
  ]
}
