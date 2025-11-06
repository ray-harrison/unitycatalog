package io.unitycatalog.server.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linecorp.armeria.common.AggregatedHttpRequest;
import com.linecorp.armeria.common.Cookie;
import com.linecorp.armeria.common.HttpData;
import com.linecorp.armeria.common.HttpHeaderNames;
import com.linecorp.armeria.common.HttpRequest;
import com.linecorp.armeria.common.HttpResponse;
import com.linecorp.armeria.common.HttpStatus;
import com.linecorp.armeria.common.MediaType;
import com.linecorp.armeria.common.QueryParams;
import com.linecorp.armeria.common.ResponseHeaders;
import com.linecorp.armeria.common.ResponseHeadersBuilder;
import com.linecorp.armeria.common.annotation.Nullable;
import com.linecorp.armeria.server.ServiceRequestContext;
import com.linecorp.armeria.server.annotation.ExceptionHandler;
import com.linecorp.armeria.server.annotation.Param;
import com.linecorp.armeria.server.annotation.Post;
import com.linecorp.armeria.server.annotation.RequestConverter;
import com.linecorp.armeria.server.annotation.RequestConverterFunction;
import io.unitycatalog.control.model.AccessTokenType;
import io.unitycatalog.control.model.GrantType;
import io.unitycatalog.control.model.OAuthTokenExchangeForm;
import io.unitycatalog.control.model.OAuthTokenExchangeInfo;
import io.unitycatalog.control.model.TokenEndpointExtensionType;
import io.unitycatalog.control.model.TokenType;
import io.unitycatalog.control.model.User;
import io.unitycatalog.server.exception.ErrorCode;
import io.unitycatalog.server.exception.GlobalExceptionHandler;
import io.unitycatalog.server.exception.OAuthInvalidRequestException;
import io.unitycatalog.server.model.AzureAdTokenClaims;
import io.unitycatalog.server.model.UserIdentity;
import io.unitycatalog.server.persist.Repositories;
import io.unitycatalog.server.persist.UserRepository;
import io.unitycatalog.server.persist.model.CreateUser;
import io.unitycatalog.server.security.JwtClaim;
import io.unitycatalog.server.security.SecurityContext;
import io.unitycatalog.server.utils.JwksOperations;
import io.unitycatalog.server.utils.ServerProperties;
import io.unitycatalog.server.utils.ServerProperties.Property;
import java.lang.reflect.ParameterizedType;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ExceptionHandler(GlobalExceptionHandler.class)
public class AuthService {

