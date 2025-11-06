package io.unitycatalog.server.utils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * JWKS HTTP client implementation using Java's built-in HttpClient. Alternative to
 * ArmeriaJwksClient for environments with DNS resolution issues or when Armeria dependency is not
 * desired.
 */
public class JavaJwksClient implements JwksHttpClient {

  private final HttpClient httpClient;
  private final Duration timeout;

  /** Create Java HttpClient with default 10-second timeout. */
  public JavaJwksClient() {
    this(Duration.ofSeconds(10));
  }

  /**
   * Create Java HttpClient with custom timeout.
   *
   * @param timeout Request timeout duration
   */
  public JavaJwksClient(Duration timeout) {
    this.timeout = timeout;
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(timeout)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
  }

  @Override
  public String fetch(String url) throws IOException {
    try {
      HttpRequest request =
          HttpRequest.newBuilder().uri(URI.create(url)).timeout(timeout).GET().build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        throw new IOException("HTTP " + response.statusCode() + " from " + url);
      }

      return response.body();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IOException("Request interrupted: " + url, e);
    } catch (IOException e) {
      throw e;
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
    // Java HttpClient manages resources internally
    // No explicit close needed
  }
}
