import crypto from 'crypto'
import type { Endpoint } from 'payload'
import type { WebhookEvent } from '../types'

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')
  // Convert to Uint8Array for TypeScript compatibility
  const signatureBuffer = new Uint8Array(Buffer.from(signature))
  const expectedBuffer = new Uint8Array(Buffer.from(expectedSignature))
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

export const webhooksHandler: Endpoint['handler'] = async (req) => {
  try {
    const signature = req.headers.get('x-shipstation-signature') || ''
    const requestBody = req.json ? await req.json() : req.body
    const rawBody = JSON.stringify(requestBody)

    const config = req.payload.config as any
    const pluginOptions = config.shipStationPlugin

    if (!pluginOptions) {
      return Response.json({ error: 'ShipStation plugin not configured' }, { status: 500 })
    }

    const shippingSettings = await req.payload.findGlobal({
      slug: 'shipping-settings',
    })

    const webhookSecret = shippingSettings?.webhookSecret || pluginOptions.webhookSecret

    if (!webhookSecret) {
      req.payload.logger.warn('Webhook received but no secret configured')
      return Response.json({ error: 'Webhook secret not configured' }, { status: 400 })
    }

    if (signature && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      req.payload.logger.warn('Invalid webhook signature')
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = requestBody as WebhookEvent

    const enabledEvents = shippingSettings?.enabledWebhookEvents || []
    if (enabledEvents.length > 0 && !enabledEvents.includes(event.eventType)) {
      req.payload.logger.info(`Webhook event ${event.eventType} not enabled, ignoring`)
      return Response.json({ received: true, processed: false })
    }

    switch (event.eventType) {
      case 'shipment.created':
      case 'label.created':
        req.payload.logger.info(`Received ${event.eventType} event`)
        break
      case 'tracking.updated':
      case 'tracking.delivered':
      case 'tracking.exception':
        req.payload.logger.info(`Received tracking event: ${event.eventType}`)
        break
      default:
        req.payload.logger.info(`Unknown webhook event type: ${event.eventType}`)
    }

    return Response.json({ received: true, processed: true })
  } catch (err) {
    const error = err as Error
    req.payload.logger.error(`Webhook processing error: ${error.message}`)
    return Response.json({
      error: error.message || 'Failed to process webhook',
    }, { status: 500 })
  }
}
