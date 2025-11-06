package io.unitycatalog.server.utils;

import com.linecorp.armeria.client.WebClient;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.CompletionException;

/**
 * JWKS HTTP client implementation using Armeria WebClient. High-performance async HTTP client with
 * connection pooling and HTTP/2 support. Default implementation for Unity Catalog.
 */
public class ArmeriaJwksClient implements JwksHttpClient {

  private final WebClient webClient;
  private final Duration timeout;

  /** Create Armeria client with default 10-second timeout. */
  public ArmeriaJwksClient() {
    this(Duration.ofSeconds(10));
  }

  /**
   * Create Armeria client with custom timeout.
   *
   * @param timeout Request timeout duration
   */
  public ArmeriaJwksClient(Duration timeout) {
    this.timeout = timeout;
    this.webClient = WebClient.builder().responseTimeout(timeout).build();
  }

  @Override
  public String fetch(String url) throws IOException {
    try {
      return webClient.get(url).aggregate().join().contentUtf8();
    } catch (CompletionException e) {
      // Unwrap CompletionException from join()
      Throwable cause = e.getCause();
      if (cause instanceof IOException) {
        throw (IOException) cause;
      }
      throw new IOException("Failed to fetch from " + url + ": " + cause.getMessage(), cause);
    } catch (Exception e) {
      throw new IOException("Failed to fetch from " + url + ": " + e.getMessage(), e);
    }
  }

  @Override
  public Duration getTimeout() {
    return timeout;
  }

  @Override
  public void close() {
    // Armeria WebClient doesn't require explicit close
    // Connection pooling is managed internally
  }
}
