import { vi } from 'vitest'
import type { Payload } from 'payload'
import type { ShipStationClient } from '../src/api/shipstation'

/**
 * Create a mock Payload instance
 */
export function createMockPayload(overrides: Partial<Payload> = {}): Payload {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    findByID: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    find: vi.fn(),
    findGlobal: vi.fn(),
    updateGlobal: vi.fn(),
    config: {
      shipStationPlugin: {},
    },
    ...overrides,
  } as unknown as Payload
}

/**
 * Create a mock ShipStation client
 */
export function createMockShipStationClient(
  overrides: Partial<ShipStationClient> = {}
): ShipStationClient {
  return {
    createShipment: vi.fn(),
    getShipment: vi.fn(),
    cancelShipment: vi.fn(),
    getRates: vi.fn(),
    validateAddress: vi.fn(),
    createLabel: vi.fn(),
    voidLabel: vi.fn(),
    getTracking: vi.fn(),
    ...overrides,
  } as unknown as ShipStationClient
}

/**
 * Create a mock Request object for endpoint testing
 */
export function createMockRequest(
  body: any,
  payload: Payload,
  headers: Record<string, string> = {}
): any {
  return {
    json: async () => body,
    body,
    payload,
    headers: {
      get: (key: string) => headers[key] || null,
    },
  }
}

/**
 * Mock environment variables
 */
export function mockEnv(vars: Record<string, string>) {
  const originalEnv = { ...process.env }

  // Set mock env vars
  Object.assign(process.env, vars)

  // Return cleanup function
  return () => {
    process.env = originalEnv
  }
}

/**
 * Mock fetch for ShipStation API calls
 */
export function createMockFetch(responses: Record<string, any> = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method || 'GET'
    const key = `${method} ${url}`

    if (responses[key]) {
      const response = responses[key]

      if (response.error) {
        return {
          ok: false,
          status: response.status || 500,
          statusText: response.statusText || 'Internal Server Error',
          text: async () => JSON.stringify(response.error),
          json: async () => response.error,
        }
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => response,
      }
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Not Found',
      json: async () => ({ error: 'Not Found' }),
    }
  })
}
