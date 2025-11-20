import type { ShipStationRate } from '../types'

export interface RateCache {
  get(key: string): Promise<ShipStationRate[] | null>
  set(key: string, rates: ShipStationRate[], ttl: number): Promise<void>
  invalidate(key: string): Promise<void>
  clear(): Promise<void>
}

class InMemoryCache implements RateCache {
  private cache: Map<string, { data: ShipStationRate[]; expires: number }> = new Map()

  async get(key: string): Promise<ShipStationRate[] | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  async set(key: string, rates: ShipStationRate[], ttl: number): Promise<void> {
    this.cache.set(key, {
      data: rates,
      expires: Date.now() + ttl * 1000,
    })
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
      }
    }
  }
}

class RedisCache implements RateCache {
  private redis: any
  private keyPrefix = 'shipstation:rate:'

  constructor(redis: any) {
    this.redis = redis
  }

  async get(key: string): Promise<ShipStationRate[] | null> {
    try {
      const data = await this.redis.get(this.keyPrefix + key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  }

  async set(key: string, rates: ShipStationRate[], ttl: number): Promise<void> {
    try {
      await this.redis.setex(this.keyPrefix + key, ttl, JSON.stringify(rates))
    } catch (error) {
      console.error('Redis set error:', error)
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(this.keyPrefix + key)
    } catch (error) {
      console.error('Redis invalidate error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(this.keyPrefix + '*')
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      console.error('Redis clear error:', error)
    }
  }
}

export async function createRateCache(config: {
  redisUrl?: string
  enableCache?: boolean
}): Promise<RateCache> {
  if (!config.enableCache) {
    return {
      async get() {
        return null
      },
      async set() {},
      async invalidate() {},
      async clear() {},
    }
  }

  if (config.redisUrl) {
    try {
      const Redis = (await import('ioredis')).default
      const redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) {
            console.warn('Redis connection failed, falling back to in-memory cache')
            return null
          }
          return Math.min(times * 50, 2000)
        },
      })

      await redis.ping()
      console.log('âœ… Redis cache connected')

      return new RedisCache(redis)
    } catch (error) {
      console.warn('Redis connection failed, using in-memory cache:', error)
    }
  }

  console.log('í³¦ Using in-memory rate cache')
  const cache = new InMemoryCache()

  setInterval(() => cache.cleanup(), 5 * 60 * 1000)

  return cache
}

export function generateCacheKey(params: {
  shipTo: {
    postalCode: string
    province: string
    country: string
  }
  weight: { value: number; unit: string }
  dimensions?: { length: number; width: number; height: number; unit: string }
  shippingClass?: string
}): string {
  const parts = [
    params.shipTo.postalCode,
    params.shipTo.province,
    params.shipTo.country,
    `${params.weight.value}${params.weight.unit}`,
  ]

  if (params.dimensions) {
    const d = params.dimensions
    parts.push(`${d.length}x${d.width}x${d.height}${d.unit}`)
  }

  if (params.shippingClass) {
    parts.push(params.shippingClass)
  }

  return parts.join(':')
}
