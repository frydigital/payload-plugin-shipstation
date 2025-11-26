import type { Endpoint } from 'payload'

/**
 * Validate Address Endpoint
 * POST /api/shipping/validate-address
 * 
 * Validates a shipping address using ShipStation V1 API
 * https://www.shipstation.com/docs/api/addresses/validate-an-address/
 */
export const validateAddressHandler: Endpoint['handler'] = async (req) => {
  try {
    const body = req.json ? await req.json() : req.body
    const { address } = body as any

    if (!address || !address.street1 && !address.line1 || !address.city || !address.state && !address.province || !address.postalCode || !address.country) {
      return Response.json({
        error: 'Invalid request: complete address required (street1/line1, city, state/province, postalCode, country)',
      }, { status: 400 })
    }

    const client = (req.payload as any).shipStationClient

    if (!client) {
      return Response.json({
        error: 'ShipStation client not initialized',
      }, { status: 500 })
    }

    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    if (!shippingSettings?.enableValidation) {
      return Response.json({
        validated: false,
        message: 'Address validation is not enabled',
        address: address,
      })
    }

    // Normalize address fields for V1 API
    const v1Address = {
      name: address.name,
      company: address.company,
      street1: address.street1 || address.line1 || address.addressLine1,
      street2: address.street2 || address.line2 || address.addressLine2,
      city: address.city,
      state: address.state || address.province,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      residential: address.residential,
    }

    const result = await client.validateAddress(v1Address)

    const validationMode = shippingSettings.validationMode || 'suggest'
    const failOnInvalid = shippingSettings.failOnInvalidAddress || false

    if (!result.isValid && failOnInvalid) {
      return Response.json({
        error: 'Invalid address',
        validated: false,
        errors: result.errors,
        warnings: result.warnings,
      }, { status: 400 })
    }

    return Response.json({
      validated: result.isValid,
      originalAddress: address,
      normalizedAddress: result.normalizedAddress,
      warnings: result.warnings,
      errors: result.errors,
      mode: validationMode,
    })
  } catch (err) {
    const error = err as Error
    req.payload.logger.error(`Address validation error: ${error.message}`)
    return Response.json({
      error: error.message || 'Failed to validate address',
    }, { status: 500 })
  }
}
