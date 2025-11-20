import type { GlobalConfig } from 'payload'

/**
 * PickupLocations Global
 * 
 * Manages store pickup locations for in-store pickup shipping method.
 * Allows customers to select a pickup location during checkout instead of shipping.
 */
export const PickupLocations: GlobalConfig = {
  slug: 'pickup-locations',
  label: 'Pickup Locations',
  admin: {
    group: 'Settings',
    description: 'Manage store locations available for in-store pickup',
  },
  access: {
    read: () => true, // Public - needed for checkout
    update: ({ req: { user } }) => {
      return Boolean(user?.roles?.includes('admin'))
    },
  },
  fields: [
    {
      name: 'locations',
      type: 'array',
      label: 'Pickup Locations',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Location Name',
          admin: {
            description: 'Store name or identifier (e.g., "Downtown Store", "Warehouse")',
          },
        },
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Enabled',
          admin: {
            description: 'Allow customers to select this location for pickup',
          },
        },
        {
          name: 'address',
          type: 'group',
          label: 'Address',
          fields: [
            {
              name: 'line1',
              type: 'text',
              required: true,
              label: 'Address Line 1',
            },
            {
              name: 'line2',
              type: 'text',
              label: 'Address Line 2',
            },
            {
              name: 'city',
              type: 'text',
              required: true,
              label: 'City',
            },
            {
              name: 'province',
              type: 'text',
              required: true,
              label: 'Province',
              admin: {
                description: 'Two-letter province code (e.g., BC, ON)',
              },
            },
            {
              name: 'postalCode',
              type: 'text',
              required: true,
              label: 'Postal Code',
            },
            {
              name: 'country',
              type: 'text',
              required: true,
              defaultValue: 'CA',
              label: 'Country',
            },
          ],
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Phone Number',
          admin: {
            description: 'Contact number for the pickup location',
          },
        },
        {
          name: 'hours',
          type: 'textarea',
          label: 'Pickup Hours',
          admin: {
            description: 'Store hours or pickup availability (e.g., "Mon-Fri: 9am-5pm")',
          },
        },
        {
          name: 'instructions',
          type: 'textarea',
          label: 'Pickup Instructions',
          admin: {
            description: 'Special instructions for customers (e.g., "Enter through side door")',
          },
        },
        {
          name: 'displayOrder',
          type: 'number',
          label: 'Display Order',
          defaultValue: 0,
          admin: {
            description: 'Lower numbers appear first in the list',
          },
        },
      ],
    },
  ],
}
