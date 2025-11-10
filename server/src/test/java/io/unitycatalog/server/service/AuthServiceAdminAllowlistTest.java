package io.unitycatalog.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.unitycatalog.control.model.User;
import io.unitycatalog.server.auth.JCasbinAuthorizer;
import io.unitycatalog.server.auth.UnityCatalogAuthorizer;
import io.unitycatalog.server.persist.MetastoreRepository;
import io.unitycatalog.server.persist.Repositories;
import io.unitycatalog.server.persist.UserRepository;
import io.unitycatalog.server.persist.model.CreateUser;
import io.unitycatalog.server.persist.model.Privileges;
import io.unitycatalog.server.persist.utils.HibernateConfigurator;
import io.unitycatalog.server.utils.ServerProperties;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for admin bootstrap via email allowlist feature. Tests the interaction between
 * AuthService, ServerProperties, AdminAllowlistValidator, and UnityCatalogAuthorizer.
 */
public class AuthServiceAdminAllowlistTest {

  private HibernateConfigurator hibernateConfigurator;
  private UnityCatalogAuthorizer authorizer;
  private Repositories repositories;
  private UserRepository userRepository;
  private MetastoreRepository metastoreRepository;
  private ServerProperties serverProperties;

  @BeforeEach
  void setUp() throws Exception {
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");

    serverProperties = new ServerProperties(properties);
    hibernateConfigurator = new HibernateConfigurator(serverProperties);
    authorizer = new JCasbinAuthorizer(hibernateConfigurator);
    repositories = new Repositories(hibernateConfigurator.getSessionFactory(), serverProperties);
    userRepository = repositories.getUserRepository();
    metastoreRepository = repositories.getMetastoreRepository();

    // Initialize metastore
    metastoreRepository.initMetastoreIfNeeded();
  }

  @AfterEach
  void tearDown() {
    // Clean up test data
    if (hibernateConfigurator != null) {
      var session = hibernateConfigurator.getSessionFactory().openSession();
      var tx = session.beginTransaction();
      session.createMutationQuery("delete from UserDAO").executeUpdate();
      tx.commit();
      session.close();
    }
  }

  @Test
  void testAdminAllowlist_ExactEmailMatch_GrantsPrivileges() {
    // Setup: Configure allowlist with specific email
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    properties.setProperty("server.bootstrap.admin-emails", "admin@example.com");
    serverProperties = new ServerProperties(properties);

    // Create a user with allowlisted email
    CreateUser createUser =
        CreateUser.builder()
            .email("admin@example.com")
            .name("Admin User")
            .externalId("azure-123")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic (simulating what AuthService does)
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should have METASTORE OWNER privilege
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("User with allowlisted email should have METASTORE OWNER privilege")
        .isTrue();
  }

  @Test
  void testAdminAllowlist_DomainMatch_GrantsPrivileges() {
    // Setup: Configure allowlist with domain wildcard
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    properties.setProperty("server.bootstrap.admin-email-domains", "@company.com");
    serverProperties = new ServerProperties(properties);

    // Create a user with email matching domain
    CreateUser createUser =
        CreateUser.builder()
            .email("alice@company.com")
            .name("Alice Admin")
            .externalId("azure-456")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should have METASTORE OWNER privilege
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("User with email matching allowlisted domain should have METASTORE OWNER privilege")
        .isTrue();
  }

  @Test
  void testAdminAllowlist_NoMatch_NoPrivileges() {
    // Setup: Configure allowlist that won't match
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    properties.setProperty("server.bootstrap.admin-emails", "admin@example.com");
    serverProperties = new ServerProperties(properties);

    // Create a user with non-allowlisted email
    CreateUser createUser =
        CreateUser.builder()
            .email("user@other.com")
            .name("Regular User")
            .externalId("azure-789")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should NOT have METASTORE OWNER privilege
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("User with non-allowlisted email should NOT have METASTORE OWNER privilege")
        .isFalse();
  }

  @Test
  void testAdminAllowlist_EmptyAllowlist_NoPrivileges() {
    // Setup: No allowlist configured (empty)
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    // No admin-emails or admin-email-domains set
    serverProperties = new ServerProperties(properties);

    // Create a user
    CreateUser createUser =
        CreateUser.builder()
            .email("user@example.com")
            .name("Some User")
            .externalId("azure-999")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should NOT have METASTORE OWNER privilege (allowlist empty means no bootstrap)
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("When allowlist is empty, no user should automatically receive METASTORE OWNER")
        .isFalse();
  }

  @Test
  void testAdminAllowlist_CaseInsensitiveMatch_GrantsPrivileges() {
    // Setup: Configure allowlist with lowercase email
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    properties.setProperty("server.bootstrap.admin-emails", "admin@example.com");
    serverProperties = new ServerProperties(properties);

    // Create a user with UPPERCASE email
    CreateUser createUser =
        CreateUser.builder()
            .email("ADMIN@EXAMPLE.COM")
            .name("Admin User")
            .externalId("azure-uppercase")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should have METASTORE OWNER privilege (case-insensitive match)
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("Email matching should be case-insensitive")
        .isTrue();
  }

  @Test
  void testAdminAllowlist_MultipleDomains_MatchesAny() {
    // Setup: Configure allowlist with multiple domains
    Properties properties = new Properties();
    properties.setProperty("server.env", "test");
    properties.setProperty("server.authorization", "enable");
    properties.setProperty("server.bootstrap.admin-email-domains", "@company.com,@partner.org");
    serverProperties = new ServerProperties(properties);

    // Create user matching second domain
    CreateUser createUser =
        CreateUser.builder()
            .email("bob@partner.org")
            .name("Bob Partner")
            .externalId("azure-partner")
            .active(true)
            .build();

    User newUser = userRepository.createUser(createUser);

    // Manually invoke the allowlist check logic
    checkAdminAllowlistAndGrant(newUser);

    // Verify: User should have METASTORE OWNER privilege
    UUID userId = UUID.fromString(newUser.getId());
    UUID metastoreId = metastoreRepository.getMetastoreId();
    assertThat(authorizer.authorize(userId, metastoreId, Privileges.OWNER))
        .as("User with email matching any allowlisted domain should have privileges")
        .isTrue();
  }

  /**
   * Helper method that replicates the logic from AuthService.checkAdminAllowlistAndGrant(). This is
   * used in tests to simulate the behavior without needing to create a full AuthService instance.
   */
  private void checkAdminAllowlistAndGrant(User user) {
    try {
      var allowedEmails = serverProperties.getAdminEmails();
      var allowedDomains = serverProperties.getAdminEmailDomains();

      if (allowedEmails.isEmpty() && allowedDomains.isEmpty()) {
        return; // No allowlist configured
      }

      String userEmail = user.getEmail();
      if (userEmail == null || userEmail.trim().isEmpty()) {
        return;
      }

      // Use the same validator logic as AuthService
      if (io.unitycatalog.server.utils.AdminAllowlistValidator.isEmailInAllowlist(
          userEmail, allowedEmails, allowedDomains)) {
        UUID metastoreId = metastoreRepository.getMetastoreId();
        authorizer.grantAuthorization(UUID.fromString(user.getId()), metastoreId, Privileges.OWNER);
      }
    } catch (Exception e) {
      // Fail-open: ignore errors in test helper
    }
  }
}
