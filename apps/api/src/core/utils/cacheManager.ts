import { Keyv } from 'keyv';
import { createCache } from 'cache-manager';

// import KeyvRedis from '@keyv/redis'; // Uncomment if using Redis
// import { CacheableMemory } from 'cacheable'; // Uncomment for advanced in-memory caching

/**
 * Basic in-memory cache (default setup)
 * 
 * This cache configuration uses an in-memory store with options for advanced 
 * memory and Redis multi-layer caching. The default TTL is 10 seconds with a 
 * refresh threshold of 3 seconds.
 * 
 * Usage:
 * 
 * // Set a value
 * await cache.set('foo', 'bar');
 * 
 * // Get a value
 * const value = await cache.get('foo');
 * 
 * // Delete a value
 * await cache.del('foo');
 * 
 * // Set a value with TTL
 * await cache.set('foo', 'bar', { ttl: 60000 });
 * 
 * // Wrap a function
 * const wrapped = await cache.wrap('key', () => 'value');
 */
export const cache = createCache({
  ttl: 10000, // default TTL 10 seconds
  refreshThreshold: 3000, // refresh threshold 3 seconds
  stores: [
    new Keyv(), // In-memory store
    // Uncomment below for advanced memory and Redis multi-layer caching:
    // new Keyv({
    //   store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
    // }),
    // new Keyv({
    //   store: new KeyvRedis('redis://user:pass@localhost:6379'),
    // }),
  ],
});
