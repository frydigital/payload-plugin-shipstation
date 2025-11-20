import type { CollectionConfig } from 'payload'

export const getVariantsOverride = (): Partial<CollectionConfig> => {
  return {
    fields: [
      {
        name: 'shippingOverride',
        type: 'group',
        label: 'Shipping Override',
        admin: {
          description: 'Override shipping details from parent product. Leave empty to inherit.',
        },
        fields: [
          {
            name: 'overrideParent',
            type: 'checkbox',
            label: 'Override Parent Shipping Details',
            defaultValue: false,
            admin: {
              description: 'Check this to set custom shipping details for this variant',
            },
          },
          {
            name: 'weight',
            type: 'group',
            label: 'Weight',
            admin: {
              condition: (data: any) => data?.shippingOverride?.overrideParent === true,
            },
            fields: [
              {
                name: 'value',
                type: 'number',
                label: 'Value',
                min: 0,
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
        ],
      },
    ],
  }
}
