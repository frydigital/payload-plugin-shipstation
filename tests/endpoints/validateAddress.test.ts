/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateAddressHandler } from '../../src/endpoints/validateAddress'
import { createMockPayload, createMockRequest, createMockShipStationClient } from '../testUtils'

describe('validateAddress endpoint', () => {
  let mockPayload: any
  let mockClient: any
  let mockReq: any

  beforeEach(() => {
    mockPayload = createMockPayload()
    mockClient = createMockShipStationClient()
    mockPayload.shipStationClient = mockClient

    vi.clearAllMocks()
  })

  describe('success cases', () => {
    it('should validate address successfully', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockResolvedValue({
        enableValidation: true,
        validationMode: 'suggest',
        failOnInvalidAddress: false,
      })

      mockClient.validateAddress.mockResolvedValue({
        isValid: true,
        normalizedAddress: {
          street1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B 1A1',
          country: 'CA',
        },
        warnings: [],
        errors: [],
      })

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(200)
      expect(jsonData.validated).toBe(true)
      expect(jsonData.normalizedAddress).toBeDefined()
    })

    it('should return original address if validation disabled', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockResolvedValue({
        enableValidation: false,
      })

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(200)
      expect(jsonData.validated).toBe(false)
      expect(jsonData.message).toContain('validation is not enabled')
      expect(jsonData.address).toEqual(requestBody.address)
    })

    it('should handle warnings gracefully', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockResolvedValue({
        enableValidation: true,
        validationMode: 'suggest',
        failOnInvalidAddress: false,
      })

      mockClient.validateAddress.mockResolvedValue({
        isValid: true,
        normalizedAddress: {
          street1: '123 Main St',
          city: 'Vancouver',
          state: 'BC',
          postalCode: 'V6B 1A1',
          country: 'CA',
        },
        warnings: ['Address is valid but could be more specific'],
        errors: [],
      })

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(200)
      expect(jsonData.validated).toBe(true)
      expect(jsonData.warnings).toHaveLength(1)
    })
  })

  describe('validation errors', () => {
    it('should return 400 if address is missing', async () => {
      const requestBody = {}
      mockReq = createMockRequest(requestBody, mockPayload)

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(400)
      expect(jsonData.error).toContain('complete address required')
    })

    it('should return 400 if address fields are incomplete', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          // Missing city, province, postalCode, country
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(400)
      expect(jsonData.error).toContain('complete address required')
    })

    it('should return 500 if client not initialized', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockPayload.shipStationClient = null
      mockReq = createMockRequest(requestBody, mockPayload)

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.error).toContain('ShipStation client not initialized')
    })
  })

  describe('invalid address handling', () => {
    it('should return error if failOnInvalid is true and address invalid', async () => {
      const requestBody = {
        address: {
          line1: 'Invalid Address',
          city: 'NowhereCity',
          province: 'XX',
          postalCode: '00000',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockResolvedValue({
        enableValidation: true,
        validationMode: 'suggest',
        failOnInvalidAddress: true,
      })

      mockClient.validateAddress.mockResolvedValue({
        isValid: false,
        normalizedAddress: null,
        warnings: [],
        errors: ['Address not found'],
      })

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(400)
      expect(jsonData.validated).toBe(false)
      expect(jsonData.errors).toContain('Address not found')
    })

    it('should return warnings but not error if failOnInvalid is false', async () => {
      const requestBody = {
        address: {
          line1: 'Ambiguous Address',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockResolvedValue({
        enableValidation: true,
        validationMode: 'suggest',
        failOnInvalidAddress: false,
      })

      mockClient.validateAddress.mockResolvedValue({
        isValid: false,
        normalizedAddress: null,
        warnings: ['Could not verify address'],
        errors: [],
      })

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(200)
      expect(jsonData.validated).toBe(false)
      expect(jsonData.warnings).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      const requestBody = {
        address: {
          line1: '123 Main St',
          city: 'Vancouver',
          province: 'BC',
          postalCode: 'V6B1A1',
          country: 'CA',
        },
      }
      mockReq = createMockRequest(requestBody, mockPayload)

      mockPayload.findGlobal.mockRejectedValue(new Error('Database error'))

      const response = await validateAddressHandler(mockReq)
      const jsonData = await response.json()

      expect(response.status).toBe(500)
      expect(jsonData.error).toBeDefined()
      expect(mockPayload.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Address validation error')
      )
    })
  })
})
