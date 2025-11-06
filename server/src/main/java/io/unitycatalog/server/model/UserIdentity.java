package io.unitycatalog.server.model;

import java.util.List;
import java.util.Objects;

/**
 * User identity representation for Unity Catalog. Maps authenticated user information from identity
 * providers (Azure AD, Okta, etc.) to Unity Catalog's authorization model.
 */
public class UserIdentity {

  private final String userId;
  private final String displayName;
  private final String email;
  private final String tenantId;
  private final List<String> roles;
  private final List<String> groups;

  public UserIdentity(
      String userId,
      String displayName,
      String email,
      String tenantId,
      List<String> roles,
      List<String> groups) {
    this.userId = userId;
    this.displayName = displayName;
    this.email = email;
    this.tenantId = tenantId;
    this.roles = roles;
    this.groups = groups;
  }

  /**
   * Create UserIdentity from Azure AD token claims.
   *
   * @param claims Azure AD JWT claims
   * @return UserIdentity instance
   * @throws IllegalArgumentException if required claims are missing
   */
  public static UserIdentity fromAzureAdToken(AzureAdTokenClaims claims) {
    if (claims == null) {
      throw new IllegalArgumentException("Claims cannot be null");
    }

    claims.validate(); // Ensure required claims are present

    return new UserIdentity(
        claims.getObjectId(),
        claims.getName(),
        claims.getEmail() != null ? claims.getEmail() : claims.getPreferredUsername(),
        claims.getTenantId(),
        claims.getRoles(),
        claims.getGroups());
  }

  public String getUserId() {
    return userId;
  }

  public String getDisplayName() {
    return displayName;
  }

  public String getEmail() {
    return email;
  }

  public String getTenantId() {
    return tenantId;
  }

  public List<String> getRoles() {
    return roles;
  }

  public List<String> getGroups() {
    return groups;
  }

  /**
   * Check if user has a specific role.
   *
   * @param role Role name to check
   * @return true if user has the role
   */
  public boolean hasRole(String role) {
    return roles != null && roles.contains(role);
  }

  /**
   * Check if user belongs to a specific group.
   *
   * @param group Group name to check
   * @return true if user belongs to the group
   */
  public boolean belongsToGroup(String group) {
    return groups != null && groups.contains(group);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    UserIdentity that = (UserIdentity) o;
    return Objects.equals(userId, that.userId) && Objects.equals(tenantId, that.tenantId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, tenantId);
  }

  @Override
  public String toString() {
    return "UserIdentity{"
        + "userId='"
        + userId
        + '\''
        + ", displayName='"
        + displayName
        + '\''
        + ", email='"
        + email
        + '\''
        + ", tenantId='"
        + tenantId
        + '\''
        + ", roles="
        + roles
        + ", groups="
        + groups
        + '}';
  }
}
