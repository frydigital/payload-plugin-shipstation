# @frydigital/payload-plugin-shipstation

A comprehensive ShipStation integration plugin for Payload CMS ecommerce projects. Provides real-time shipping rate calculation, address validation, multi-package handling, and webhook support for tracking updates.

## Features

✅ **Phase 1 (Available Now)**
- 🚚 Real-time shipping rate calculation via ShipStation API
- 🍁 Canadian provincial flat rates (all 13 provinces/territories)
- 📍 Custom shipping zones with postal code pattern matching
- 🎁 Free shipping thresholds with rule-based eligibility
- 📦 Multi-package shipment handling with auto-splitting
- ✅ Address validation and correction
- 🔔 Webhook support for shipment tracking updates
- ⚡ Rate caching (Redis + in-memory fallback)
- 🔐 Secure API credential management

🚧 **Phase 2 (Coming Q1 2026)**
- 🌍 International shipping with customs forms
- 💼 Multi-carrier account management
- 📊 Shipping analytics and performance tracking

## Installation

### 1. Install from GitHub Packages

First, configure npm to use GitHub Packages for the `@frydigital` scope. Create or update `.npmrc`:

```
@frydigital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install the plugin:

```bash
pnpm add @frydigital/payload-plugin-shipstation
# or
npm install @frydigital/payload-plugin-shipstation
# or
yarn add @frydigital/payload-plugin-shipstation
```

### 2. Environment Variables

Add the following to your `.env` file:

```bash
# ShipStation API Configuration
SHIPSTATION_API_KEY=your_shipstation_api_key
SHIPSTATION_WAREHOUSE_ID=se-123456
SHIPSTATION_WEBHOOK_SECRET=your_webhook_secret

# Optional: Redis for rate caching
REDIS_URL=redis://localhost:6379

# Optional: Sandbox mode for development
SHIPSTATION_SANDBOX_MODE=true
```

### 3. Configure Plugin

Add the plugin to your Payload configuration:

```typescript
// payload.config.ts
import { shipStationPlugin } from '@frydigital/payload-plugin-shipstation'

export default buildConfig({
  plugins: [
    // Add after ecommerce plugin
    shipStationPlugin({
      apiKey: process.env.SHIPSTATION_API_KEY!,
      warehouseId: process.env.SHIPSTATION_WAREHOUSE_ID!,
      sandboxMode: process.env.SHIPSTATION_SANDBOX_MODE === 'true',
      
      // Enable features
      enabledFeatures: {
        addressValidation: true,
        multiPackage: true,
        autoCreateShipments: false,
        webhooks: true,
      },
      
      // Canadian provincial rates (in cents)
      provincialRates: [
        { province: 'BC', baseRate: 1200, enabled: true },
        { province: 'AB', baseRate: 1000, enabled: true },
        { province: 'SK', baseRate: 1500, enabled: true },
        { province: 'MB', baseRate: 1500, enabled: true },
        { province: 'ON', baseRate: 1000, enabled: true },
        { province: 'QC', baseRate: 1200, enabled: true },
        { province: 'NB', baseRate: 1500, enabled: true },
        { province: 'NS', baseRate: 1800, enabled: true },
        { province: 'PE', baseRate: 1800, enabled: true },
        { province: 'NL', baseRate: 2000, enabled: true },
        { province: 'YT', baseRate: 2500, enabled: true },
        { province: 'NT', baseRate: 3000, enabled: true },
        { province: 'NU', baseRate: 3500, enabled: true },
      ],
      
      // Free shipping configuration
      freeShippingConfig: {
        threshold: 10000, // $100.00 CAD
        eligibleCountries: ['CA'],
        excludedShippingClasses: ['oversized'],
      },
      
      // Shipping class rate modifiers
      shippingClassModifiers: {
        standard: 1.0,
        expedited: 1.5,
        fragile: 1.3,
        oversized: 2.0,
        custom: 1.0,
      },
      
      // Multi-package limits
      maxPackageWeight: { value: 70, unit: 'pound' },
      maxPackageDimensions: { length: 36, width: 24, height: 24, unit: 'inch' },
      
      // Cache configuration
      cache: {
        enableCache: true,
        cacheTTL: 300, // 5 minutes
        redisUrl: process.env.REDIS_URL,
        fallbackToMemory: true,
      },
      
      // Webhook configuration
      webhookSecret: process.env.SHIPSTATION_WEBHOOK_SECRET,
      enabledWebhookEvents: [
        'tracking.updated',
        'tracking.delivered',
      ],
    }),
  ],
})
```

## Usage

### Calculating Shipping Rates

#### From Frontend/API Route

```typescript
// app/api/calculate-shipping/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { cartId, shippingAddress } = await req.json()
  
  const response = await fetch('/api/shipping/calculate-rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartId, shippingAddress }),
  })
  
  const { rates, freeShipping } = await response.json()
  
  return NextResponse.json({ rates, freeShipping })
}
```

#### Response Format

```typescript
{
  "rates": [
    {
      "rateId": "se-123456",
      "carrierId": "se-789",
      "carrierName": "Canada Post",
      "serviceCode": "canada_post_regular_parcel",
      "serviceType": "Regular Parcel",
      "shippingAmount": { "currency": "CAD", "amount": 12.50 },
      "deliveryDays": 3,
      "estimatedDeliveryDate": "2025-11-23T23:59:00Z",
      "trackable": true
    }
  ],
  "freeShipping": false,
  "appliedRule": "provincial_rate",
  "cacheHit": true
}
```

### Address Validation

```typescript
const response = await fetch('/api/shipping/validate-address', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: {
      addressLine1: '123 Main Street',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5H 2N2',
      country: 'CA',
    },
    mode: 'validate_and_clean',
  }),
})

