package io.unitycatalog.server.security.jwt;

import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.JwkProviderBuilder;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import io.unitycatalog.server.exception.BaseException;
import io.unitycatalog.server.exception.ErrorCode;
import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Azure JWT validation operations using JWKS endpoint.
 *
 * <p>Handles tenant-aware JWT validation with key rotation support and proper claim validation for
 * Unity Catalog bootstrap.
 */
public class JwksOperations {

  private static final Logger LOGGER = LoggerFactory.getLogger(JwksOperations.class);
  private static final String AZURE_JWKS_URL_TEMPLATE =
      "https://login.microsoftonline.com/%s/discovery/v2.0/keys";
  private static final String AZURE_ISSUER_TEMPLATE = "https://login.microsoftonline.com/%s/v2.0";

  private final JwkProvider jwkProvider;
  private final String expectedTenant;
  private final String expectedIssuer;

  public JwksOperations(String azureTenantId) {
    this.expectedTenant = azureTenantId;
    this.expectedIssuer = String.format(AZURE_ISSUER_TEMPLATE, azureTenantId);

    LOGGER.info(
        "Initializing Azure JWKS operations with tenant: {}, expectedIssuer: {}",
        azureTenantId,
        expectedIssuer);

    try {
      String jwksUrl = String.format(AZURE_JWKS_URL_TEMPLATE, azureTenantId);
      this.jwkProvider =
          new JwkProviderBuilder(new URL(jwksUrl))
              .cached(10, 24, TimeUnit.HOURS) // Cache JWKs for 24 hours
              .rateLimited(10, 1, TimeUnit.MINUTES) // Rate limit JWKS requests
              .build();

      LOGGER.info("Azure JWKS provider initialized: tenant={}, url={}", azureTenantId, jwksUrl);
    } catch (Exception e) {
      throw new BaseException(
          ErrorCode.INTERNAL, "Failed to initialize Azure JWKS provider: " + e.getMessage());
    }
  }

  public DecodedJWT validateAzureJwt(String token) {
    try {
      LOGGER.debug("Starting Azure JWT validation for token with length: {}", token.length());

      // 1. Decode JWT without verification first
      DecodedJWT decodedJWT = JWT.decode(token);
      LOGGER.debug(
          "JWT decoded successfully. Issuer: {}, KeyId: {}, Subject: {}",
          decodedJWT.getIssuer(),
          decodedJWT.getKeyId(),
          decodedJWT.getSubject());

      // 2. Validate issuer
      LOGGER.debug(
          "Validating issuer. Expected: {}, Actual: {}", expectedIssuer, decodedJWT.getIssuer());
      if (!expectedIssuer.equals(decodedJWT.getIssuer())) {
        throw new BaseException(
            ErrorCode.UNAUTHENTICATED,
            "Invalid issuer. Expected: " + expectedIssuer + ", Actual: " + decodedJWT.getIssuer());
      }

      // 3. Get public key from JWKS
      LOGGER.debug("Fetching public key for keyId: {}", decodedJWT.getKeyId());
      RSAPublicKey publicKey = (RSAPublicKey) jwkProvider.get(decodedJWT.getKeyId()).getPublicKey();
      LOGGER.debug("Public key retrieved successfully");

      // 4. Verify signature and claims
      LOGGER.debug("Creating JWT verifier and verifying signature");
      Algorithm algorithm = Algorithm.RSA256(publicKey, null);
      JWTVerifier verifier =
          JWT.require(algorithm)
              .withIssuer(expectedIssuer)
              .withClaimPresence("oid") // Azure Object ID required
              .withClaimPresence("name") // Display name required
              .acceptExpiresAt(60) // 60 second clock skew
              .build();

      DecodedJWT verifiedJWT = verifier.verify(decodedJWT);
      LOGGER.debug("JWT signature verification successful");

      LOGGER.debug(
          "Azure JWT validated successfully: subject={}, oid={}",
          verifiedJWT.getSubject(),
          verifiedJWT.getClaim("oid").asString());

      return verifiedJWT;

    } catch (BaseException e) {
      LOGGER.error("Azure JWT validation failed with BaseException: {}", e.getMessage());
      throw e;
    } catch (Exception e) {
      LOGGER.error(
          "Azure JWT validation failed with Exception: {} - {}",
          e.getClass().getSimpleName(),
          e.getMessage());
      LOGGER.debug("Full exception details:", e);
      throw new BaseException(ErrorCode.UNAUTHENTICATED, "Invalid Azure JWT: " + e.getMessage());
    }
  }

  public boolean isTokenFromExpectedTenant(DecodedJWT jwt) {
    String tokenTenant = jwt.getClaim("tid").asString();
    return expectedTenant.equals(tokenTenant);
  }
}
