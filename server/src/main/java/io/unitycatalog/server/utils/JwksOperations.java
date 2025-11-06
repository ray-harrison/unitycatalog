package io.unitycatalog.server.utils;

import static io.unitycatalog.server.security.SecurityContext.Issuers.INTERNAL;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.JwkProviderBuilder;
import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.unitycatalog.server.exception.ErrorCode;
import io.unitycatalog.server.exception.OAuthInvalidClientException;
import io.unitycatalog.server.exception.OAuthInvalidRequestException;
import io.unitycatalog.server.model.AzureAdTokenClaims;
import io.unitycatalog.server.security.SecurityContext;
import io.unitycatalog.server.security.jwt.JwksCache;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class JwksOperations {

  private final JwksHttpClient httpClient;
  private static final ObjectMapper mapper = new ObjectMapper();
  private final SecurityContext securityContext;
  private final JwksCache jwksCache;
  private final int rateLimit;
  private final Map<String, RateLimiter> rateLimiters = new ConcurrentHashMap<>();

  private static final Logger LOGGER = LoggerFactory.getLogger(JwksOperations.class);

  public JwksOperations(
      SecurityContext securityContext,
      JwksHttpClient httpClient,
      JwksCache jwksCache,
      int rateLimit) {
    this.securityContext = securityContext;
    this.httpClient = httpClient;
    this.jwksCache = jwksCache;
    this.rateLimit = rateLimit;
  }

  /**
   * Legacy constructor for backward compatibility.
   * Uses default ArmeriaJwksClient and creates default cache.
   */
  public JwksOperations(SecurityContext securityContext) {
    this(securityContext, new ArmeriaJwksClient(), new JwksCache(86400, 10), 10);
  }

  /**
   * Constructor with JwksHttpClient for backward compatibility.
   * Creates default cache with 24h TTL and 10 max keys.
   */
  public JwksOperations(SecurityContext securityContext, JwksHttpClient httpClient) {
    this(securityContext, httpClient, new JwksCache(86400, 10), 10);
  }

  /**
   * Simple rate limiter for JWKS requests.
   */
  private static class RateLimiter {
    private final AtomicLong lastRequestTime = new AtomicLong(0);
    private final long minIntervalMillis;

    RateLimiter(int requestsPerMinute) {
      this.minIntervalMillis = 60000 / requestsPerMinute;
    }

    boolean tryAcquire() {
      long now = Instant.now().toEpochMilli();
      long last = lastRequestTime.get();
      if (now - last >= minIntervalMillis) {
        return lastRequestTime.compareAndSet(last, now);
      }
      return false;
    }
  }

  @SneakyThrows
  public JWTVerifier verifierForIssuerAndKey(String issuer, String keyId) {
    return verifierForIssuerAndKey(issuer, keyId, null);
  }

  @SneakyThrows
  public JWTVerifier verifierForIssuerAndKey(String issuer, String keyId, String algorithmHint) {
    Jwk jwk = getJwkWithCache(issuer, keyId);

    if (!"RSA".equalsIgnoreCase(jwk.getPublicKey().getAlgorithm())) {
      throw new OAuthInvalidRequestException(ErrorCode.ABORTED,
          String.format("Invalid algorithm '%s' for issuer '%s'",
              jwk.getPublicKey().getAlgorithm(), issuer));
    }

    Algorithm algorithm = algorithmForJwk(jwk, algorithmHint);

    return JWT.require(algorithm).withIssuer(issuer).build();
  }

  /**
   * Get JWK with caching support.
   * Checks cache first, fetches from provider if not found.
   * Implements rate limiting and automatic key rotation handling.
   *
   * @param issuer Token issuer
   * @param keyId Key ID from JWT header
   * @return JWK for the given key ID
   */
  @SneakyThrows
  private Jwk getJwkWithCache(String issuer, String keyId) {
    // Check cache first
    Optional<Jwk> cachedJwk = jwksCache.get(keyId);
    if (cachedJwk.isPresent()) {
      LOGGER.debug("Cache hit for keyId: {}", keyId);
      return cachedJwk.get();
    }

    // Cache miss - fetch from provider with rate limiting
    LOGGER.debug("Cache miss for keyId: {}, fetching from provider", keyId);

    // Apply rate limiting per issuer
    RateLimiter limiter = rateLimiters.computeIfAbsent(
        issuer, k -> new RateLimiter(rateLimit));

    if (!limiter.tryAcquire()) {
      LOGGER.warn("Rate limit exceeded for issuer: {}", issuer);
      throw new OAuthInvalidRequestException(ErrorCode.ABORTED,
          "JWKS request rate limit exceeded. Please try again later.");
    }

    // Fetch from provider
    JwkProvider jwkProvider = loadJwkProvider(issuer);
    Jwk jwk = jwkProvider.get(keyId);

    // Cache the key
    jwksCache.put(keyId, jwk);
    LOGGER.debug("Cached JWK for keyId: {}", keyId);

    return jwk;
  }

  @SneakyThrows
  private Algorithm algorithmForJwk(Jwk jwk, String algorithmHint) {
    // Use algorithm from JWK if available, otherwise use hint from JWT header, default to RS256
    String algorithm = jwk.getAlgorithm();
    if (algorithm == null || algorithm.isEmpty()) {
      algorithm = algorithmHint != null ? algorithmHint : "RS256";
      LOGGER.debug("JWK algorithm is null, using algorithm hint: {}", algorithm);
    }

    return switch (algorithm) {
      case "RS256" -> Algorithm.RSA256((RSAPublicKey) jwk.getPublicKey(), null);
      case "RS384" -> Algorithm.RSA384((RSAPublicKey) jwk.getPublicKey(), null);
      case "RS512" -> Algorithm.RSA512((RSAPublicKey) jwk.getPublicKey(), null);
      default -> throw new OAuthInvalidClientException(ErrorCode.ABORTED,
          String.format("Unsupported algorithm: %s", algorithm));
    };
  }

  @SneakyThrows
  public JwkProvider loadJwkProvider(String issuer) {
    LOGGER.debug("Loading JwkProvider for issuer '{}'", issuer);
    if (issuer.equals(INTERNAL)) {
      // Return our own "self-signed" provider, for easy mode.
      // TODO: This should be configurable
      Path certsFile = securityContext.getCertsFile();
      return new JwkProviderBuilder(certsFile.toUri().toURL()).cached(false).build();
    } else {
      // Get the JWKS from the OIDC well-known location described here
      // https://openid.net/specs/openid-connect-discovery-1_0-21.html#ProviderConfig

      if (!issuer.startsWith("https://") && !issuer.startsWith("http://")) {
        issuer = "https://" + issuer;
      }

      String wellKnownConfigUrl = issuer;

      if (!wellKnownConfigUrl.endsWith("/")) {
        wellKnownConfigUrl += "/";
      }

      var path = wellKnownConfigUrl + ".well-known/openid-configuration";
      LOGGER.debug("path: {}", path);

      String response;
      try {
        response = httpClient.fetch(path);
      } catch (IOException e) {
        throw new OAuthInvalidRequestException(ErrorCode.ABORTED,
            "Failed to fetch OIDC configuration: " + e.getMessage());
      }

      // TODO: We should cache this. No need to fetch it each time.
      Map<String, Object> configMap = mapper.readValue(response, new TypeReference<>() {});

      if (configMap == null || configMap.isEmpty()) {
        throw new OAuthInvalidRequestException(ErrorCode.ABORTED,
            "Could not get issuer configuration");
      }

      String configIssuer = (String) configMap.get("issuer");
      String configJwksUri = (String) configMap.get("jwks_uri");

      if (!configIssuer.equals(issuer)) {
        throw new OAuthInvalidRequestException(ErrorCode.ABORTED,
            "Issuer doesn't match configuration");
      }

      if (configJwksUri == null) {
        throw new OAuthInvalidRequestException(ErrorCode.ABORTED, "JWKS configuration missing");
      }

      // TODO: Or maybe just cache the provider for reuse.
      return new JwkProviderBuilder(URI.create(configJwksUri).toURL()).cached(false).build();
    }
  }

  /**
   * Safely extract a claim from JWT as String.
   * Returns null if claim is missing or null.
   *
   * @param jwt Decoded JWT token
   * @param claimName Name of the claim to extract
   * @return Claim value as String, or null if not present
   */
  public String getClaimSafely(DecodedJWT jwt, String claimName) {
    if (jwt == null || claimName == null) {
      return null;
    }
    Claim claim = jwt.getClaim(claimName);
    return claim.isNull() ? null : claim.asString();
  }

  /**
   * Safely extract a claim from JWT as List of Strings.
   * Returns null if claim is missing or null.
   *
   * @param jwt Decoded JWT token
   * @param claimName Name of the claim to extract
   * @return Claim value as List of Strings, or null if not present
   */
  public List<String> getClaimListSafely(DecodedJWT jwt, String claimName) {
    if (jwt == null || claimName == null) {
      return null;
    }
    Claim claim = jwt.getClaim(claimName);
    if (claim.isNull()) {
      return null;
    }
    try {
      return claim.asList(String.class);
    } catch (Exception e) {
      LOGGER.warn("Failed to parse claim '{}' as list: {}", claimName, e.getMessage());
      return null;
    }
  }

  /**
   * Extract Azure AD token claims from a decoded JWT.
   * This method safely extracts all standard OIDC and Azure AD specific claims.
   *
   * @param jwt Decoded JWT token
   * @return AzureAdTokenClaims object populated with JWT claims
   */
  public AzureAdTokenClaims extractAzureAdClaims(DecodedJWT jwt) {
    if (jwt == null) {
      throw new IllegalArgumentException("JWT cannot be null");
    }

    AzureAdTokenClaims claims = new AzureAdTokenClaims();

    // Standard OIDC claims
    claims.setIssuer(jwt.getIssuer());
    claims.setAudience(jwt.getAudience() != null && !jwt.getAudience().isEmpty()
        ? jwt.getAudience().get(0) : null);
    claims.setExpiration(jwt.getExpiresAt() != null ? jwt.getExpiresAt().getTime() / 1000 : null);
    claims.setIssuedAt(jwt.getIssuedAt() != null ? jwt.getIssuedAt().getTime() / 1000 : null);
    claims.setNotBefore(jwt.getNotBefore() != null ? jwt.getNotBefore().getTime() / 1000 : null);

    // Azure AD specific claims
    claims.setObjectId(getClaimSafely(jwt, "oid"));
    claims.setTenantId(getClaimSafely(jwt, "tid"));
    claims.setName(getClaimSafely(jwt, "name"));
    claims.setEmail(getClaimSafely(jwt, "email"));
    claims.setPreferredUsername(getClaimSafely(jwt, "preferred_username"));
    claims.setRoles(getClaimListSafely(jwt, "roles"));
    claims.setGroups(getClaimListSafely(jwt, "groups"));

    LOGGER.debug("Extracted Azure AD claims: oid={}, tid={}, name={}",
        claims.getObjectId(), claims.getTenantId(), claims.getName());

    return claims;
  }
}

