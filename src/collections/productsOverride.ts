import type { CollectionConfig } from 'payload'

/**
 * Products collection override function
 * Adds shipping-related fields to products collection as a separate tab
 */
export const getProductsOverride = (): Partial<CollectionConfig> => {
  return {
    admin: {
      useAsTitle: undefined, // Don't override existing config
    },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Shipping',
            description: 'Configure shipping settings for this product',
            fields: [
              {
                name: 'weight',
                type: 'group',
                label: 'Weight',
                fields: [
                  {
                    name: 'value',
                    type: 'number',
                    label: 'Value',
                    min: 0,
                    admin: {
                      description: 'Product weight (will be used if variants don\'t override)',
                    },
                  },
                  {
                    name: 'unit',
                    type: 'select',
                    label: 'Unit',
                    defaultValue: 'kg',
                    options: [
                      { label: 'Kilograms (kg)', value: 'kg' },
                      { label: 'Grams (g)', value: 'g' },
                      { label: 'Pounds (lb)', value: 'lb' },
                      { label: 'Ounces (oz)', value: 'oz' },
                    ],
                  },
                ],
              },
              {
                name: 'dimensions',
                type: 'group',
                label: 'Dimensions',
                fields: [
                  {
                    name: 'length',
                    type: 'number',
                    label: 'Length',
                    min: 0,
                  },
                  {
                    name: 'width',
                    type: 'number',
                    label: 'Width',
                    min: 0,
                  },
                  {
                    name: 'height',
                    type: 'number',
                    label: 'Height',
                    min: 0,
                  },
                  {
                    name: 'unit',
                    type: 'select',
                    label: 'Unit',
                    defaultValue: 'cm',
                    options: [
                      { label: 'Centimeters (cm)', value: 'cm' },
                      { label: 'Meters (m)', value: 'm' },
                      { label: 'Inches (in)', value: 'in' },
                      { label: 'Feet (ft)', value: 'ft' },
                    ],
                  },
                ],
              },
              {
                name: 'shippingClass',
                type: 'select',
                label: 'Shipping Class',
                defaultValue: 'standard',
                options: [
                  { label: 'Standard', value: 'standard' },
                  { label: 'Heavy', value: 'heavy' },
                  { label: 'Oversized', value: 'oversized' },
                  { label: 'Fragile', value: 'fragile' },
                  { label: 'Perishable', value: 'perishable' },
                ],
                admin: {
                  description: 'Affects shipping rate multipliers configured in ShipStation settings',
                },
              },
              {
                name: 'requiresSignature',
                type: 'checkbox',
                label: 'Requires Signature',
                defaultValue: false,
                admin: {
                  description: 'Whether this product requires signature on delivery',
                },
              },
              {
                name: 'hazardousMaterials',
                type: 'checkbox',
                label: 'Hazardous Materials',
                defaultValue: false,
                admin: {
                  description: 'Whether this product contains hazardous materials',
                },
              },
              // Phase 2: International shipping fields (disabled)
              {
                name: 'customsValue',
                type: 'number',
                label: 'Customs Value (CAD)',
                min: 0,
                admin: {
                  description: '⚠️ Phase 2 Feature (Q1 2026) - Not yet implemented',
                  readOnly: true,
                  disabled: true,
                },
              },
              {
                name: 'hsCode',
                type: 'text',
                label: 'HS Code',
                admin: {
                  description: '⚠️ Phase 2 Feature (Q1 2026) - Harmonized System code for customs',
                  readOnly: true,
                  disabled: true,
                },
              },
              {
                name: 'countryOfOrigin',
                type: 'text',
                label: 'Country of Origin',
                admin: {
                  description: '⚠️ Phase 2 Feature (Q1 2026) - Not yet implemented',
                  readOnly: true,
                  disabled: true,
                },
              },
            ],
          },
        ],
      },
    ],
  }
}
