import type { Endpoint } from 'payload'

export const validateAddressHandler: Endpoint['handler'] = async (req) => {
  try {
    const body = req.json ? await req.json() : req.body
    const { address } = body as any

    if (!address || !address.line1 || !address.city || !address.province || !address.postalCode || !address.country) {
      return Response.json({
        error: 'Invalid request: complete address required',
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

    if (!shippingSettings?.addressValidation?.enableValidation) {
      return Response.json({
        validated: false,
        message: 'Address validation is not enabled',
        address: address,
      })
    }

    const result = await client.validateAddress({
      street1: address.line1,
      street2: address.line2,
      city: address.city,
      state: address.province,
      postalCode: address.postalCode,
      country: address.country,
    })

    const validationMode = shippingSettings.addressValidation.validationMode || 'suggest'
    const failOnInvalid = shippingSettings.addressValidation.failOnInvalidAddress || false

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