const { valid, correctedAddress } = await response.json()
```

### Product Shipping Configuration

Add shipping details to your products:

```typescript
// When creating/updating products
await payload.create({
  collection: 'products',
  data: {
    title: 'Widget',
    // ... other product fields
    
    shippingDetails: {
      weight: { value: 2.5, unit: 'pound' },
      dimensions: { length: 12, width: 8, height: 4, unit: 'inch' },
      shippingClass: 'standard',
      requiresSignature: false,
      hazardousMaterials: false,
    },
  },
})
```

## Shipping Zones

Enable custom shipping zones for advanced rate calculations based on postal codes:

1. Enable in Shipping Settings global (Custom Zones tab)
2. Create zones in the Shipping Zones collection
3. Define postal code patterns using regex

### Example: Greater Toronto Area Zone

```typescript
{
  name: 'Greater Toronto Area',
  enabled: true,
  priority: 1,
  postalCodePatterns: ['^M[0-9][A-Z]'], // Toronto postal codes
  countries: ['CA'],
  provinces: ['ON'],
  rateType: 'flat',
  baseRate: 800, // $8.00
  freeShippingThreshold: 5000, // $50.00
}
```

## Webhooks

### Setup in ShipStation

1. Go to Settings > API > Webhooks in ShipStation
2. Add webhook URL: `https://yourdomain.com/api/shipping/shipstation/webhook`
3. Select events: tracking.updated, tracking.delivered
4. Add your webhook secret

### Tracking Updates

The plugin automatically:
- Updates order tracking numbers
- Changes shipment status
- Triggers customer notifications (order_shipped, order_delivered)
- Stores tracking history

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shipping/calculate-rates` | POST | Calculate shipping rates for cart |
| `/api/shipping/validate-address` | POST | Validate and correct address |
| `/api/shipping/estimate` | GET | Quick rate estimate |
| `/api/shipping/shipstation/webhook` | POST | ShipStation webhook handler |

### Collections Extended

- **products** - Adds `shippingDetails` group with weight, dimensions, shipping class
- **variants** - Inherits/overrides product shipping details
- **orders** - Adds `shippingDetails` with tracking info, costs, history

### Globals Added

- **shipping-settings** - Central shipping configuration
- **shipping-zones** (optional) - Custom postal code-based zones

## Development

### Running Tests

```bash
cd packages/payload-plugin-shipstation
pnpm install
pnpm test
```

### Building

```bash
pnpm build
```

### Local Development

Link the plugin locally:

```bash
cd packages/payload-plugin-shipstation
pnpm link

cd ../../
pnpm link @frydigital/payload-plugin-shipstation
```

## Troubleshooting

### Rates Not Calculating

1. Check ShipStation API key is valid
2. Verify warehouse ID exists in ShipStation
3. Check product weights are configured
4. Review Payload logs for errors

### Address Validation Failing

1. Ensure address validation is enabled in settings
2. Check validation mode (validate_only vs validate_and_clean)
3. Verify address format matches ShipStation requirements

### Cache Issues

1. Check Redis connection if configured
2. Verify cache TTL settings
3. Clear cache: Delete Redis keys with pattern `shipstation:rate:*`

### Webhook Not Working

1. Verify webhook secret matches ShipStation
2. Check webhook URL is publicly accessible
3. Review webhook event logs in ShipStation
4. Check Payload logs for webhook processing errors

## Phase 2 Roadmap

### International Shipping (Q1 2026)
- Customs form generation
- HS code management
- Duty calculation integration
- Country restrictions

### Carrier Account Management (Q1 2026)
- Multiple accounts per carrier
- Load balancing strategies
- Account-specific rate calculation
- Warehouse-based account assignment

### Shipping Analytics (Q1 2026)
- Rate request tracking
- Delivery performance metrics
- Carrier comparison insights
- Customer satisfaction tracking

## Contributing

We welcome contributions! Please see our contributing guidelines.

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [Full docs coming soon]
- Issues: [GitHub Issues](https://github.com/frydigital/payload-plugin-shipstation/issues)
- Discussions: [GitHub Discussions](https://github.com/frydigital/cedarroutes/discussions)

## Credits

Built with ❤️ by Cedar Routes for the Payload CMS community.
