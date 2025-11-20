import type { Config, Plugin } from 'payload'
import type { ShipStationPluginOptions } from './types'
import { ShippingSettings } from './globals/ShippingSettings'
import { getProductsOverride } from './collections/productsOverride'
import { getVariantsOverride } from './collections/variantsOverride'
import { createRateCache } from './utilities/cache'
import { ShipStationClient } from './api/shipstation'

/**
 * ShipStation Shipping Plugin for Payload CMS
 *
 * Provides comprehensive shipping functionality including:
 * - Rate calculation with Canadian provincial rates
 * - ShipStation API integration for real-time carrier rates
 * - Address validation
 * - Multi-package shipment handling
 * - Custom shipping zones
 * - Rate caching (Redis/in-memory)
 * - Webhook support for tracking updates
 *
 * @example
 * ```ts
 * import { shipStationPlugin } from '@cedarroutes/payload-plugin-shipstation'
 *
 * export default buildConfig({
 *   plugins: [
 *     shipStationPlugin({
 *       apiKey: process.env.SHIPSTATION_API_KEY,
 *       warehouseId: process.env.SHIPSTATION_WAREHOUSE_ID,
 *       provincialRates: [
 *         { province: 'ON', baseRate: 1000, enabled: true },
 *         { province: 'BC', baseRate: 1200, enabled: true },
 *       ],
 *       freeShippingConfig: {
 *         threshold: 10000, // $100 CAD
 *         eligibleCountries: ['CA'],
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export const shipStationPlugin =
  (pluginOptions: ShipStationPluginOptions): Plugin =>
  (incomingConfig: Config): Config => {
    // Validate required options
    if (!pluginOptions.apiKey) {
      throw new Error('ShipStation plugin: apiKey is required')
    }
    if (!pluginOptions.warehouseId) {
      throw new Error('ShipStation plugin: warehouseId is required')
    }

    // Create a copy of the incoming config
    const config: Config = { ...incomingConfig }

    // Store plugin options in config for access in collections/endpoints
    // @ts-expect-error - Adding custom property for plugin access
    config.shipStationPlugin = pluginOptions

    // Add ShippingSettings global
    config.globals = [
      ...(config.globals || []),
      ShippingSettings,
    ]

    // Extend Products and Variants collections with shipping fields
    if (config.collections) {
      config.collections = config.collections.map((collection) => {
        if (collection.slug === 'products') {
          const productsOverride = getProductsOverride()
          return {
            ...collection,
            fields: [
              ...collection.fields,
              ...(productsOverride.fields || []),
            ],
          }
        }
        
        if (collection.slug === 'product-variants') {
          const variantsOverride = getVariantsOverride()
          return {
            ...collection,
            fields: [
              ...collection.fields,
              ...(variantsOverride.fields || []),
            ],
          }
        }
        
        return collection
      })
    }

    // TODO: Add custom endpoints
    // config.endpoints = [
    //   ...(config.endpoints || []),
    //   ...getShippingEndpoints(pluginOptions),
    // ]

    // Initialize cache and API client on Payload init
    config.onInit = async (payload) => {
      if (incomingConfig.onInit) {
        await incomingConfig.onInit(payload)
      }

      // Initialize ShipStation API client
      const client = new ShipStationClient({
        apiKey: pluginOptions.apiKey!,
        warehouseId: pluginOptions.warehouseId!,
        sandboxMode: pluginOptions.sandboxMode,
      })

      // Store client in payload for access in endpoints/hooks
      // @ts-expect-error - Adding custom property
      payload.shipStationClient = client

      // Initialize cache if enabled
      if (pluginOptions.cache?.enableCache) {
        payload.logger.info('ShipStation Plugin: Initializing rate cache...')
        const cache = await createRateCache({
          redisUrl: pluginOptions.cache.redisUrl,
          enableCache: pluginOptions.cache.enableCache,
        })
        
        // Store cache in payload
        // @ts-expect-error - Adding custom property
        payload.shipStationCache = cache
      }

      // Log plugin configuration
      payload.logger.info('ShipStation Plugin: Initialized successfully')
      payload.logger.info(`  Sandbox Mode: ${pluginOptions.sandboxMode ? 'Enabled' : 'Disabled'}`)
      payload.logger.info(`  Address Validation: ${pluginOptions.enabledFeatures?.addressValidation ? 'Enabled' : 'Disabled'}`)
      payload.logger.info(`  Multi-Package: ${pluginOptions.enabledFeatures?.multiPackage ? 'Enabled' : 'Disabled'}`)
      payload.logger.info(`  Auto-Create Shipments: ${pluginOptions.enabledFeatures?.autoCreateShipments ? 'Enabled' : 'Disabled'}`)
      payload.logger.info(`  Webhooks: ${pluginOptions.enabledFeatures?.webhooks ? 'Enabled' : 'Disabled'}`)

      if (pluginOptions.cache?.enableCache) {
        payload.logger.info(`  Cache: Enabled (TTL: ${pluginOptions.cache.cacheTTL}s)`)
      }

      // Log Phase 2 features if configured
      if (pluginOptions.internationalShipping?.enabled) {
        payload.logger.warn('  International Shipping: Configured but not yet available (Phase 2)')
      }
      if (pluginOptions.carrierAccounts?.enabled) {
        payload.logger.warn('  Carrier Accounts: Configured but not yet available (Phase 2)')
      }
      if (pluginOptions.analytics?.enabled) {
        payload.logger.warn('  Analytics: Configured but not yet available (Phase 2)')
      }
    }

    return config
  }

// Re-export types for consumers
export * from './types'
