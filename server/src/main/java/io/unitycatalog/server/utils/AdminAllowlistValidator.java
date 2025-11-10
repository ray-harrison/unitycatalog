package io.unitycatalog.server.utils;

import java.util.List;

/**
 * Utility class for validating email addresses against admin allowlist configuration.
 *
 * <p>This class provides methods to check if a user's email address matches configured allowlist
 * patterns, supporting both exact email matching and domain wildcard matching.
 *
 * <p>Email matching is case-insensitive and whitespace-tolerant to handle common configuration
 * variations.
 */
public class AdminAllowlistValidator {

  /**
   * Normalizes an email address for case-insensitive comparison.
   *
   * @param email the email address to normalize
   * @return normalized email (trimmed and lowercase)
   */
  public static String normalizeEmail(String email) {
    if (email == null) {
      return "";
    }
    return email.trim().toLowerCase();
  }

  /**
   * Validates whether a domain string is properly formatted.
   *
   * @param domain the domain pattern to validate (must start with @)
   * @return true if domain is valid (non-empty and starts with @)
   */
  public static boolean isValidDomain(String domain) {
    if (domain == null || domain.trim().isEmpty()) {
      return false;
    }
    return domain.trim().startsWith("@");
  }

  /**
   * Checks if an email address matches the admin allowlist.
   *
   * @param email the email address to check
   * @param allowedEmails list of specific allowed email addresses
   * @param allowedDomains list of allowed domain patterns (e.g., @company.com)
   * @return true if email matches allowlist (exact email or domain wildcard)
   */
  public static boolean isEmailInAllowlist(
      String email, List<String> allowedEmails, List<String> allowedDomains) {
    if (email == null || email.trim().isEmpty()) {
      return false;
    }

    String normalized = normalizeEmail(email);

    // Check exact email match
    if (allowedEmails != null) {
      for (String allowedEmail : allowedEmails) {
        if (normalized.equals(normalizeEmail(allowedEmail))) {
          return true;
        }
      }
    }

    // Check domain wildcard match
    if (allowedDomains != null) {
      for (String domain : allowedDomains) {
        String normalizedDomain = domain.trim().toLowerCase();
        if (isValidDomain(normalizedDomain) && normalized.endsWith(normalizedDomain)) {
          return true;
        }
      }
    }

    return false;
  }
}
