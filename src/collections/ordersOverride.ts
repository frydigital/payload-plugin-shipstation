import type { CollectionConfig } from 'payload'

/**
 * Orders collection override function
 * Adds shipping-related fields and tracking to orders
 */
export const getOrdersOverride = (): Partial<CollectionConfig> => {
  return {
    fields: [
      {
        name: 'shippingDetails',
        type: 'group',
        label: 'Shipping Details',
        fields: [
          {
            name: 'shippingStatus',
            type: 'select',
            label: 'Shipping Status',
            options: [
              { label: 'Pending', value: 'pending' },
              { label: 'Label Created', value: 'label_created' },
              { label: 'Shipped', value: 'shipped' },
              { label: 'In Transit', value: 'in_transit' },
              { label: 'Out for Delivery', value: 'out_for_delivery' },
              { label: 'Delivered', value: 'delivered' },
              { label: 'Exception', value: 'exception' },
              { label: 'Returned', value: 'returned' },
            ],
            defaultValue: 'pending',
          },
          {
            name: 'carrierCode',
            type: 'text',
            label: 'Carrier Code',
            admin: {
              description: 'ShipStation carrier code (e.g., canada_post, ups, fedex)',
            },
          },
          {
            name: 'serviceCode',
            type: 'text',
            label: 'Service Code',
            admin: {
              description: 'Shipping service code (e.g., expedited, ground)',
            },
          },
          {
            name: 'trackingNumber',
            type: 'text',
            label: 'Tracking Number',
            admin: {
              description: 'Carrier tracking number',
            },
          },
          {
            name: 'labelId',
            type: 'text',
            label: 'ShipStation Label ID',
            admin: {
              description: 'Internal ShipStation label identifier',
            },
          },
          {
            name: 'shipmentId',
            type: 'text',
            label: 'ShipStation Shipment ID',
            admin: {
              description: 'Internal ShipStation shipment identifier',
            },
          },
          {
            name: 'shippingCost',
            type: 'number',
            label: 'Shipping Cost',
            admin: {
              description: 'Actual shipping cost charged',
            },
          },
          {
            name: 'labelCreatedAt',
            type: 'date',
            label: 'Label Created At',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'shippedAt',
            type: 'date',
            label: 'Shipped At',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'deliveredAt',
            type: 'date',
            label: 'Delivered At',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'labelVoidedAt',
            type: 'date',
            label: 'Label Voided At',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'lastTrackingUpdate',
            type: 'date',
            label: 'Last Tracking Update',
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
        ],
      },
      {
        name: 'trackingEvents',
        type: 'array',
        label: 'Tracking Events',
        fields: [
          {
            name: 'timestamp',
            type: 'date',
            label: 'Timestamp',
            required: true,
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'status',
            type: 'text',
            label: 'Status',
            required: true,
          },
          {
            name: 'location',
            type: 'text',
            label: 'Location',
          },
          {
            name: 'description',
            type: 'textarea',
            label: 'Description',
          },
        ],
      },
      {
        name: 'packageDetails',
        type: 'array',
        label: 'Package Details',
        admin: {
          description: 'Details for multi-package shipments',
        },
        fields: [
          {
            name: 'packageNumber',
            type: 'number',
            label: 'Package Number',
            required: true,
          },
          {
            name: 'trackingNumber',
            type: 'text',
            label: 'Tracking Number',
          },
          {
            name: 'weight',
            type: 'group',
            label: 'Weight',
            fields: [
              {
                name: 'value',
                type: 'number',
                label: 'Value',
              },
              {
                name: 'unit',
                type: 'select',
                label: 'Unit',
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
              },
              {
                name: 'width',
                type: 'number',
                label: 'Width',
              },
              {
                name: 'height',
                type: 'number',
                label: 'Height',
              },
              {
                name: 'unit',
                type: 'select',
                label: 'Unit',
                options: [
                  { label: 'Centimeters (cm)', value: 'cm' },
                  { label: 'Meters (m)', value: 'm' },
                  { label: 'Inches (in)', value: 'in' },
                  { label: 'Feet (ft)', value: 'ft' },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}
