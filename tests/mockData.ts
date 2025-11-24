/**
 * Mock data for testing
 */

export const mockOrder = {
  id: 'order_123',
  status: 'processing',
  shippingMethod: 'shipping',
  total: 15000, // $150.00 CAD
  customerNotes: 'Please handle with care',
  shippingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Test Company',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 100',
    city: 'Vancouver',
    state: 'BC',
    postalCode: 'V6B1A1',
    country: 'CA',
    phone: '604-555-0100',
  },
  selectedRate: {
    serviceName: 'Canada Post Expedited',
    serviceCode: 'expedited',
    carrierCode: 'canada_post',
    cost: 1200, // $12.00 CAD
    currency: 'CAD',
  },
  items: [
    {
      quantity: 2,
      price: 5000,
      product: {
        id: 'prod_1',
        title: 'Test Product 1',
        sku: 'TEST-001',
        shippingDetails: {
          weight: {
            value: 1.5,
            unit: 'kg',
          },
          dimensions: {
            length: 10,
            width: 8,
            height: 5,
            unit: 'cm',
          },
        },
      },
      variant: null,
    },
    {
      quantity: 1,
      price: 5000,
      product: {
        id: 'prod_2',
        title: 'Test Product 2',
        sku: 'TEST-002',
        shippingDetails: {
          weight: {
            value: 0.5,
            unit: 'kg',
          },
        },
      },
      variant: null,
    },
  ],
  shippingDetails: {},
}

export const mockOrderWithVariant = {
  ...mockOrder,
  id: 'order_456',
  items: [
    {
      quantity: 1,
      price: 10000,
      product: {
        id: 'prod_3',
        title: 'Variable Product',
        sku: 'VAR-001',
        shippingDetails: {
          weight: {
            value: 2.0,
            unit: 'kg',
          },
        },
      },
      variant: {
        id: 'var_1',
        title: 'Blue - Large',
        sku: 'VAR-001-BL-L',
        shippingDetails: {
          weight: {
            value: 2.5,
            unit: 'kg',
          },
        },
      },
    },
  ],
}

export const mockOrderNoWeight = {
  ...mockOrder,
  id: 'order_789',
  items: [
    {
      quantity: 1,
      price: 5000,
      product: {
        id: 'prod_4',
        title: 'Product Without Weight',
        sku: 'TEST-003',
        shippingDetails: {},
      },
      variant: null,
    },
  ],
}

export const mockPickupOrder = {
  ...mockOrder,
  id: 'order_pickup_1',
  shippingMethod: 'pickup',
  pickupLocation: 'Downtown Store',
}

export const mockOrderInvalidAddress = {
  ...mockOrder,
  id: 'order_invalid',
  shippingAddress: {
    firstName: 'Jane',
    lastName: 'Smith',
    addressLine1: '', // Missing required field
    city: '',
    state: 'BC',
    postalCode: 'V6B1A1',
    country: 'CA',
  },
}

export const mockShipStationRequest = {
  shipments: [
    {
      external_shipment_id: 'order_123',
      warehouse_id: 'se-warehouse-123',
      validate_address: 'validate_and_clean' as const,
      shipment_status: 'pending' as const,
      ship_to: {
        name: 'John Doe',
        address_line1: '123 Main St',
        city_locality: 'Vancouver',
        state_province: 'BC',
        postal_code: 'V6B1A1',
        country_code: 'CA',
        phone: '604-555-0100',
      },
      items: [
        {
          name: 'Test Product 1',
          sku: 'TEST-001',
          quantity: 2,
        },
      ],
      packages: [
        {
          weight: {
            value: 3,
            unit: 'kilogram' as const,
          },
        },
      ],
    },
  ],
}

export const mockShipStationSuccessResponse = {
  shipments: [
    {
      shipment_id: 'se-123456789',
      external_shipment_id: 'order_123',
      shipment_number: 'SH-00001',
      shipment_status: 'pending',
      created_at: '2025-11-23T10:00:00Z',
      modified_at: '2025-11-23T10:00:00Z',
      errors: [],
    },
  ],
}

export const mockShipStationErrorResponse = {
  shipments: [
    {
      shipment_id: 'se-error',
      external_shipment_id: 'order_123',
      errors: [
        {
          message: 'Invalid address',
          error_code: 'INVALID_ADDRESS',
        },
      ],
    },
  ],
}

export const mockShipStationGetResponse = {
  shipment_id: 'se-123456789',
  external_shipment_id: 'order_123',
  shipment_number: 'SH-00001',
  carrier_id: 'se-carrier-123',
  service_code: 'expedited',
  shipment_status: 'pending',
  ship_to: {
    name: 'John Doe',
    address_line1: '123 Main St',
    city_locality: 'Vancouver',
    state_province: 'BC',
    postal_code: 'V6B1A1',
    country_code: 'CA',
  },
  items: [],
  packages: [],
  created_at: '2025-11-23T10:00:00Z',
  modified_at: '2025-11-23T10:00:00Z',
}

export const mockRates = [
  {
    rateId: 'rate_1',
    serviceName: 'Canada Post Expedited',
    serviceCode: 'expedited',
    carrierCode: 'canada_post',
    cost: 1200,
    currency: 'CAD',
    estimatedDeliveryDays: 2,
    rateType: 'shipment' as const,
  },
  {
    rateId: 'rate_2',
    serviceName: 'Canada Post Regular',
    serviceCode: 'regular',
    carrierCode: 'canada_post',
    cost: 800,
    currency: 'CAD',
    estimatedDeliveryDays: 5,
    rateType: 'shipment' as const,
  },
]

export const mockPluginOptions = {
  apiKey: 'TEST_API_KEY',
  warehouseId: 'se-warehouse-123',
  enabledFeatures: {
    addressValidation: true,
    multiPackage: false,
    autoCreateShipments: true,
    webhooks: true,
  },
  provincialRates: [
    { province: 'BC' as const, baseRate: 1200, enabled: true },
    { province: 'ON' as const, baseRate: 1000, enabled: true },
  ],
  freeShippingConfig: {
    threshold: 10000,
    eligibleCountries: ['CA'],
  },
}
