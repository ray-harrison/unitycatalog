package io.unitycatalog.server.utils;

import java.time.Duration;

/**
 * Factory for creating JWKS HTTP clients based on configuration. Supports both Armeria (default)
 * and Java built-in HttpClient implementations.
 */
public class JwksHttpClientFactory {

  private static final String ARMERIA_CLIENT = "armeria";
  private static final String JAVA_CLIENT = "java";
  private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);

  /**
   * Create HTTP client based on ServerProperties configuration.
   *
   * @param properties Server properties containing jwks.http-client setting
   * @return Configured JwksHttpClient instance
   * @throws IllegalArgumentException if client type is unsupported
   */
  public static JwksHttpClient create(ServerProperties properties) {
    String clientType = properties.getJwksHttpClient();
    return create(clientType, DEFAULT_TIMEOUT);
  }

  /**
   * Create HTTP client with custom timeout.
   *
   * @param properties Server properties containing jwks.http-client setting
   * @param timeout Request timeout duration
   * @return Configured JwksHttpClient instance
   * @throws IllegalArgumentException if client type is unsupported
   */
  public static JwksHttpClient create(ServerProperties properties, Duration timeout) {
    String clientType = properties.getJwksHttpClient();
    return create(clientType, timeout);
  }

  /**
   * Create HTTP client by type string.
   *
   * @param clientType "armeria" or "java"
   * @param timeout Request timeout duration
   * @return Configured JwksHttpClient instance
   * @throws IllegalArgumentException if client type is unsupported
   */
  public static JwksHttpClient create(String clientType, Duration timeout) {
    if (clientType == null || clientType.trim().isEmpty()) {
      clientType = ARMERIA_CLIENT;
    }

    switch (clientType.toLowerCase()) {
      case ARMERIA_CLIENT:
        return new ArmeriaJwksClient(timeout);
      case JAVA_CLIENT:
        return new JavaJwksClient(timeout);
      default:
        throw new IllegalArgumentException(
            "Unsupported JWKS HTTP client type: "
                + clientType
                + ". Supported types: armeria, java");
    }
  }
}
