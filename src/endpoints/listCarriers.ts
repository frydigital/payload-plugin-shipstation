import type { Endpoint } from 'payload'

/**
 * List Carriers Endpoint
 * GET /api/shipping/carriers
 * 
 * Returns all carriers connected to the ShipStation account
 * Uses V1 API: GET /carriers
 */
export const listCarriersHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    req.payload.logger.info('Fetching carriers from ShipStation V1 API...')
    const carriers = await client.listCarriers()

    req.payload.logger.info(`Found ${carriers.length} carriers`)

    return Response.json({
      carriers,
      count: carriers.length,
    })
  } catch (error) {
    const err = error as Error
    req.payload.logger.error(`Failed to list carriers: ${err.message}`)
    
    return Response.json({
      error: err.message || 'Failed to list carriers',
    }, { status: 500 })
  }
}

/**
 * Get Carrier Details Endpoint
 * GET /api/shipping/carriers/:carrierCode
 * 
 * Returns detailed information about a specific carrier
 * Uses V1 API: GET /carriers/getcarrier?carrierCode={carrierCode}
 * 
 * Note: V1 API uses carrierCode (e.g., 'fedex', 'ups') instead of carrierId
 */
export const getCarrierHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    // Extract carrier code from URL path
    const url = new URL(req.url || 'http://localhost')
    const pathParts = url.pathname.split('/')
    const carrierCode = pathParts[pathParts.length - 1]

    if (!carrierCode) {
      return Response.json({
        error: 'Carrier code is required',
      }, { status: 400 })
    }

    req.payload.logger.info(`Fetching carrier details for ${carrierCode}...`)
    const carrier = await client.getCarrier(carrierCode)

    return Response.json({ carrier })
  } catch (error) {
    const err = error as Error
    req.payload.logger.error(`Failed to get carrier: ${err.message}`)
    
    return Response.json({
      error: err.message || 'Failed to get carrier details',
    }, { status: 500 })
  }
}

/**
 * List Carrier Services Endpoint
 * GET /api/shipping/carriers/:carrierCode/services
 * 
 * Returns available services for a specific carrier
 * Uses V1 API: GET /carriers/listservices?carrierCode={carrierCode}
 */
export const listCarrierServicesHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    // Extract carrier code from URL path
    const url = new URL(req.url || 'http://localhost')
    const pathParts = url.pathname.split('/')
    // Path is /api/shipping/carriers/:carrierCode/services
    const carrierCodeIndex = pathParts.indexOf('carriers') + 1
    const carrierCode = pathParts[carrierCodeIndex]

    if (!carrierCode) {
      return Response.json({
        error: 'Carrier code is required',
      }, { status: 400 })
    }

    req.payload.logger.info(`Fetching services for carrier ${carrierCode}...`)
    const services = await client.listCarrierServices(carrierCode)

    return Response.json({
      carrierCode,
      services,
      count: services.length,
    })
  } catch (error) {
    const err = error as Error
    req.payload.logger.error(`Failed to list carrier services: ${err.message}`)
    
    return Response.json({
      error: err.message || 'Failed to list carrier services',
    }, { status: 500 })
  }
}

/**
 * List Carrier Packages Endpoint
 * GET /api/shipping/carriers/:carrierCode/packages
 * 
 * Returns available package types for a specific carrier
 * Uses V1 API: GET /carriers/listpackages?carrierCode={carrierCode}
 */
export const listCarrierPackagesHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    // Extract carrier code from URL path
    const url = new URL(req.url || 'http://localhost')
    const pathParts = url.pathname.split('/')
    // Path is /api/shipping/carriers/:carrierCode/packages
    const carrierCodeIndex = pathParts.indexOf('carriers') + 1
    const carrierCode = pathParts[carrierCodeIndex]

    if (!carrierCode) {
      return Response.json({
        error: 'Carrier code is required',
      }, { status: 400 })
    }

    req.payload.logger.info(`Fetching packages for carrier ${carrierCode}...`)
    const packages = await client.listCarrierPackages(carrierCode)

    return Response.json({
      carrierCode,
      packages,
      count: packages.length,
    })
  } catch (error) {
    const err = error as Error
    req.payload.logger.error(`Failed to list carrier packages: ${err.message}`)
    
    return Response.json({
      error: err.message || 'Failed to list carrier packages',
    }, { status: 500 })
  }
}
