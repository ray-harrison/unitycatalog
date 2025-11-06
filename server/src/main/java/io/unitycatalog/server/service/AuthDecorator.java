package io.unitycatalog.server.service;

import static io.unitycatalog.server.security.SecurityContext.Issuers.INTERNAL;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.linecorp.armeria.common.Cookie;
import com.linecorp.armeria.common.HttpHeaderNames;
import com.linecorp.armeria.common.HttpRequest;
import com.linecorp.armeria.common.HttpResponse;
import com.linecorp.armeria.server.DecoratingHttpServiceFunction;
import com.linecorp.armeria.server.HttpService;
import com.linecorp.armeria.server.ServiceRequestContext;
import io.netty.util.AttributeKey;
import io.unitycatalog.control.model.User;
import io.unitycatalog.server.exception.AuthorizationException;
import io.unitycatalog.server.exception.ErrorCode;
import io.unitycatalog.server.model.AzureAdTokenClaims;
import io.unitycatalog.server.model.UserIdentity;
import io.unitycatalog.server.persist.Repositories;
import io.unitycatalog.server.persist.UserRepository;
import io.unitycatalog.server.security.SecurityContext;
import io.unitycatalog.server.utils.JwksOperations;
import io.unitycatalog.server.utils.ServerProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * JWT access-token authorization decorator.
 *
 * <p>This decorator implements authorization for both internal and Azure AD tokens. It requires an
 * Authorization header in the request with a Bearer token. The token is verified based on its
 * issuer: - Internal tokens: validated against internal issuer key - Azure AD tokens: validated
 * against Azure AD JWKS endpoint
 *
 * <p>The decoded token and user identity are added to request attributes for downstream use.
 */
public class AuthDecorator implements DecoratingHttpServiceFunction {

  private static final Logger LOGGER = LoggerFactory.getLogger(AuthDecorator.class);
  private final UserRepository userRepository;
  private final ServerProperties serverProperties;

  public static final String UC_TOKEN_KEY = "UC_TOKEN";

  private static final String BEARER_PREFIX = "Bearer ";

  public static final AttributeKey<DecodedJWT> DECODED_JWT_ATTR =
      AttributeKey.valueOf(DecodedJWT.class, "DECODED_JWT_ATTR");

  public static final AttributeKey<UserIdentity> USER_IDENTITY_ATTR =
      AttributeKey.valueOf(UserIdentity.class, "USER_IDENTITY_ATTR");

  private final JwksOperations jwksOperations;
  private final AuthService authService;

  public AuthDecorator(
      SecurityContext securityContext,
      Repositories repositories,
      ServerProperties serverProperties,
      AuthService authService) {
    this.jwksOperations = new JwksOperations(securityContext);
    this.userRepository = repositories.getUserRepository();
    this.serverProperties = serverProperties;
    this.authService = authService;
  }

  @Override
  public HttpResponse serve(HttpService delegate, ServiceRequestContext ctx, HttpRequest req)
      throws Exception {
    LOGGER.debug("AuthDecorator checking {}", req.path());

    String authorizationHeader = req.headers().get(HttpHeaderNames.AUTHORIZATION);
    String authorizationCookie =
        req.headers().cookies().stream()
            .filter(c -> c.name().equals(UC_TOKEN_KEY))
            .map(Cookie::value)
            .findFirst()
            .orElse(null);

    DecodedJWT decodedJWT =
        JWT.decode(getAccessTokenFromCookieOrAuthHeader(authorizationHeader, authorizationCookie));

    String issuer = decodedJWT.getIssuer();
    String keyId = decodedJWT.getKeyId();

    LOGGER.debug("Validating access-token for issuer: {} and keyId: {}", issuer, keyId);

    UserIdentity userIdentity = null;

    // Check if this is an Azure AD token
    if (issuer != null
        && (issuer.contains("login.microsoftonline.com") || issuer.contains("sts.windows.net"))) {
      // Azure AD token validation
      LOGGER.debug("Detected Azure AD token, validating with Azure AD JWKS");

      try {
        String tokenString =
            getAccessTokenFromCookieOrAuthHeader(authorizationHeader, authorizationCookie);
        // Note: expectedAudience should come from configuration
        // For now, we'll validate the token structure but not enforce audience
        String algorithm = decodedJWT.getAlgorithm();
        JWTVerifier jwtVerifier = jwksOperations.verifierForIssuerAndKey(issuer, keyId, algorithm);
        decodedJWT = jwtVerifier.verify(decodedJWT);

        // Extract Azure AD claims
        AzureAdTokenClaims claims = jwksOperations.extractAzureAdClaims(decodedJWT);
        claims.validate();

        // Create UserIdentity from Azure AD claims
        userIdentity = UserIdentity.fromAzureAdToken(claims);

        LOGGER.info(
            "Azure AD authentication successful for user: {} ({})",
            userIdentity.getDisplayName(),
            userIdentity.getUserId());

      } catch (Exception e) {
        LOGGER.error("Azure AD token validation failed: {}", e.getMessage());
        throw new AuthorizationException(
            ErrorCode.PERMISSION_DENIED, "Azure AD token validation failed: " + e.getMessage());
      }

    } else if (issuer != null && issuer.equals(INTERNAL)) {
      // Internal token validation (existing logic)
      String algorithm = decodedJWT.getAlgorithm();
      JWTVerifier jwtVerifier = jwksOperations.verifierForIssuerAndKey(issuer, keyId, algorithm);
      decodedJWT = jwtVerifier.verify(decodedJWT);

      String subject = decodedJWT.getSubject();

      User user;
      try {
        user = userRepository.getUserByEmail(subject);
      } catch (Exception e) {
        LOGGER.debug("User not found: {}", subject);
        user = null;
      }
      if (user == null || user.getState() != User.StateEnum.ENABLED) {
        throw new AuthorizationException(
            ErrorCode.PERMISSION_DENIED, "User not allowed: " + subject);
      }

      LOGGER.debug("Internal token validation successful for subject: {}", subject);

    } else {
      throw new AuthorizationException(
          ErrorCode.PERMISSION_DENIED, "Invalid or unsupported token issuer: " + issuer);
    }

    // Store attributes in request context
    ctx.setAttr(DECODED_JWT_ATTR, decodedJWT);
    if (userIdentity != null) {
      ctx.setAttr(USER_IDENTITY_ATTR, userIdentity);
    }

    return delegate.serve(ctx, req);
  }

  private String getAccessTokenFromCookieOrAuthHeader(
      String authorizationHeader, String authorizationCookie) {
    if (authorizationHeader != null && authorizationHeader.startsWith(BEARER_PREFIX)) {
      return authorizationHeader.substring(BEARER_PREFIX.length());
    }
    if (authorizationCookie != null) {
      return authorizationCookie;
    }
    throw new AuthorizationException(ErrorCode.UNAUTHENTICATED, "No authorization found.");
  }
}
