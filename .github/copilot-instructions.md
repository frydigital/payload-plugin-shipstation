# ShipStation Payload Plugin - AI Coding Instructions

## What This Plugin Is

This is a **[Payload CMS v3 plugin](https://payloadcms.com/docs/plugins/overview)** that integrates with the **[ShipStation API](https://docs.shipstation.com/getting-started)** to provide comprehensive shipping functionality for ecommerce projects.

### Payload Plugin Architecture
Payload plugins extend the CMS by returning a configuration function that modifies the incoming config object. Plugins can:
- Add/modify collections, globals, and fields
- Register custom endpoints and hooks
- Inject custom React components in the admin UI
- Store runtime instances via the `payload` object

See: https://payloadcms.com/docs/plugins/overview

### ShipStation API Integration
The plugin wraps ShipStation's REST API for:
- **Rate Calculation**: GET `/carriers/{carrierCode}/services/{serviceCode}/rates`
- **Address Validation**: POST `/addresses/validate`
- **Label Creation**: POST `/shipments/createlabel`
- **Tracking**: GET `/shipments/{shipmentId}`
- **Webhooks**: Receive events for shipment status updates

See: https://docs.shipstation.com/getting-started

## Architecture Overview

The plugin follows Payload's plugin architecture pattern:
- Extends existing collections (`products`, `product-variants`, `orders`) with shipping fields
- Adds global configuration (`shipping-settings`)
- Registers custom API endpoints under `/api/shipping/*`
- Stores runtime instances in `payload.shipStationClient` and `payload.shipStationCache`

## Core Components

### Plugin Initialization (`src/index.ts`)
The main export `shipStationPlugin()` returns a Payload plugin function that:
1. Validates required `apiKey` and `warehouseId` options
2. Stores plugin config in `config.shipStationPlugin` for endpoint access
3. Extends collections with `getProductsOverride()`, `getVariantsOverride()`, `getOrdersOverride()`
4. Registers endpoints via `getShippingEndpoints()`
5. Initializes `ShipStationClient` and `RateCache` in `onInit` hook, attaching them to the payload instance

### Collection Extensions (`src/collections/`)
Each override function returns `Partial<CollectionConfig>` with additional fields:
- **Products/Variants**: `shippingDetails.weight`, `dimensions`, `shippingClass`, `requiresSignature`
- **Orders**: `shippingDetails.shippingStatus`, `trackingNumber`, `carrierCode`, `labelId`, `shipstationShipmentId`, timestamps
  - Includes `afterChange` hook for auto-creating shipments when order status changes to 'processing'
  - Only processes orders with `shippingMethod: 'shipping'` (skips pickup orders)
  - On failure, sets status to 'manual_review' for admin intervention

These are merged into existing collection configs, NOT replacing them.

### API Endpoints (`src/endpoints/`)
All endpoints follow Payload's `Endpoint['handler']` signature returning `Response.json()`:
- **POST `/shipping/calculate-rates`**: Calculates shipping rates from cart items, checks free shipping thresholds
- **POST `/shipping/validate-address`**: Validates/corrects addresses via ShipStation
- **POST `/shipping/create-shipment`**: Creates a shipment in ShipStation for a Payload order (manual trigger)
- **POST `/shipping/webhooks`**: Handles ShipStation webhook events with HMAC signature verification

Access the client via `(req.payload as any).shipStationClient` since TypeScript doesn't know about the custom property.

### ShipStation API Client (`src/api/shipstation.ts`)
Singleton client stored in `payload.shipStationClient` with methods:
- `getRates()`: Fetch carrier rates for shipment (ShipStation: `/carriers/{carrierCode}/services/{serviceCode}/rates`)
- `validateAddress()`: Address validation/correction (ShipStation: `/addresses/validate`)
- **`createShipment()`**: Create shipment in ShipStation (ShipStation: `POST /v2/shipments`)
- **`getShipment()`**: Retrieve shipment details (ShipStation: `GET /v2/shipments/{shipment_id}`)
- **`cancelShipment()`**: Cancel pending shipment (ShipStation: `POST /v2/shipments/{shipment_id}/cancel`)
- `createLabel()`, `voidLabel()`: Label management - Phase 2 placeholders (ShipStation: `/labels/*`)
- Uses `baseUrl` based on `sandboxMode` flag
  - Production: `https://ssapi.shipstation.com`
  - Sandbox: `https://ssapi-sandbox.shipstation.com`
- Implements exponential backoff retry logic (max 3 retries on 5xx errors)
- Uses `makeRequest()` helper with proper error handling

**Authentication**: Uses Basic Auth with API Key (Base64 encoded in Authorization header)

### Rate Caching (`src/utilities/cache.ts`)
Dual-strategy caching with `RateCache` interface:
- **RedisCache**: Uses ioredis with `shipstation:rate:` key prefix
- **InMemoryCache**: Fallback with Map-based TTL expiration
- Initialize via `createRateCache()` and store in `payload.shipStationCache`

## Development Patterns

### Type Safety with Custom Payload Properties
The plugin extends Payload's runtime but TypeScript doesn't know about custom properties:
```typescript
// Access plugin config
const pluginOptions = (req.payload.config as any).shipStationPlugin

// Access client
const client = (req.payload as any).shipStationClient

// Access cache
const cache = (req.payload as any).shipStationCache
```

### Monetary Values Convention
All prices/rates use **cents (integer)** not dollars:
- `freeShippingThreshold: 10000` = $100.00 CAD
- `baseRate: 1200` = $12.00 CAD
- Convert in UI layer, store as integers

### Canadian Provincial Rates
Plugin has special handling for Canadian provinces via `provincialRates` array:
```typescript
{ province: 'ON', baseRate: 1000, enabled: true }
```
All 13 provinces/territories supported (BC, AB, SK, MB, ON, QC, NB, NS, PE, NL, YT, NT, NU).

### Weight & Dimensions
Structured with explicit units:
```typescript
weight: { value: 1.5, unit: 'kg' }
dimensions: { length: 10, width: 8, height: 5, unit: 'cm' }
```
Supported: `kg|g|lb|oz` for weight, `cm|m|in|ft` for dimensions.

### Endpoint Error Handling
Always return proper HTTP status codes:
```typescript
return Response.json({ error: 'message' }, { status: 400 })
```
Log errors with `req.payload.logger.error()` for debugging.

## Build & Development

### Scripts
- **`pnpm build`**: Compile TypeScript to `dist/` (commonjs)
- **`pnpm dev`**: Watch mode for local development
- **`pnpm clean`**: Remove `dist/` folder

### Output Format
Plugin is **commonjs** (`type: "commonjs"` in package.json), targeting ES2022 with Node.js compatibility.

### Testing
Tests live in separate `dev/` directory (excluded from build). Run via `cd dev && pnpm test`.

## Phase 2 Features (Not Implemented)
These config options exist but are placeholders:
- `internationalShipping`: International shipping with customs forms
- `carrierAccounts`: Multi-carrier account management  
- `analytics`: Shipping performance tracking

Log warnings in `onInit` if these are configured but don't implement functionality yet.

## Shipment Creation Workflow

### Auto-Creation on Order Status Change
When `autoCreateShipments` is enabled in plugin config:
1. Order status changes to 'processing' triggers `afterChange` hook
2. Hook validates order is for shipping (not pickup)
3. Calls `createShipmentForOrder()` utility helper
4. Maps order data to ShipStation format (items, addresses, weights)
5. Creates shipment via `POST /v2/shipments`
6. Updates order with `shipstationShipmentId` and status 'processing'
7. On failure, marks order as 'manual_review'

### Manual Creation via Endpoint
Call `POST /api/shipping/create-shipment` with `{ orderId: string }`:
- Uses same `createShipmentForOrder()` utility
- Returns shipment details or error with manual_review status
- Merchant can trigger from admin UI or external system

### Warehouse Address Configuration
Shipment creation uses the warehouse ID from `SHIPSTATION_WAREHOUSE_ID` environment variable (or plugin config fallback) to automatically populate the ship-from address. ShipStation maintains the warehouse address details internally.

### Shipment Status Flow
1. **pending**: Shipment created in ShipStation, awaiting label purchase
2. **processing**: Shipment active, ready for fulfillment
3. **shipped**: Label purchased, tracking active (Phase 2)
4. **manual_review**: Auto-creation failed, requires admin intervention

## Common Tasks

### Adding a New Endpoint
1. Create handler in `src/endpoints/myEndpoint.ts` with signature `Endpoint['handler']`
2. Add to `getShippingEndpoints()` array in `src/endpoints/index.ts`
3. Access plugin resources via `(req.payload as any).shipStationClient`

### Adding Collection Fields
1. Modify appropriate override in `src/collections/`
2. Return new fields in `Partial<CollectionConfig>` format
3. Fields are merged, not replaced - always append to existing

### Extending Types
All types in `src/types/index.ts` are exported from main `src/index.ts` via `export * from './types'`.

### Creating Shipment Utilities
Shared logic lives in `src/utilities/createShipmentForOrder.ts`:
- Maps Payload order → ShipStation shipment request
- Handles validation and error states
- Reusable by both endpoint and hooks

### Webhook Signature Verification
Uses HMAC-SHA256 with `crypto.timingSafeEqual()` for timing-safe comparison. Secret from `shippingSettings.webhookSecret` or plugin config.

ShipStation sends webhooks to `/api/shipping/webhooks` with signature in `x-shipstation-signature` header. Supported events:
- `shipment.created`, `label.created`
- `tracking.updated`, `tracking.delivered`, `tracking.exception`

## Plugin Development Best Practices

### Following Payload Plugin Conventions
1. **Export a function** that returns `(incomingConfig: Config): Config`
2. **Never mutate** the incoming config - always spread/clone first
3. **Preserve existing config** - use spread operator when adding collections/endpoints
4. **Type safety**: Use `Partial<CollectionConfig>` for overrides, merge fields carefully
5. **Runtime initialization**: Use `onInit` hook to instantiate services, not at module level

### ShipStation API Best Practices
1. **Rate Limiting**: ShipStation allows 40 requests/minute - implement retry logic with exponential backoff
2. **Error Handling**: ShipStation returns detailed error codes - map them to user-friendly messages
3. **Sandbox Mode**: Always test with sandbox environment first (separate API keys required)
4. **Webhooks**: Verify signatures before processing to prevent spoofing
5. **Caching**: Cache rate quotes (60-300s TTL) to reduce API calls and improve performance
