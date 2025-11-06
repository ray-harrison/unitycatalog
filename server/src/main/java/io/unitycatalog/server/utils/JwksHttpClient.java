package io.unitycatalog.server.utils;

import java.io.IOException;
import java.time.Duration;

/**
 * HTTP client abstraction for fetching JWKS from OpenID Connect providers. Implementations must
 * support HTTPS, timeouts, and be thread-safe for concurrent requests.
 */
public interface JwksHttpClient {

  /**
   * Fetch content from the given URL.
   *
   * @param url JWKS endpoint URL (typically https://.../.well-known/jwks.json or
   *     openid-configuration)
   * @return Response body as UTF-8 string
   * @throws IOException if request fails (network error, timeout, non-200 status)
   */
  String fetch(String url) throws IOException;

  /**
   * Get the configured timeout for HTTP requests.
   *
   * @return Request timeout duration
   */
  Duration getTimeout();

  /**
   * Close the HTTP client and release resources. Should be called when the client is no longer
   * needed.
   */
  void close();
}