  private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);
  private final UserRepository userRepository;

  private final SecurityContext securityContext;
  private final JwksOperations jwksOperations;
  private final ServerProperties serverProperties;

  private static final String EMPTY_RESPONSE = "{}";

  public AuthService(
      SecurityContext securityContext,
      ServerProperties serverProperties,
      Repositories repositories) {
    this.securityContext = securityContext;
    this.jwksOperations = new JwksOperations(securityContext);
    this.serverProperties = serverProperties;
    this.userRepository = repositories.getUserRepository();
  }

  /**
   * OAuth token exchange.
   *
   * <p>Performs an OAuth token exchange for an access-token. Specifically this endpoint accepts a
   * "token-exchange" grant type (urn:ietf:params:oauth:grant-type:token-exchange) and along with
   * either an identity-token (urn:ietf:params:oauth:token-type:id_token) or a access-token
   * (urn:ietf:params:oauth:token-type:access_token), validates the token signature using OIDC
   * discovery and JWKs, and then creates a new access-token.
   *
   * <ul>
   *   <li>grant_type: urn:ietf:params:oauth:grant-type:token-exchange
   *   <li>requested_token_type: urn:ietf:params:oauth:token-type:access_token or
   *       urn:ietf:params:oauth:token-type:id_token
   *   <li>subject_token_type: urn:ietf:params:oauth:token-type:access_token
   *   <li>subject_token: The incoming token (typically from an identity provider)
   *   <li>actor_token_type: Not supported
   *   <li>actor_token: Not supported
   *   <li>scope: Not supported
   * </ul>
   *
   * <p>Currently the issuer for the incoming token to validate is not constrained to a specific
   * identity provider, rather as long as the token is signed by the matching issuer the validation
   * succeeds.
   *
   * <p>Eventually this should be constrained to a specific identity provider and even require that
   * the incoming identity (email, subject) matches a specific user in the system, once a user
   * management system is in place.
   *
   * @param ext Specifies whether the issued token should be set as a cookie.
   * @param form The OAuth 2.0 token exchange request form.
   * @return The token exchange response
   */
  @Post("/tokens")
  public HttpResponse grantToken(
      @Param("ext") Optional<TokenEndpointExtensionType> ext,
      @RequestConverter(ToOAuthTokenExchangeFormConverter.class) OAuthTokenExchangeForm form) {
    LOGGER.debug("Got token: {}", form);

    if (GrantType.TOKEN_EXCHANGE != form.getGrantType()) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Unsupported grant type: " + form.getGrantType());
    }

    if (TokenType.ACCESS_TOKEN != form.getRequestedTokenType()) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT,
          "Unsupported requested token type: " + form.getRequestedTokenType());
    }

    if (form.getSubjectTokenType() == null) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Subject token type is required but was not specified");
    }

    if (form.getActorTokenType() != null) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Actor tokens not currently supported");
    }

    boolean authorizationEnabled = this.serverProperties.isAuthorizationEnabled();
    if (!authorizationEnabled) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Authorization is disabled");
    }

    DecodedJWT decodedJWT = JWT.decode(form.getSubjectToken());
    String issuer = decodedJWT.getIssuer();
    String keyId = decodedJWT.getKeyId();
    String algorithm = decodedJWT.getAlgorithm();

    LOGGER.debug(
        "Validating token for issuer: {}, keyId: {}, algorithm: {}", issuer, keyId, algorithm);

    JWTVerifier jwtVerifier = jwksOperations.verifierForIssuerAndKey(issuer, keyId, algorithm);
    decodedJWT = jwtVerifier.verify(decodedJWT);
    verifyPrincipal(decodedJWT);

    LOGGER.debug("Validated. Creating access token.");

    String accessToken = securityContext.createAccessToken(decodedJWT);

    OAuthTokenExchangeInfo tokenExchangeInfo =
        new OAuthTokenExchangeInfo()
            .accessToken(accessToken)
            .issuedTokenType(TokenType.ACCESS_TOKEN)
            .tokenType(AccessTokenType.BEARER);

    // Set token as cookie if ext param is set to cookie
    ResponseHeadersBuilder responseHeaders = ResponseHeaders.builder(HttpStatus.OK);
    ext.ifPresent(
        e -> {
          if (e.equals(TokenEndpointExtensionType.COOKIE)) {
            // Set cookie timeout to 5 days by default if not present in server.properties
            String cookieTimeout = this.serverProperties.get(Property.COOKIE_TIMEOUT);
            Cookie cookie =
                createCookie(AuthDecorator.UC_TOKEN_KEY, accessToken, "/", cookieTimeout);
            responseHeaders.add(HttpHeaderNames.SET_COOKIE, cookie.toSetCookieHeader());
          }
        });

    return HttpResponse.ofJson(responseHeaders.build(), tokenExchangeInfo);
  }

  @Post("/logout")
  public HttpResponse logout(HttpRequest request) {
    return request.headers().cookies().stream()
        .filter(c -> c.name().equals(AuthDecorator.UC_TOKEN_KEY))
        .findFirst()
        .map(
            authorizationCookie -> {
              Cookie expiredCookie = createCookie(AuthDecorator.UC_TOKEN_KEY, "", "/", "PT0S");
              ResponseHeaders headers =
                  ResponseHeaders.builder()
                      .status(HttpStatus.OK)
                      .add(HttpHeaderNames.SET_COOKIE, expiredCookie.toSetCookieHeader())
                      .contentType(MediaType.JSON)
                      .build();
              // Armeria requires a non-empty response payload, so an empty JSON is sent
              return HttpResponse.of(headers, HttpData.ofUtf8(EMPTY_RESPONSE));
            })
        .orElse(HttpResponse.of(HttpStatus.OK, MediaType.JSON, EMPTY_RESPONSE));
  }

  private void verifyPrincipal(DecodedJWT decodedJWT) {
    String issuer = decodedJWT.getIssuer();

    // For Azure AD tokens, auto-provision user if they don't exist
    if (issuer != null
        && (issuer.contains("login.microsoftonline.com") || issuer.contains("sts.windows.net"))) {
      LOGGER.debug("Azure AD token detected, auto-provisioning user if needed");

      try {
        // Extract Azure AD claims
        AzureAdTokenClaims claims = jwksOperations.extractAzureAdClaims(decodedJWT);

        // Use email or preferred_username as the user identifier
        String email = claims.getEmail();
        if (email == null || email.trim().isEmpty()) {
          email = claims.getPreferredUsername();
        }

        if (email == null || email.trim().isEmpty()) {
          throw new OAuthInvalidRequestException(
              ErrorCode.INVALID_ARGUMENT,
              "Azure AD token missing email or preferred_username claim");
        }

        // Check if user already exists
        User existingUser = null;
        try {
          existingUser = userRepository.getUserByEmail(email);
        } catch (Exception e) {
          // User doesn't exist, will create below
          LOGGER.debug("User not found, will auto-provision: {}", email);
        }

        if (existingUser != null) {
          if (existingUser.getState() == User.StateEnum.ENABLED) {
            LOGGER.debug("Existing Azure AD user found and enabled: {}", email);
            return;
          } else {
            throw new OAuthInvalidRequestException(
                ErrorCode.PERMISSION_DENIED, "User is disabled: " + email);
          }
        }

        // Auto-provision the user
        String displayName = claims.getName();
        if (displayName == null || displayName.trim().isEmpty()) {
          displayName = email; // Fallback to email if name not provided
        }

        CreateUser createUser =
            CreateUser.builder()
                .name(displayName)
                .email(email)
                .externalId(claims.getObjectId()) // Use Azure AD object ID as external ID
                .active(true)
                .build();

        User newUser = userRepository.createUser(createUser);
        LOGGER.info(
            "Auto-provisioned Azure AD user: {} ({}), objectId: {}",
            newUser.getName(),
            newUser.getEmail(),
            newUser.getExternalId());

        return;

      } catch (OAuthInvalidRequestException e) {
        throw e;
      } catch (Exception e) {
        LOGGER.error("Error processing Azure AD token: {}", e.getMessage(), e);
        throw new OAuthInvalidRequestException(
            ErrorCode.INTERNAL, "Error processing Azure AD token: " + e.getMessage());
      }
    }

    // For internal tokens, verify against user repository
    String subject =
        decodedJWT
            .getClaims()
            .getOrDefault(JwtClaim.EMAIL.key(), decodedJWT.getClaim(JwtClaim.SUBJECT.key()))
            .asString();

    LOGGER.debug("Validating principal: {}", subject);

    if (subject.equals("admin")) {
      LOGGER.debug("admin always allowed");
      return;
    }

    try {
      User user = userRepository.getUserByEmail(subject);
      if (user != null && user.getState() == User.StateEnum.ENABLED) {
        LOGGER.debug("Principal {} is enabled", subject);
        return;
      }
    } catch (Exception e) {
      // IGNORE
    }

    throw new OAuthInvalidRequestException(
        ErrorCode.INVALID_ARGUMENT, "User not allowed: " + subject);
  }

  private Cookie createCookie(String key, String value, String path, String maxAge) {
    return Cookie.secureBuilder(key, value)
        .path(path)
        .maxAge(Duration.parse(maxAge).getSeconds())
        .build();
  }

  /**
   * Validate an Azure AD JWT token. Verifies signature, issuer, audience, and expiration.
   *
   * @param token JWT token string
   * @param expectedAudience Expected audience (client ID)
   * @return Validated UserIdentity
   * @throws OAuthInvalidRequestException if token is invalid
   */
  public UserIdentity validateAzureAdToken(String token, String expectedAudience) {
    if (token == null || token.trim().isEmpty()) {
      throw new OAuthInvalidRequestException(ErrorCode.INVALID_ARGUMENT, "Token is required");
    }

    // Decode token
    DecodedJWT decodedJWT;
    try {
      decodedJWT = JWT.decode(token);
    } catch (Exception e) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Invalid JWT token: " + e.getMessage());
    }

    // Verify signature using JWKS
    String issuer = decodedJWT.getIssuer();
    String keyId = decodedJWT.getKeyId();

    if (issuer == null || !issuer.contains("login.microsoftonline.com")) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Invalid Azure AD issuer: " + issuer);
    }

    String algorithm = decodedJWT.getAlgorithm();
    LOGGER.debug(
        "Validating Azure AD token for issuer: {}, keyId: {}, algorithm: {}",
        issuer,
        keyId,
        algorithm);

    JWTVerifier jwtVerifier = jwksOperations.verifierForIssuerAndKey(issuer, keyId, algorithm);
    decodedJWT = jwtVerifier.verify(decodedJWT);

    // Extract and validate claims
    AzureAdTokenClaims claims = jwksOperations.extractAzureAdClaims(decodedJWT);

    // Validate issuer format
    if (!validateIssuer(claims.getIssuer())) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Invalid issuer: " + claims.getIssuer());
    }

    // Validate audience
    if (!validateAudience(claims.getAudience(), expectedAudience)) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT,
          "Invalid audience: " + claims.getAudience() + ", expected: " + expectedAudience);
    }

    // Check expiration
    if (claims.isExpired()) {
      throw new OAuthInvalidRequestException(ErrorCode.INVALID_ARGUMENT, "Token has expired");
    }

    // Check not-before
    if (claims.isNotYetValid()) {
      throw new OAuthInvalidRequestException(ErrorCode.INVALID_ARGUMENT, "Token is not yet valid");
    }

    // Validate required claims
    try {
      claims.validate();
    } catch (IllegalArgumentException e) {
      throw new OAuthInvalidRequestException(
          ErrorCode.INVALID_ARGUMENT, "Invalid token claims: " + e.getMessage());
    }

    // Convert to UserIdentity
    UserIdentity identity = UserIdentity.fromAzureAdToken(claims);
    LOGGER.info(
        "Validated Azure AD token for user: {} ({})",
        identity.getDisplayName(),
        identity.getUserId());

    return identity;
  }

  /**
   * Validate issuer is a valid Azure AD tenant URL.
   *
   * @param issuer Issuer claim from JWT
   * @return true if issuer is valid
   */
  private boolean validateIssuer(String issuer) {
    if (issuer == null || issuer.trim().isEmpty()) {
      return false;
    }

    // Azure AD issuer format: https://login.microsoftonline.com/{tenant-id}/v2.0
    // or https://sts.windows.net/{tenant-id}/
    return issuer.startsWith("https://login.microsoftonline.com/")
        || issuer.startsWith("https://sts.windows.net/");
  }

  /**
   * Validate audience matches expected client ID.
   *
   * @param audience Audience claim from JWT
   * @param expectedAudience Expected audience (client ID)
   * @return true if audience is valid
   */
  private boolean validateAudience(String audience, String expectedAudience) {
    if (audience == null || expectedAudience == null) {
      return false;
    }
    return audience.equals(expectedAudience);
  }

  // NOTE:
  // When specifying `application/x-www-form-urlencoded` as the content type in the OpenAPI schema,
  // the OpenAPI Generator does not create request models from the schema.
  // Moreover, directly accessing parameters from the body without a model causes issues with
  // Armeria, particularly when the `ext` query parameter is included.
  //
  // To resolve this, instead of redefining a request model solely for Armeria's parameter
  // injection,
  // a `RequestConverterFunction` for `OAuthTokenExchangeRequest` is implemented here.
  // This approach ensures a single model is used across both the `controlApi` and `cli` projects,
  // preserving the principle of a single source of truth.
  //
  // SEE:
  // - https://armeria.dev/docs/server-annotated-service/#getting-a-query-parameter
  // - https://armeria.dev/docs/server-annotated-service/#injecting-a-parameter-as-an-enum-type
  private static class ToOAuthTokenExchangeFormConverter implements RequestConverterFunction {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Object convertRequest(
        ServiceRequestContext ctx,
        AggregatedHttpRequest request,
        Class<?> expectedResultType,
        @Nullable ParameterizedType expectedParameterizedResultType) {
      MediaType contentType = request.contentType();
      if (expectedResultType == OAuthTokenExchangeForm.class
          && contentType != null
          && contentType.belongsTo(MediaType.FORM_DATA)) {
        Map<String, String> form =
            QueryParams.fromQueryString(
                    request.content(contentType.charset(StandardCharsets.UTF_8)))
                .stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        return mapper.convertValue(form, OAuthTokenExchangeForm.class);
      }
      return RequestConverterFunction.fallthrough();
    }
  }
}
