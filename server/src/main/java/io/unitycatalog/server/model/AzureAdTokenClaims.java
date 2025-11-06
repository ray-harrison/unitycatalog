package io.unitycatalog.server.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Azure Active Directory JWT token claims. Represents the decoded and validated claims from an
 * Azure AD access token.
 *
 * <p>Standard OIDC claims:
 *
 * <ul>
 *   <li>iss: Issuer (Azure AD tenant)
 *   <li>aud: Audience (application client ID)
 *   <li>exp: Expiration timestamp
 *   <li>iat: Issued-at timestamp
 *   <li>nbf: Not-before timestamp
 * </ul>
 *
 * <p>Azure AD specific claims:
 *
 * <ul>
 *   <li>oid: Object ID (unique user identifier)
 *   <li>tid: Tenant ID (Azure AD tenant)
 *   <li>name: Display name
 *   <li>email: Email address
 *   <li>roles: Application roles assigned to user
 *   <li>groups: Security groups user belongs to
 * </ul>
 */
public class AzureAdTokenClaims {

  @JsonProperty("iss")
  private String issuer;

  @JsonProperty("aud")
  private String audience;

  @JsonProperty("exp")
  private Long expiration;

  @JsonProperty("iat")
  private Long issuedAt;

  @JsonProperty("nbf")
  private Long notBefore;

  @JsonProperty("oid")
  private String objectId;

  @JsonProperty("tid")
  private String tenantId;

  @JsonProperty("name")
  private String name;

  @JsonProperty("email")
  private String email;

  @JsonProperty("preferred_username")
  private String preferredUsername;

  @JsonProperty("roles")
  private List<String> roles;

  @JsonProperty("groups")
  private List<String> groups;

  public AzureAdTokenClaims() {}

  public String getIssuer() {
    return issuer;
  }

  public void setIssuer(String issuer) {
    this.issuer = issuer;
  }

  public String getAudience() {
    return audience;
  }

  public void setAudience(String audience) {
    this.audience = audience;
  }

  public Long getExpiration() {
    return expiration;
  }

  public void setExpiration(Long expiration) {
    this.expiration = expiration;
  }

  public Long getIssuedAt() {
    return issuedAt;
  }

  public void setIssuedAt(Long issuedAt) {
    this.issuedAt = issuedAt;
  }

  public Long getNotBefore() {
    return notBefore;
  }

  public void setNotBefore(Long notBefore) {
    this.notBefore = notBefore;
  }

  public String getObjectId() {
    return objectId;
  }

  public void setObjectId(String objectId) {
    this.objectId = objectId;
  }

  public String getTenantId() {
    return tenantId;
  }

  public void setTenantId(String tenantId) {
    this.tenantId = tenantId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPreferredUsername() {
    return preferredUsername;
  }

  public void setPreferredUsername(String preferredUsername) {
    this.preferredUsername = preferredUsername;
  }

  public List<String> getRoles() {
    return roles;
  }

  public void setRoles(List<String> roles) {
    this.roles = roles;
  }

  public List<String> getGroups() {
    return groups;
  }

  public void setGroups(List<String> groups) {
    this.groups = groups;
  }

  /**
   * Validate required claims are present.
   *
   * @throws IllegalArgumentException if required claims are missing
   */
  public void validate() {
    if (issuer == null || issuer.trim().isEmpty()) {
      throw new IllegalArgumentException("Missing required claim: iss (issuer)");
    }
    if (audience == null || audience.trim().isEmpty()) {
      throw new IllegalArgumentException("Missing required claim: aud (audience)");
    }
    if (expiration == null) {
      throw new IllegalArgumentException("Missing required claim: exp (expiration)");
    }
    if (objectId == null || objectId.trim().isEmpty()) {
      throw new IllegalArgumentException("Missing required claim: oid (object ID)");
    }
    if (tenantId == null || tenantId.trim().isEmpty()) {
      throw new IllegalArgumentException("Missing required claim: tid (tenant ID)");
    }
  }

  /**
   * Check if token is expired.
   *
   * @return true if token expiration time has passed
   */
  public boolean isExpired() {
    if (expiration == null) {
      return true;
    }
    return Instant.now().getEpochSecond() >= expiration;
  }

  /**
   * Check if token is not yet valid.
   *
   * @return true if current time is before nbf claim
   */
  public boolean isNotYetValid() {
    if (notBefore == null) {
      return false;
    }
    return Instant.now().getEpochSecond() < notBefore;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    AzureAdTokenClaims that = (AzureAdTokenClaims) o;
    return Objects.equals(issuer, that.issuer)
        && Objects.equals(audience, that.audience)
        && Objects.equals(expiration, that.expiration)
        && Objects.equals(objectId, that.objectId)
        && Objects.equals(tenantId, that.tenantId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(issuer, audience, expiration, objectId, tenantId);
  }

  @Override
  public String toString() {
    return "AzureAdTokenClaims{"
        + "issuer='"
        + issuer
        + '\''
        + ", audience='"
        + audience
        + '\''
        + ", objectId='"
        + objectId
        + '\''
        + ", tenantId='"
        + tenantId
        + '\''
        + ", name='"
        + name
        + '\''
        + ", email='"
        + email
        + '\''
        + ", expiration="
        + expiration
        + '}';
  }
}
