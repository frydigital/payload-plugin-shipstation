/**
 * Mock data for testing
 * Updated for ShipStation V1 API
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

// V1 API Order Request format (POST /orders/createorder)
export const mockShipStationV1OrderRequest = {
  orderNumber: 'order_123',
  orderKey: 'order_123',
  orderDate: '2025-11-23T10:00:00',
  orderStatus: 'awaiting_shipment' as const,
  shipTo: {
    name: 'John Doe',
    company: 'Test Company',
    street1: '123 Main St',
    street2: 'Suite 100',
    city: 'Vancouver',
    state: 'BC',
    postalCode: 'V6B1A1',
    country: 'CA',
    phone: '604-555-0100',
    residential: true,
  },
  items: [
    {
      name: 'Test Product 1',
      sku: 'TEST-001',
      quantity: 2,
      unitPrice: 50.00, // V1 uses dollars not cents
      weight: {
        value: 1500, // V1 uses grams for kg conversion
        units: 'grams' as const,
      },
    },
  ],
  amountPaid: 150.00, // V1 uses dollars not cents
  shippingAmount: 12.00,
  customerNotes: 'Please handle with care',
  carrierCode: 'canada_post',
  serviceCode: 'expedited',
  advancedOptions: {
    warehouseId: 123,
  },
}

// V1 API Order Response format
export const mockShipStationV1OrderResponse = {
  orderId: 123456789,
  orderNumber: 'order_123',
  orderKey: 'order_123',
  orderDate: '2025-11-23T10:00:00',
  createDate: '2025-11-23T10:00:00',
  modifyDate: '2025-11-23T10:00:00',
  orderStatus: 'awaiting_shipment',
  shipTo: {
    name: 'John Doe',
    company: 'Test Company',
    street1: '123 Main St',
    street2: 'Suite 100',
    city: 'Vancouver',
    state: 'BC',
    postalCode: 'V6B1A1',
    country: 'CA',
    phone: '604-555-0100',
    residential: true,
  },
  items: [
    {
      name: 'Test Product 1',
      sku: 'TEST-001',
      quantity: 2,
    },
  ],
  orderTotal: 162.00,
  amountPaid: 150.00,
  shippingAmount: 12.00,
  carrierCode: 'canada_post',
  serviceCode: 'expedited',
}

// Legacy V2 mock request (kept for backward compatibility)
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

// Legacy V2 mock response (kept for backward compatibility)
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

// V1 API Shipment format (from GET /shipments)
export const mockShipStationV1Shipment = {
  shipmentId: 123456789,
  orderId: 987654321,
  orderNumber: 'order_123',
  createDate: '2025-11-23T10:00:00',
  shipDate: '2025-11-23',
  shipmentCost: 12.00,
  insuranceCost: 0,
  trackingNumber: '1Z999AA10123456784',
  isReturnLabel: false,
  carrierCode: 'canada_post',
  serviceCode: 'expedited',
  packageCode: 'package',
  voided: false,
  marketplaceNotified: false,
  shipTo: {
    name: 'John Doe',
    company: 'Test Company',
    street1: '123 Main St',
    street2: 'Suite 100',
    city: 'Vancouver',
    state: 'BC',
    postalCode: 'V6B1A1',
    country: 'CA',
    phone: '604-555-0100',
  },
  weight: {
    value: 3.5,
    units: 'pounds' as const,
  },
}

// Legacy V2 mock (kept for backward compatibility)
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

// V1 API Rates Response format (array of rates)
export const mockShipStationV1RatesResponse = [
  {
    serviceName: 'Canada Post Expedited',
    serviceCode: 'expedited',
    shipmentCost: 12.00,
    otherCost: 0,
  },
  {
    serviceName: 'Canada Post Regular',
    serviceCode: 'regular',
    shipmentCost: 8.00,
    otherCost: 0,
  },
]

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

// V1 API Carriers Response format (array of carriers)
export const mockShipStationV1CarriersResponse = [
  {
    name: 'FedEx',
    code: 'fedex',
    accountNumber: '12345',
    requiresFundedAccount: false,
    balance: 0,
  },
  {
    name: 'USPS',
    code: 'stamps_com',
    accountNumber: '67890',
    requiresFundedAccount: true,
    balance: 100.00,
  },
]

// V1 API Services Response format (array of services)
export const mockShipStationV1ServicesResponse = [
  {
    carrierCode: 'fedex',
    code: 'fedex_ground',
    name: 'FedEx Ground',
    domestic: true,
    international: false,
  },
  {
    carrierCode: 'fedex',
    code: 'fedex_2day',
    name: 'FedEx 2Day',
    domestic: true,
    international: false,
  },
]

// V1 API Validate Address Response
export const mockShipStationV1ValidateAddressResponse = {
  valid: true,
  address: {
    name: 'John Doe',
    company: 'Test Company',
    street1: '123 MAIN ST',
    street2: 'STE 100',
    city: 'VANCOUVER',
    state: 'BC',
    postalCode: 'V6B 1A1',
    country: 'CA',
    phone: '604-555-0100',
    residential: true,
  },
  messages: [],
}

export const mockPluginOptions = {
  apiKey: 'TEST_API_KEY:TEST_API_SECRET',
  warehouseId: '123',
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
