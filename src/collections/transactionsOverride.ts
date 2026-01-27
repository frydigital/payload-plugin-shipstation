import { CollectionConfig } from 'payload'

/**
 * ShipStation Payment Transactions Collection Override
 * Tracks payment intents and transaction status for orders
 */
export const transactionsOverride = (config: CollectionConfig): CollectionConfig => {
  return {
    ...config,
    fields: [
      ...(config.fields || []),
      {
        name: 'shipstationTransactionAttached',
        type: 'checkbox',
        label: 'ShipStation Transaction Attached',
        defaultValue: false,
        admin: {
          description: 'Whether this transaction has been synced to ShipStation',
        },
      },
      {
        name: 'shipstationResponse',
        type: 'json',
        label: 'ShipStation Sync Response',
        admin: {
          description: 'Response from ShipStation when order was pushed',
          condition: (data) => data?.shipstationTransactionAttached === true,
        },
      },
      {
        name: 'shipstationErrorLog',
        type: 'array',
        label: 'ShipStation Error History',
        admin: {
          description: 'Log of errors when attempting to sync to ShipStation',
        },
        fields: [
          {
            name: 'timestamp',
            type: 'date',
            required: true,
            admin: {
              date: {
                pickerAppearance: 'dayAndTime',
              },
            },
          },
          {
            name: 'error',
            type: 'text',
            required: true,
          },
          {
            name: 'details',
            type: 'textarea',
          },
        ],
      },
      {
        name: 'lastSyncAttempt',
        type: 'date',
        label: 'Last ShipStation Sync Attempt',
        admin: {
          date: {
            pickerAppearance: 'dayAndTime',
          },
        },
      },
    ],
  }
}
