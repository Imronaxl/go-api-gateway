// Package cache provides a generic thread-safe TTL cache.
package cache

import (
"sync"
"time"
)

// Cache is a generic thread-safe TTL cache.
type Cache[K comparable, V any] struct {
mu      sync.RWMutex
items   map[K]cacheItem[V]
defaultTTL time.Duration
}

type cacheItem[V any] struct {
value     V
expiresAt time.Time
}

// New creates a new cache with the specified default TTL.
func New[K comparable, V any](defaultTTL time.Duration) *Cache[K, V] {
c := &Cache[K, V]{
items:      make(map[K]cacheItem[V]),
defaultTTL: defaultTTL,
}
go c.cleanup()
return c
}

// Set stores a value in the cache with the default TTL.
func (c *Cache[K, V]) Set(key K, value V) {
c.SetWithTTL(key, value, c.defaultTTL)
}

// SetWithTTL stores a value in the cache with a custom TTL.
func (c *Cache[K, V]) SetWithTTL(key K, value V, ttl time.Duration) {
c.mu.Lock()
defer c.mu.Unlock()

c.items[key] = cacheItem[V]{
value:     value,
expiresAt: time.Now().Add(ttl),
}
}

// Get retrieves a value from the cache.
func (c *Cache[K, V]) Get(key K) (V, bool) {
c.mu.RLock()
defer c.mu.RUnlock()

item, ok := c.items[key]
if !ok || time.Now().After(item.expiresAt) {
var zero V
return zero, false
}

return item.value, true
}

// Delete removes a key from the cache.
func (c *Cache[K, V]) Delete(key K) {
c.mu.Lock()
defer c.mu.Unlock()
delete(c.items, key)
}

// cleanup periodically removes expired items.
func (c *Cache[K, V]) cleanup() {
ticker := time.NewTicker(time.Minute)
defer ticker.Stop()

for range ticker.C {
c.mu.Lock()
now := time.Now()
for k, item := range c.items {
if now.After(item.expiresAt) {
delete(c.items, k)
}
}
c.mu.Unlock()
}
}
