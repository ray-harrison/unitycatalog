package io.unitycatalog.server.security.jwt;

import com.auth0.jwk.Jwk;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Thread-safe cache for JWKS (JSON Web Key Set) keys. Implements TTL-based expiration and LRU
 * eviction when capacity is reached.
 *
 * <p>Cache behavior:
 *
 * <ul>
 *   <li>TTL: Keys expire after configured duration (default 24 hours)
 *   <li>LRU: When max capacity reached, least-recently-used key is evicted
 *   <li>Thread-safe: Uses ReadWriteLock for concurrent access
 *   <li>Auto-cleanup: Expired keys removed on get/put operations
 * </ul>
 */
public class JwksCache {

  private static final Logger LOGGER = LoggerFactory.getLogger(JwksCache.class);

  private final Map<String, CachedKey> cache;
  private final long cacheTtlSeconds;
  private final int maxKeys;
  private final ReadWriteLock lock;

  /**
   * Create JWKS cache with specified TTL and capacity.
   *
   * @param cacheTtlSeconds Time-to-live for cached keys in seconds
   * @param maxKeys Maximum number of keys to cache (LRU eviction when exceeded)
   */
  public JwksCache(long cacheTtlSeconds, int maxKeys) {
    if (cacheTtlSeconds <= 0) {
      throw new IllegalArgumentException("Cache TTL must be positive, got: " + cacheTtlSeconds);
    }
    if (maxKeys <= 0) {
      throw new IllegalArgumentException("Max keys must be positive, got: " + maxKeys);
    }

    this.cacheTtlSeconds = cacheTtlSeconds;
    this.maxKeys = maxKeys;
    this.lock = new ReentrantReadWriteLock();

    // LinkedHashMap with access-order for LRU behavior
    this.cache =
        new LinkedHashMap<String, CachedKey>(maxKeys, 0.75f, true) {
          @Override
          protected boolean removeEldestEntry(Map.Entry<String, CachedKey> eldest) {
            boolean shouldRemove = size() > JwksCache.this.maxKeys;
            if (shouldRemove) {
              LOGGER.debug("Evicting LRU key from cache: {}", eldest.getKey());
            }
            return shouldRemove;
          }
        };
  }

  /**
   * Get cached key by key ID.
   *
   * @param keyId JWK key ID (kid claim)
   * @return Optional containing the Jwk if found and not expired, empty otherwise
   */
  public Optional<Jwk> get(String keyId) {
    if (keyId == null || keyId.trim().isEmpty()) {
      return Optional.empty();
    }

    lock.readLock().lock();
    try {
      CachedKey cachedKey = cache.get(keyId);
      if (cachedKey == null) {
        LOGGER.debug("Cache miss for key: {}", keyId);
        return Optional.empty();
      }

      if (cachedKey.isExpired()) {
        LOGGER.debug("Cache entry expired for key: {}", keyId);
        // Remove expired entry (upgrade to write lock)
        lock.readLock().unlock();
        lock.writeLock().lock();
        try {
          cache.remove(keyId);
          lock.readLock().lock();
        } finally {
          lock.writeLock().unlock();
        }
        return Optional.empty();
      }

      LOGGER.debug("Cache hit for key: {}", keyId);
      return Optional.of(cachedKey.jwk);
    } finally {
      lock.readLock().unlock();
    }
  }

  /**
   * Put key into cache with current timestamp.
   *
   * @param keyId JWK key ID (kid claim)
   * @param jwk JWK to cache
   */
  public void put(String keyId, Jwk jwk) {
    if (keyId == null || keyId.trim().isEmpty()) {
      throw new IllegalArgumentException("Key ID cannot be null or empty");
    }
    if (jwk == null) {
      throw new IllegalArgumentException("Jwk cannot be null");
    }

    long now = Instant.now().getEpochSecond();
    long expiryTime = now + cacheTtlSeconds;

    lock.writeLock().lock();
    try {
      // Clean up expired entries before adding new one
      cleanupExpiredEntries();

      cache.put(keyId, new CachedKey(jwk, now, expiryTime));
      LOGGER.debug("Cached key: {} (expires in {} seconds)", keyId, cacheTtlSeconds);
    } finally {
      lock.writeLock().unlock();
    }
  }

  /**
   * Remove key from cache.
   *
   * @param keyId JWK key ID to remove
   * @return true if key was present and removed
   */
  public boolean remove(String keyId) {
    if (keyId == null || keyId.trim().isEmpty()) {
      return false;
    }

    lock.writeLock().lock();
    try {
      boolean removed = cache.remove(keyId) != null;
      if (removed) {
        LOGGER.debug("Removed key from cache: {}", keyId);
      }
      return removed;
    } finally {
      lock.writeLock().unlock();
    }
  }

  /** Clear all cached keys. */
  public void clear() {
    lock.writeLock().lock();
    try {
      cache.clear();
      LOGGER.info("Cleared JWKS cache");
    } finally {
      lock.writeLock().unlock();
    }
  }

  /**
   * Get current cache size.
   *
   * @return Number of keys in cache (including expired entries)
   */
  public int size() {
    lock.readLock().lock();
    try {
      return cache.size();
    } finally {
      lock.readLock().unlock();
    }
  }

  /**
   * Get cache statistics.
   *
   * @return Map containing cache stats (size, ttl, maxKeys, expiredCount)
   */
  public Map<String, Object> getStats() {
    lock.readLock().lock();
    try {
      long now = Instant.now().getEpochSecond();
      long expiredCount = cache.values().stream().filter(CachedKey::isExpired).count();

      Map<String, Object> stats = new LinkedHashMap<>();
      stats.put("size", cache.size());
      stats.put("ttlSeconds", cacheTtlSeconds);
      stats.put("maxKeys", maxKeys);
      stats.put("expiredCount", expiredCount);
      stats.put("activeCount", cache.size() - expiredCount);
      return stats;
    } finally {
      lock.readLock().unlock();
    }
  }

  /** Remove expired entries from cache. Should be called while holding write lock. */
  private void cleanupExpiredEntries() {
    cache
        .entrySet()
        .removeIf(
            entry -> {
              boolean expired = entry.getValue().isExpired();
              if (expired) {
                LOGGER.debug("Removing expired key during cleanup: {}", entry.getKey());
              }
              return expired;
            });
  }

  /** Cached JWKS key with expiration metadata. */
  private static class CachedKey {
    final Jwk jwk;
    final long cacheTime;
    final long expiryTime;

    CachedKey(Jwk jwk, long cacheTime, long expiryTime) {
      this.jwk = jwk;
      this.cacheTime = cacheTime;
      this.expiryTime = expiryTime;
    }

    boolean isExpired() {
      return Instant.now().getEpochSecond() >= expiryTime;
    }
  }
}
