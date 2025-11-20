import type { Endpoint } from 'payload'
import { calculateRatesHandler } from './calculateRates'
import { validateAddressHandler } from './validateAddress'
import { webhooksHandler } from './webhooks'

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
      path: '/shipping/validate-address',
      method: 'post',
      handler: validateAddressHandler,
    },
    {
      path: '/shipping/webhooks',
      method: 'post',
      handler: webhooksHandler,
    },
  ]
}
