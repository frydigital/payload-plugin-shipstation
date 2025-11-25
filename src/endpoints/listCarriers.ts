import type { Endpoint } from 'payload'

/**
 * List Carriers Endpoint
 * GET /api/shipping/carriers
 * 
 * Returns all carriers connected to the ShipStation account
 * with their carrier IDs, codes, names, and available services
 */
export const listCarriersHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    req.payload.logger.info('Fetching carriers from ShipStation...')
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
 * GET /api/shipping/carriers/:carrierId
 * 
 * Returns detailed information about a specific carrier
 * including available services, packages, and options
 */
export const getCarrierHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    // Extract carrier ID from URL path
    const url = new URL(req.url || 'http://localhost')
    const pathParts = url.pathname.split('/')
    const carrierId = pathParts[pathParts.length - 1]

    if (!carrierId) {
      return Response.json({
        error: 'Carrier ID is required',
      }, { status: 400 })
    }

    req.payload.logger.info(`Fetching carrier details for ${carrierId}...`)
    const carrier = await client.getCarrier(carrierId)

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
 * GET /api/shipping/carriers/:carrierId/services
 * 
 * Returns available services for a specific carrier
 */
export const listCarrierServicesHandler: Endpoint['handler'] = async (req) => {
  try {
    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    // Extract carrier ID from URL path
    const url = new URL(req.url || 'http://localhost')
    const pathParts = url.pathname.split('/')
    // Path is /api/shipping/carriers/:carrierId/services
    const carrierIdIndex = pathParts.indexOf('carriers') + 1
    const carrierId = pathParts[carrierIdIndex]

    if (!carrierId) {
      return Response.json({
        error: 'Carrier ID is required',
      }, { status: 400 })
    }

    req.payload.logger.info(`Fetching services for carrier ${carrierId}...`)
    const services = await client.listCarrierServices(carrierId)

    return Response.json({
      carrier_id: carrierId,
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
