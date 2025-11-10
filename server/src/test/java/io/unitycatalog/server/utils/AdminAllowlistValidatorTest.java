package io.unitycatalog.server.utils;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Unit tests for AdminAllowlistValidator */
public class AdminAllowlistValidatorTest {

  @Test
  public void testNormalizeEmail_ConvertsToLowercase() {
    assertEquals("admin@company.com", AdminAllowlistValidator.normalizeEmail("Admin@Company.com"));
    assertEquals("user@example.com", AdminAllowlistValidator.normalizeEmail("USER@EXAMPLE.COM"));
  }

  @Test
  public void testNormalizeEmail_TrimsWhitespace() {
    assertEquals(
        "admin@company.com", AdminAllowlistValidator.normalizeEmail("  admin@company.com  "));
    assertEquals("test@test.com", AdminAllowlistValidator.normalizeEmail("\ttest@test.com\n"));
  }

  @Test
  public void testIsValidDomain_RequiresAtPrefix() {
    assertTrue(AdminAllowlistValidator.isValidDomain("@company.com"));
    assertFalse(AdminAllowlistValidator.isValidDomain("company.com"));
    assertFalse(AdminAllowlistValidator.isValidDomain(""));
    assertFalse(AdminAllowlistValidator.isValidDomain(null));
  }

  @Test
  public void testIsEmailInAllowlist_ExactMatch() {
    List<String> allowedEmails = Arrays.asList("admin@company.com", "user@company.com");
    List<String> allowedDomains = Collections.emptyList();

    assertTrue(
        AdminAllowlistValidator.isEmailInAllowlist(
            "admin@company.com", allowedEmails, allowedDomains));
    assertTrue(
        AdminAllowlistValidator.isEmailInAllowlist(
            "Admin@Company.com", allowedEmails, allowedDomains)); // Case-insensitive
    assertFalse(
        AdminAllowlistValidator.isEmailInAllowlist(
            "other@company.com", allowedEmails, allowedDomains));
  }

  @Test
  public void testIsEmailInAllowlist_DomainMatch() {
    List<String> allowedEmails = Collections.emptyList();
    List<String> allowedDomains = Arrays.asList("@company.com");

    assertTrue(
        AdminAllowlistValidator.isEmailInAllowlist(
            "anyone@company.com", allowedEmails, allowedDomains));
    assertTrue(
        AdminAllowlistValidator.isEmailInAllowlist(
            "admin@company.com", allowedEmails, allowedDomains));
    assertFalse(
        AdminAllowlistValidator.isEmailInAllowlist(
            "user@other.com", allowedEmails, allowedDomains));
  }

  @Test
  public void testIsEmailInAllowlist_NoSubdomainMatch() {
    List<String> allowedEmails = Collections.emptyList();
    List<String> allowedDomains = Arrays.asList("@company.com");

    // Subdomains should NOT match
    assertFalse(
        AdminAllowlistValidator.isEmailInAllowlist(
            "user@sub.company.com", allowedEmails, allowedDomains));
    // Exact domain should match
    assertTrue(
        AdminAllowlistValidator.isEmailInAllowlist(
            "user@company.com", allowedEmails, allowedDomains));
  }

  @Test
  public void testIsEmailInAllowlist_EmptyAllowlist() {
    List<String> allowedEmails = Collections.emptyList();
    List<String> allowedDomains = Collections.emptyList();

    assertFalse(
        AdminAllowlistValidator.isEmailInAllowlist(
            "admin@company.com", allowedEmails, allowedDomains));
    assertFalse(
        AdminAllowlistValidator.isEmailInAllowlist(
            "user@example.com", allowedEmails, allowedDomains));
  }
}
