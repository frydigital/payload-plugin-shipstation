import type { CollectionConfig } from 'payload'

/**
 * Orders collection override function
 * Adds shipping-related fields and tracking to orders
 * Includes hook for auto-creating shipments on status change
 */
export const getOrdersOverride = (): Partial<CollectionConfig> => {
  return {
    hooks: {
      afterChange: [
        async ({ req, doc, previousDoc, operation }) => {
          const config = req.payload.config as any
          const pluginOptions = config?.shipStationPlugin

          // Check if auto-create shipments is enabled
          if (!pluginOptions?.enabledFeatures?.autoCreateShipments) {
            return doc
          }

          // Check if order status is 'processing' (either new order or status change)
          const isProcessing = doc.status === 'processing'
          const statusChanged = operation === 'create' || (previousDoc?.status !== doc.status)
          
          if (!isProcessing || !statusChanged) {
            return doc
          }

          // Only create shipments for shipping orders (not pickup)
          if (doc.shippingMethod !== 'shipping') {
            req.payload.logger.info(`Order ${doc.id} is pickup order, skipping shipment creation`)
            return doc
          }

          // Check if shipment already exists
          if (doc.shippingDetails?.shipstationShipmentId) {
            req.payload.logger.info(`Order ${doc.id} already has shipment, skipping`)
            return doc
          }

          // Trigger shipment creation asynchronously
          req.payload.logger.info(`Auto-creating shipment for order ${doc.id}`)
          
          try {
            console.warn(`🔥 [ordersOverride] Getting ShipStation client...`)
            const client = (req.payload as any).shipStationClient
            
            if (!client) {
              req.payload.logger.error('ShipStation client not initialized')
              return doc
            }
            console.warn(`🔥 [ordersOverride] Client found, importing utility...`)

            // Import the endpoint logic (we'll create a helper function)
            const { createShipmentForOrder } = await import('../utilities/createShipmentForOrder')
            console.warn(`🔥 [ordersOverride] Utility imported, calling createShipmentForOrder...`)
            console.warn(`🔥 [ordersOverride] Passing doc directly instead of fetching...`)
            
            const result = await createShipmentForOrder(req.payload, doc.id, client, pluginOptions, doc)
            console.warn(`🔥 [ordersOverride] createShipmentForOrder returned:`, result)
            
            if (result.success) {
              // Derive shipping cost (cents) cascade: doc.shippingCost -> selectedRate.cost -> total - amount
              const derivedShippingCost = (doc as any).shippingCost ?? (doc as any).selectedRate?.cost ?? ((doc as any).total && (doc as any).amount && (doc as any).total > (doc as any).amount ? (doc as any).total - (doc as any).amount : undefined)
              console.warn(`🔥 [ordersOverride] Derived shippingCost (cents):`, derivedShippingCost)
              // Mutate doc in-place to avoid race condition with payment flow
              console.warn(`🔥 [ordersOverride] Updating doc.shippingDetails in-place with shipment ID: ${result.shipmentId}`)
              doc.shippingDetails = {
                ...(doc.shippingDetails || {}),
                // Use correct field name per schema
                shipmentId: result.shipmentId,
                // Keep legacy key if previously used (harmless extra)
                shipstationShipmentId: result.shipmentId,
                shippingStatus: 'processing',
                shippingCost: derivedShippingCost,
                carrierCode: (doc as any).selectedRate?.carrierCode ?? (doc as any).shippingDetails?.carrierCode,
                serviceCode: (doc as any).selectedRate?.serviceCode ?? (doc as any).shippingDetails?.serviceCode,
              }
              if (!(doc as any).selectedRate?.serviceCode) {
                console.warn('⚠️ [ordersOverride] selectedRate.serviceCode missing; service type not persisted')
              }
              if (derivedShippingCost == null) {
                console.warn('⚠️ [ordersOverride] shippingCost could not be derived (no shippingCost / selectedRate.cost / total-amount)')
              }
              req.payload.logger.info(`Shipment created successfully for order ${doc.id}`)
            } else {
              throw new Error(result.error || 'Unknown error')
            }
          } catch (error) {
            console.error(`❌ [ordersOverride] Error caught:`, error)
            console.error(`❌ [ordersOverride] Error message: ${(error as Error).message}`)
            console.error(`❌ [ordersOverride] Error stack:`, (error as Error).stack)
            req.payload.logger.error(`Failed to auto-create shipment for order ${doc.id}: ${(error as Error).message}`)
            
            // Update doc in-place to manual review (avoid race condition)
            console.warn(`🔥 [ordersOverride] Setting shippingStatus to manual_review in-place`)
            doc.shippingDetails = {
              ...(doc.shippingDetails || {}),
              shippingStatus: 'manual_review',
            }
            req.payload.logger.warn(`Set order ${doc.id} to manual review due to shipment error`)
          }

          return doc
        },
      ],
    },
    fields: [
      {
        name: 'shippingMethod',
        type: 'select',
        label: 'Shipping Method',
        options: [
          { label: 'Ship to Address', value: 'shipping' },
          { label: 'In-Store Pickup', value: 'pickup' },
        ],
        defaultValue: 'shipping',
        admin: {
          position: 'sidebar',
          description: 'How the order will be fulfilled',
        },
      },
      {
        name: 'pickupLocation',
        type: 'text',
        label: 'Pickup Location',
        admin: {
          position: 'sidebar',
          description: 'Selected pickup location (from pickup-locations global)',
          condition: (data) => data?.shippingMethod === 'pickup',
        },
      },
      {
        name: 'selectedRate',
        type: 'group',
        label: 'Selected Shipping Rate',
        admin: {
          condition: (data) => data?.shippingMethod === 'shipping',
        },
        fields: [
          {
            name: 'serviceName',
            type: 'text',
            label: 'Service Name',
            admin: {
              description: 'e.g., "Free Shipping", "Canada Post Expedited"',
            },
          },
          {
            name: 'serviceCode',
            type: 'text',
            label: 'Service Code',
          },
          {
            name: 'carrierCode',
            type: 'text',
            label: 'Carrier Code',
          },
          {
            name: 'carrierId',
            type: 'text',
            label: 'Carrier ID',
            admin: {
              description: 'ShipStation Carrier ID',
            },
          },
          {
            name: 'cost',
            type: 'number',
            label: 'Shipping Cost',
            admin: {
              description: 'Cost in cents',
            },
          },
          {
            name: 'currency',
            type: 'text',
            label: 'Currency',
            defaultValue: 'CAD',
          },
        ],
      },
      {
        name: 'shippingDetails',
        type: 'group',
        label: 'Shipping Details',
        admin: {
          condition: (data) => data?.shippingMethod === 'shipping',
        },
        fields: [
          {
            name: 'shippingStatus',
            type: 'select',
            label: 'Shipping Status',
            options: [
              { label: 'Pending', value: 'pending' },
              { label: 'Processing', value: 'processing' },
              { label: 'Label Created', value: 'label_created' },
              { label: 'Shipped', value: 'shipped' },
              { label: 'In Transit', value: 'in_transit' },
              { label: 'Out for Delivery', value: 'out_for_delivery' },
              { label: 'Delivered', value: 'delivered' },
              { label: 'Exception', value: 'exception' },
              { label: 'Returned', value: 'returned' },
              { label: 'Manual Review', value: 'manual_review' },
            ],
            defaultValue: 'pending',
            admin: {
              description: 'Status updates automatically when shipments are created/updated',
            },
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
