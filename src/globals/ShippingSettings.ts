import type { GlobalConfig } from 'payload'

/**
 * ShippingSettings Global
 * 
 * Central configuration for all shipping-related settings including:
 * - ShipStation API credentials
 * - Carrier preferences
 * - Provincial rates for Canada
 * - Free shipping rules
 * - Address validation settings
 * - Webhook configuration
 * - Cache settings
 * - Phase 2 feature placeholders
 */
export const ShippingSettings: GlobalConfig = {
  slug: 'shipping-settings',
  label: 'Shipping Settings',
  admin: {
    group: 'Settings',
    description: 'Configure shipping rates, carriers, and ShipStation integration',
  },
  access: {
    read: ({ req: { user } }) => {
      return Boolean(user)
    },
    update: ({ req: { user } }) => {
      return Boolean(user?.roles?.includes('admin'))
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // API Settings Tab
        {
          label: 'API Settings',
          fields: [
            {
              name: 'apiKey',
              type: 'text',
              admin: {
                description: 'Your ShipStation API key (stored securely)',
                readOnly: true,
                placeholder: 'Configured via environment variable',
              },
            },
            {
              name: 'warehouseId',
              type: 'text',
              admin: {
                description: 'Default warehouse ID for shipments',
                placeholder: 'se-123456',
              },
            },
          ],
        },

        // Carriers Tab
        {
          label: 'Carriers',
          fields: [
            {
              name: 'preferredCarriers',
              type: 'array',
              label: 'Preferred Carriers',
              admin: {
                description: 'Carriers to use for rate calculations (in priority order)',
              },
              fields: [
                {
                  name: 'carrierId',
                  type: 'text',
                  admin: {
                    placeholder: 'se-123456',
                    description: 'ShipStation carrier ID',
                  },
                },
                {
                  name: 'carrierCode',
                  type: 'text',
                  admin: {
                    placeholder: 'canada_post',
                  },
                },
                {
                  name: 'carrierName',
                  type: 'text',
                  admin: {
                    placeholder: 'Canada Post',
                  },
                },
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
            {
              name: 'enabledServices',
              type: 'array',
              label: 'Enabled Services',
              admin: {
                description: 'Specific carrier services to offer at checkout',
              },
              fields: [
                {
                  name: 'serviceCode',
                  type: 'text',
                  admin: {
                    placeholder: 'canada_post_regular_parcel',
                  },
                },
                {
                  name: 'serviceName',
                  type: 'text',
                  admin: {
                    placeholder: 'Regular Parcel',
                  },
                },
              ],
            },
          ],
        },

        // Canadian Rates Tab
        {
          label: 'Canadian Rates',
          fields: [
            {
              name: 'provincialRates',
              type: 'array',
              label: 'Provincial Flat Rates',
              admin: {
                description: 'Flat shipping rates by province (in CAD cents)',
              },
              fields: [
                {
                  name: 'province',
                  type: 'select',
                  options: [
                    { label: 'British Columbia', value: 'BC' },
                    { label: 'Alberta', value: 'AB' },
                    { label: 'Saskatchewan', value: 'SK' },
                    { label: 'Manitoba', value: 'MB' },
                    { label: 'Ontario', value: 'ON' },
                    { label: 'Quebec', value: 'QC' },
                    { label: 'New Brunswick', value: 'NB' },
                    { label: 'Nova Scotia', value: 'NS' },
                    { label: 'Prince Edward Island', value: 'PE' },
                    { label: 'Newfoundland and Labrador', value: 'NL' },
                    { label: 'Yukon', value: 'YT' },
                    { label: 'Northwest Territories', value: 'NT' },
                    { label: 'Nunavut', value: 'NU' },
                  ],
                },
                {
                  name: 'baseRate',
                  type: 'number',
                  admin: {
                    description: 'Rate in cents (e.g., 1000 = $10.00)',
                    placeholder: '1000',
                  },
                },
                {
                  name: 'enabled',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
            {
              name: 'shippingClassMultipliers',
              type: 'group',
              label: 'Shipping Class Modifiers',
              admin: {
                description: 'Multipliers applied to base rates based on shipping class',
              },
              fields: [
                {
                  name: 'standard',
                  type: 'number',
                  defaultValue: 1.0,
                  admin: {
                    description: 'Standard shipping multiplier',
                    step: 0.1,
                  },
                },
                {
                  name: 'expedited',
                  type: 'number',
                  defaultValue: 1.5,
                  admin: {
                    description: 'Expedited shipping multiplier',
                    step: 0.1,
                  },
                },
                {
                  name: 'fragile',
                  type: 'number',
                  defaultValue: 1.3,
                  admin: {
                    description: 'Fragile items multiplier',
                    step: 0.1,
                  },
                },
                {
                  name: 'oversized',
                  type: 'number',
                  defaultValue: 2.0,
                  admin: {
                    description: 'Oversized items multiplier',
                    step: 0.1,
                  },
                },
                {
                  name: 'custom',
                  type: 'number',
                  defaultValue: 1.0,
                  admin: {
                    description: 'Custom shipping class multiplier',
                    step: 0.1,
                  },
                },
              ],
            },
          ],
        },

        // Custom Zones Tab
        {
          label: 'Custom Zones',
          fields: [
            {
              name: 'enableCustomZones',
              type: 'checkbox',
              defaultValue: false,
              label: 'Enable Custom Shipping Zones',
              admin: {
                description: 'Enable postal code-based shipping zones for advanced rate rules',
              },
            },
            {
              name: 'customZonesDescription',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'When enabled, you can create custom shipping zones in the Shipping Zones collection with postal code pattern matching for advanced rate calculations.',
                condition: (data) => data?.enableCustomZones === true,
              },
            },
          ],
        },

        // Free Shipping Tab
        {
          label: 'Free Shipping',
          fields: [
            {
              name: 'freeShippingThreshold',
              type: 'number',
              label: 'Free Shipping Threshold',
              admin: {
                description: 'Order subtotal (in cents) for free shipping. Example: 10000 = $100.00',
                placeholder: '10000',
              },
            },
            {
              name: 'freeShippingEligibleCountries',
              type: 'select',
              hasMany: true,
              label: 'Eligible Countries',
              defaultValue: ['CA'],
              options: [
                { label: 'Canada', value: 'CA' },
                { label: 'United States', value: 'US' },
              ],
              admin: {
                description: 'Countries eligible for free shipping',
              },
            },
            {
              name: 'freeShippingExcludedClasses',
              type: 'select',
              hasMany: true,
              label: 'Excluded Shipping Classes',
              options: [
                { label: 'Standard', value: 'standard' },
                { label: 'Expedited', value: 'expedited' },
                { label: 'Fragile', value: 'fragile' },
                { label: 'Oversized', value: 'oversized' },
                { label: 'Custom', value: 'custom' },
              ],
              admin: {
                description: 'Shipping classes excluded from free shipping (e.g., oversized items)',
              },
            },
          ],
        },

        // Packaging Tab
        {
          label: 'Packaging',
          fields: [
            {
              name: 'maxPackageWeight',
              type: 'group',
              label: 'Maximum Package Weight',
              admin: {
                description: 'Orders exceeding this weight will be split into multiple packages',
              },
              fields: [
                {
                  name: 'value',
                  type: 'number',
                  defaultValue: 70,
                  admin: {
                    placeholder: '70',
                  },
                },
                {
                  name: 'unit',
                  type: 'select',
                  defaultValue: 'pound',
                  options: [
                    { label: 'Ounce', value: 'ounce' },
                    { label: 'Pound', value: 'pound' },
                    { label: 'Gram', value: 'gram' },
                    { label: 'Kilogram', value: 'kilogram' },
                  ],
                },
              ],
            },
            {
              name: 'maxPackageDimensions',
              type: 'group',
              label: 'Maximum Package Dimensions',
              fields: [
                {
                  name: 'length',
                  type: 'number',
                  defaultValue: 36,
                },
                {
                  name: 'width',
                  type: 'number',
                  defaultValue: 24,
                },
                {
                  name: 'height',
                  type: 'number',
                  defaultValue: 24,
                },
                {
                  name: 'unit',
                  type: 'select',
                  defaultValue: 'inch',
                  options: [
                    { label: 'Inch', value: 'inch' },
                    { label: 'Centimeter', value: 'centimeter' },
                  ],
                },
              ],
            },
            {
              name: 'splitStrategy',
              type: 'select',
              label: 'Package Split Strategy',
              defaultValue: 'optimize_cost',
              options: [
                { label: 'Optimize Cost', value: 'optimize_cost' },
                { label: 'Minimize Packages', value: 'minimize_packages' },
              ],
              admin: {
                description: 'Strategy for splitting orders into multiple packages',
              },
            },
          ],
        },

        // Address Validation Tab
        {
          label: 'Address Validation',
          fields: [
            {
              name: 'enableValidation',
              type: 'checkbox',
              defaultValue: true,
              label: 'Enable Address Validation',
              admin: {
                description: 'Validate shipping addresses using ShipStation',
              },
            },
            {
              name: 'validationMode',
              type: 'select',
              defaultValue: 'validate_and_clean',
              options: [
                { label: 'No Validation', value: 'no_validation' },
                { label: 'Validate Only', value: 'validate_only' },
                { label: 'Validate and Clean', value: 'validate_and_clean' },
              ],
              admin: {
                description: 'How to handle address validation',
                condition: (data) => data?.enableValidation === true,
              },
            },
            {
              name: 'failOnInvalidAddress',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Prevent checkout if address validation fails',
                condition: (data) => data?.enableValidation === true,
              },
            },
          ],
        },

        // Webhooks Tab
        {
          label: 'Webhooks',
          fields: [
            {
              name: 'webhookSecret',
              type: 'text',
              admin: {
                description: 'Secret for validating ShipStation webhook requests',
                placeholder: 'Configured via environment variable',
                readOnly: true,
              },
            },
            {
              name: 'enabledWebhookEvents',
              type: 'select',
              hasMany: true,
              label: 'Enabled Events',
              defaultValue: ['tracking.updated', 'tracking.delivered'],
              options: [
                { label: 'Shipment Created', value: 'shipment.created' },
                { label: 'Label Created', value: 'label.created' },
                { label: 'Tracking Updated', value: 'tracking.updated' },
                { label: 'Tracking Delivered', value: 'tracking.delivered' },
                { label: 'Tracking Exception', value: 'tracking.exception' },
              ],
              admin: {
                description: 'ShipStation events to process',
              },
            },
          ],
        },

        // Cache Tab
        {
          label: 'Cache',
          fields: [
            {
              name: 'enableCache',
              type: 'checkbox',
              defaultValue: true,
              label: 'Enable Rate Caching',
              admin: {
                description: 'Cache shipping rate calculations to improve performance',
              },
            },
            {
              name: 'cacheTTL',
              type: 'number',
              defaultValue: 300,
              label: 'Cache TTL (seconds)',
              admin: {
                description: 'How long to cache rate calculations (default: 5 minutes)',
                condition: (data) => data?.enableCache === true,
              },
            },
            {
              name: 'redisUrl',
              type: 'text',
              admin: {
                description: 'Redis connection URL (leave empty to use in-memory cache)',
                placeholder: 'redis://localhost:6379',
                condition: (data) => data?.enableCache === true,
              },
            },
          ],
        },

        // Phase 2 Features Tab
        {
          label: 'Phase 2 Features',
          fields: [
            {
              name: 'phase2Notice',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Phase 2 Features (Coming Q1 2026): International Shipping (customs forms, duty calculation), Carrier Account Management (multiple accounts with load balancing), and Shipping Analytics (performance tracking)',
              },
            },
            {
              name: 'internationalShippingEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'International Shipping',
              admin: {
                description: '⚠️ Not yet available - Will enable customs forms and duty calculation',
                disabled: true,
              },
            },
            {
              name: 'carrierAccountsEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'Multi-Carrier Accounts',
              admin: {
                description: '⚠️ Not yet available - Will enable multiple carrier accounts with load balancing',
                disabled: true,
              },
            },
            {
              name: 'analyticsEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'Shipping Analytics',
              admin: {
                description: '⚠️ Not yet available - Will enable performance tracking and insights',
                disabled: true,
              },
            },
          ],
        },
      ],
    },
  ],
}
