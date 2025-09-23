# Azure Bootstrap Guide for Unity Catalog

This guide walks through the complete process for first-time users to bootstrap Unity Catalog with Azure AD authentication and obtain access tokens for CLI/API usage.

## Overview

Unity Catalog provides **two bootstrap approaches** for Azure AD integration:

1. **UI-Based Bootstrap** (`/api/1.0/unity-control/auth/bootstrap/token-exchange`) - Interactive flow returning Unity Catalog access tokens
2. **Admin Bootstrap** (`/api/2.1/unity-catalog/admins/bootstrap-owner`) - Programmatic endpoint creating OWNER with PAT tokens

Choose the approach that fits your deployment scenario:

- **UI-Based**: Interactive first-time setup with web browser
- **Admin Bootstrap**: Automated deployment with Helm/scripts

---

## UI-Based Bootstrap Flow

### Prerequisites

Before starting, ensure you have:

1. **Azure AD Application configured** with:
   - Client ID and tenant ID  
   - Redirect URI: `http://localhost:8080/api/1.0/unity-control/auth/azure-login/callback`
   - Required permissions for OpenID Connect (openid, profile, email scopes)

2. **Unity Catalog server configured** with bootstrap enabled:
   ```properties
   # Bootstrap Configuration
   server.bootstrap.enabled=true
   server.bootstrap.window-minutes=30
   server.bootstrap.initial-owner-upn=your-email@company.com
   
   # Azure AD Configuration  
   server.azure-ad.tenant-id=your-tenant-id
   server.azure-ad.client-id=your-client-id
   
   # OAuth Configuration
   server.authorization=enable
   server.authorization-url=https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize
   server.token-url=https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/token
   server.client-id=your-oauth-client-id
   server.client-secret=your-oauth-client-secret
   ```

3. **Tools installed**:
   - `curl` for API calls
   - `jq` for JSON processing (recommended)
   - Unity Catalog CLI (`bin/uc`)

### Step-by-Step UI Bootstrap Process

#### Step 1: Start Unity Catalog Server with Bootstrap

Start the Unity Catalog server with bootstrap enabled:

```bash
# Ensure bootstrap configuration is set in etc/conf/server.properties
./bin/start-uc-server &
```

**Verify bootstrap is enabled:**
```bash
curl -X POST http://localhost:8080/api/1.0/unity-control/auth/bootstrap/token-exchange \
  -H "Authorization: Bearer invalid-token" 2>&1 | grep -q "Bootstrap is disabled" && echo "❌ Bootstrap disabled" || echo "✅ Bootstrap enabled"
```

The server should be running on `http://localhost:8080` by default.

#### Step 2: Access Bootstrap UI

Open your web browser to the Unity Catalog UI with bootstrap mode:

```
http://localhost:3000?bootstrap=true
```

The UI will guide you through the Azure authentication process automatically.

#### Step 3: Alternative - Manual API Flow

For manual API testing, you can use the same flow the UI uses:

**3a. Initiate Azure OAuth2 Flow:**
```bash
curl -X POST http://localhost:8080/api/1.0/unity-control/auth/azure-login/start \
  -H "Content-Type: application/json" \
  -d "{}"
```

**3b. Complete Azure Authentication in Browser**

**3c. Exchange Azure Token for Unity Catalog Token:**
```bash
curl -X POST http://localhost:8080/api/1.0/unity-control/auth/bootstrap/token-exchange \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AZURE_JWT_TOKEN"
```

#### Step 4: Verify Bootstrap Success

Test your Unity Catalog access token:

```bash
bin/uc user list --auth_token YOUR_UNITY_CATALOG_ACCESS_TOKEN
```

---

## Admin Bootstrap Flow (Helm/Automation)

For automated deployments, use the admin bootstrap endpoint that creates OWNER users with PAT tokens.

### Prerequisites

1. **Azure Service Principal or Managed Identity** with Microsoft Graph permissions
2. **Helm chart values configured** for bootstrap
3. **Unity Catalog server deployed** with admin bootstrap enabled

### Helm Configuration

Configure your `values.yaml`:

```yaml
# Enable admin bootstrap
bootstrap:
  enabled: true
  windowMinutes: 30
  initialOwner:
    upn: "admin@contoso.onmicrosoft.com"
  azure:
    # Optional: Use service principal (otherwise uses managed identity)
    clientSecretName: "azure-bootstrap-secret"

# Enable Azure AD authentication
auth:
  enabled: true
  provider: azure
  clientSecretName: "azure-oauth-secret"
  azureAuthority: "https://login.microsoftonline.com/your-tenant-id"
  
# Server configuration
server:
  config:
    extraProperties:
      server.bootstrap.enabled: "true"
      server.azure-ad.tenant-id: "your-tenant-id"
      server.azure-ad.client-id: "your-client-id"
```

### Create Required Secrets

```bash
# Azure OAuth secret for server
kubectl create secret generic azure-oauth-secret \
  --from-literal=clientId="your-oauth-client-id" \
  --from-literal=clientSecret="your-oauth-client-secret"

# Azure bootstrap secret for job (optional - uses managed identity if not provided)
kubectl create secret generic azure-bootstrap-secret \
  --from-literal=clientId="your-service-principal-id" \
  --from-literal=clientSecret="your-service-principal-secret" \
  --from-literal=tenantId="your-tenant-id"
```

### Deploy with Bootstrap

```bash
# Deploy Unity Catalog with bootstrap enabled
helm install unitycatalog ./helm -f values.yaml

# Check bootstrap job status
kubectl get jobs -l app.kubernetes.io/name=unitycatalog
kubectl logs job/unitycatalog-azure-bootstrap

# Retrieve generated PAT token
kubectl get secret unitycatalog-bootstrap-pat-token -o jsonpath='{.data.token}' | base64 -d
```

### API Endpoint Reference

The admin bootstrap endpoint:

```bash
curl -X POST http://server:8080/api/2.1/unity-catalog/admins/bootstrap-owner \
  -H "Authorization: Bearer AZURE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metastoreId": "METASTORE_UUID"}'
```

**Response:**
```json
{
  "principal": "admin@contoso.com",
  "metastoreId": "uuid",
  "bootstrapCompleted": true,
  "patToken": "uc_pat_abc123...",
  "message": "OWNER privileges granted successfully"
}
```

---

## Configuration Reference

### Server Properties (Local Development)

Required configuration in `etc/conf/server.properties`:

```properties
# Core Bootstrap Settings
server.bootstrap.enabled=true
server.bootstrap.window-minutes=30
server.bootstrap.initial-owner-upn=your-email@company.com

# Azure AD Integration (for JWT validation)
server.azure-ad.tenant-id=906aefe9-76a7-4f65-b82d-5ec20775d5aa
server.azure-ad.client-id=94f861fd-e211-486d-99c3-778fb5194684

# OAuth Settings (for UI login flow)  
server.authorization=enable
server.authorization-url=https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize
server.token-url=https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token
server.client-id=4f566254-43c5-4d47-9c08-11f6fae18046
server.client-secret=your-oauth-client-secret

# JWT Validation
server.jwt.issuer=https://login.microsoftonline.com/{tenant-id}/v2.0
server.jwt.audience=94f861fd-e211-486d-99c3-778fb5194684

# Optional: Domain Restrictions
bootstrap.allowedDomains=company.com,contoso.com
```

### UI Configuration

The UI requires no special configuration for bootstrap - it uses the `?bootstrap=true` query parameter to enable bootstrap mode.

### Helm Values Reference

```yaml
bootstrap:
  enabled: true                    # Enable bootstrap job
  windowMinutes: 30               # Bootstrap window duration
  initialOwner:
    upn: "admin@company.com"      # Initial OWNER UPN
  azure:
    clientSecretName: "secret"    # Optional service principal secret

auth:
  enabled: true                   # Enable OAuth
  provider: azure                 # Use Azure AD
  clientSecretName: "oauth-secret" # OAuth client credentials
  azureAuthority: "https://login.microsoftonline.com/tenant-id"

server:
  config:
    extraProperties:
      server.bootstrap.enabled: "true"
      server.azure-ad.tenant-id: "tenant-id"
      server.azure-ad.client-id: "client-id"
```

---

## Post-Bootstrap Operations

### Transitioning from Bootstrap to Production

After successful bootstrap, follow these steps:

#### 1. Disable Bootstrap Mode

**Local Development:**
```properties
# In etc/conf/server.properties, set:
server.bootstrap.enabled=false
```

**UI Configuration for Normal Authentication:**
```bash
# In ui/.env.local, enable normal Azure AD authentication:
REACT_APP_MS_AUTH_ENABLED=true
REACT_APP_AZURE_CLIENT_ID=your-azure-client-id
REACT_APP_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
```

**Helm Deployment:**
```yaml
# In values.yaml, set:
bootstrap:
  enabled: false
```

Then restart/redeploy:
```bash
# Local
pkill -f UnityCatalogServer
./bin/start-uc-server &

# Restart UI (from ui/ directory)
pkill -f react-scripts
yarn start &

# Clear browser cache and cookies for clean transition
```

**Helm:**
```bash
helm upgrade unitycatalog ./helm -f values.yaml
```

#### 2. Save Important Tokens

- **Unity Catalog Access Tokens**: Short-lived, for immediate use
- **PAT Tokens**: Long-lived, store securely for automation
- **Kubernetes Secret**: `kubectl get secret unitycatalog-bootstrap-pat-token`

#### 3. Verify Transition is Complete

**Check Bootstrap Status:**
```bash
curl http://localhost:8080/api/1.0/unity-control/admins/status/bootstrap-status
# Should return: {"bootstrapEnabled":false,"hasAzureAdmin":false,"allowedDomains":[]}
```

**Verify UI Behavior:**
- Visit `http://localhost:3000` - should show "Login with Azure" button
- Visit `http://localhost:3000/admin/debug` - bootstrap status should show `"needsBootstrap": false`
- Admin panels should be accessible after normal Azure AD login

**Test Bootstrap Endpoints are Disabled:**
```bash
# These should return error responses when bootstrap is disabled:
curl -X POST http://localhost:8080/api/1.0/unity-control/auth/azure-login/start \
  -H "Content-Type: application/json" -d '{}'
# Expected: 500 Internal Server Error - "Bootstrap is disabled"
```

#### 4. Set Up Additional Users

With OWNER privileges established, you can now:

- **Create additional users** through normal Azure AD login
- **Assign privileges** using Unity Catalog admin APIs
- **Issue PAT tokens** for service accounts and automation

#### 5. Configure Production Settings

- **Remove bootstrap window**: Set `server.bootstrap.window-minutes=0` or remove
- **Update domain restrictions**: Configure `bootstrap.allowedDomains` as needed
- **Enable audit logging**: Configure comprehensive audit trails
- **Set up monitoring**: Monitor authorization and authentication events

### Managing Additional Users

After bootstrap, normal user onboarding flow:

```bash
# Users authenticate via standard OAuth (no bootstrap)
# Then assign privileges as needed
curl -X POST http://server:8080/api/2.1/unity-catalog/users/{user-id}/privileges \
  -H "Authorization: Bearer OWNER_PAT_TOKEN" \
  -d '{"privilege": "CREATE_CATALOG", "securable_type": "METASTORE"}'
```

---

## What Happens During Bootstrap

### Technical Flow Overview

1. **Authentication**: Azure AD validates user credentials and issues JWT
2. **Authorization**: Unity Catalog validates Azure JWT against tenant JWKS
3. **User Creation**: New user record created from Azure claims (oid, email, name)
4. **Privilege Assignment**: OWNER privileges granted automatically during bootstrap window
5. **Token Issuance**: Unity Catalog access token or PAT token issued
6. **State Tracking**: Bootstrap completion recorded to prevent re-bootstrapping

### Key Security Features

- **Time-bounded**: Bootstrap window limits exposure
- **Domain restrictions**: Optional email domain validation
- **Audit trails**: All bootstrap activities logged
- **Idempotency**: Safe to retry bootstrap operations
- **JWT validation**: Full Azure AD token validation with JWKS

### API Endpoints Behind the Scenes

#### UI Bootstrap Flow:
```
1. GET  /api/1.0/unity-control/auth/azure-login/start
2. GET  /api/1.0/unity-control/auth/azure-login/callback
3. POST /api/1.0/unity-control/auth/bootstrap/token-exchange
```

#### Admin Bootstrap Flow:
```
1. POST /api/2.1/unity-catalog/admins/bootstrap-owner
```

#### Authentication & Authorization:
- **Middleware exclusions**: Bootstrap endpoints bypass normal auth
- **Custom validation**: Direct JWT validation in bootstrap services
- **JCasbin integration**: Explicit privilege assignment to authorization system

---

## Troubleshooting

### Configuration Issues

**❌ "Bootstrap is disabled"**
```bash
# Check server properties
grep "server.bootstrap.enabled" etc/conf/server.properties

# For Helm deployments
kubectl describe configmap unitycatalog-server-config
```

**❌ "Invalid tenant configuration"**
```bash
# Verify Azure AD settings match
# server.azure-ad.tenant-id should match your Azure tenant
# server.azure-ad.client-id should match application registration
```

**❌ UI shows "Bootstrap mode not available"**
```bash
# Ensure UI is accessed with ?bootstrap=true parameter
# Check that server bootstrap is enabled
curl http://localhost:8080/api/1.0/unity-control/auth/bootstrap/token-exchange \
  -H "Authorization: Bearer test" 2>&1 | grep -v "Bootstrap is disabled"
```

### Authentication Issues

**❌ "JWT validation failed"**
```bash
# Check Azure AD application configuration:
# - Correct tenant ID in issuer URL
# - Valid audience (client ID)
# - Token not expired
# - Network access to Azure AD JWKS endpoints

# Test JWKS endpoint access
curl https://login.microsoftonline.com/{tenant-id}/discovery/v2.0/keys
```

**❌ "Domain not allowed"**
```bash
# Check domain restrictions
grep "bootstrap.allowedDomains" etc/conf/server.properties

# Or remove restrictions temporarily
# bootstrap.allowedDomains=
```

### Helm Deployment Issues

**❌ Bootstrap job failed**
```bash
# Check job logs
kubectl logs job/unitycatalog-azure-bootstrap

# Check Azure authentication
kubectl describe secret azure-bootstrap-secret

# Verify server readiness
kubectl get pods -l app.kubernetes.io/name=unitycatalog
```

**❌ "Server not ready"**
```bash
# Check server startup logs
kubectl logs deployment/unitycatalog-server

# Verify service connectivity
kubectl port-forward svc/unitycatalog-server 8080:8080
curl http://localhost:8080/api/2.1/unity-catalog/metastore_summary
```

### Token Issues

**❌ "Access token expired"**
- Azure JWT tokens expire in ~1 hour
- Unity Catalog tokens have configurable expiration
- Use PAT tokens for long-running processes

**❌ "PAT token not found"**
```bash
# Check Kubernetes secret
kubectl get secret unitycatalog-bootstrap-pat-token -o yaml

# Or use admin API to create new PAT
curl -X POST http://server:8080/api/2.1/unity-catalog/tokens \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -d '{"comment": "Bootstrap PAT", "lifetime_seconds": 86400}'
```

### Debug Logging

Enable detailed logging for troubleshooting:

```properties
# In server.properties
logging.level=DEBUG

# Or for specific components
logging.level.io.unitycatalog.server.service.BootstrapTokenExchangeService=DEBUG
logging.level.io.unitycatalog.server.security.jwt=DEBUG
```

---

## Complete Example Workflows

### Local Development Setup

```bash
# 1. Configure server
cat >> etc/conf/server.properties << EOF
server.bootstrap.enabled=true
server.bootstrap.window-minutes=30
server.azure-ad.tenant-id=your-tenant-id
server.azure-ad.client-id=your-client-id
server.authorization=enable
server.authorization-url=https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize
server.token-url=https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/token
server.client-id=your-oauth-client-id
server.client-secret=your-oauth-secret
EOF

# 2. Start server
./bin/start-uc-server &

# 3. Open UI for bootstrap
open "http://localhost:3000?bootstrap=true"

# 4. Follow UI prompts, then verify
UC_TOKEN="your-token-from-ui"
bin/uc user list --auth_token "$UC_TOKEN"

# 5. Disable bootstrap after success
sed -i '' 's/server.bootstrap.enabled=true/server.bootstrap.enabled=false/' etc/conf/server.properties
pkill -f UnityCatalogServer
./bin/start-uc-server &
```

### Helm Production Deployment

```bash
# 1. Create secrets
kubectl create secret generic azure-oauth-secret \
  --from-literal=clientId="your-oauth-client-id" \
  --from-literal=clientSecret="your-oauth-client-secret"

# 2. Deploy with bootstrap
cat > values-bootstrap.yaml << EOF
bootstrap:
  enabled: true
  initialOwner:
    upn: "admin@company.com"
auth:
  enabled: true
  provider: azure
  clientSecretName: "azure-oauth-secret"
  azureAuthority: "https://login.microsoftonline.com/your-tenant-id"
server:
  config:
    extraProperties:
      server.bootstrap.enabled: "true"
      server.azure-ad.tenant-id: "your-tenant-id"
      server.azure-ad.client-id: "your-client-id"
EOF

helm install unitycatalog ./helm -f values-bootstrap.yaml

# 3. Wait for bootstrap completion
kubectl wait --for=condition=complete job/unitycatalog-azure-bootstrap --timeout=300s

# 4. Retrieve PAT token
kubectl get secret unitycatalog-bootstrap-pat-token -o jsonpath='{.data.token}' | base64 -d > pat-token.txt

# 5. Update to production (disable bootstrap)
cat > values-production.yaml << EOF
bootstrap:
  enabled: false
auth:
  enabled: true
  provider: azure
  clientSecretName: "azure-oauth-secret"
  azureAuthority: "https://login.microsoftonline.com/your-tenant-id"
EOF

helm upgrade unitycatalog ./helm -f values-production.yaml

# 6. Verify with PAT token
PAT_TOKEN=$(cat pat-token.txt)
curl -H "Authorization: Bearer $PAT_TOKEN" \
  http://unitycatalog-server:8080/api/2.1/unity-catalog/users
```

---

## Troubleshooting

### Common Issues and Solutions

#### Bootstrap Still Available After Disabling

**Problem**: Bootstrap endpoints still work even after setting `server.bootstrap.enabled=false`

**Solution**: 
1. Verify property key is exactly `server.bootstrap.enabled` (not `bootstrap.enabled`)
2. Restart server after configuration change
3. Test bootstrap status: `curl http://localhost:8080/api/1.0/unity-control/admins/status/bootstrap-status`

#### UI Shows Bootstrap Mode After Transition

**Problem**: UI redirects to bootstrap flow even with `REACT_APP_MS_AUTH_ENABLED=true`

**Solutions**:
1. Clear browser cache and cookies completely
2. Restart the UI development server
3. Verify correct environment variables:
   ```bash
   REACT_APP_MS_AUTH_ENABLED=true
   REACT_APP_AZURE_CLIENT_ID=your-azure-client-id
   REACT_APP_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
   ```

#### "Invalid access token" Errors

**Problem**: JWT validation failures during bootstrap

**Solutions**:
1. Verify Azure AD tenant ID matches configuration
2. Check Azure JWT issuer URL format: `https://login.microsoftonline.com/{tenant-id}/v2.0`
3. Ensure Azure application has correct redirect URI configured
4. Check server logs for specific JWT validation errors

#### Property Key Inconsistencies

**Problem**: Different services use different property keys

**Known Keys**:
- `server.bootstrap.enabled` - BootstrapTokenExchangeService, AzureLoginService
- `server.bootstrap.window-minutes` - Bootstrap time window
- `server.azure-ad.tenant-id` - Azure AD tenant configuration
- `server.azure-ad.client-id` - Azure AD client configuration

#### 404 Errors on Bootstrap Endpoints

**Problem**: Bootstrap endpoints return 404 Not Found

**Solution**: Verify correct endpoint paths:
- Bootstrap status: `/api/1.0/unity-control/admins/status/bootstrap-status`
- Azure login start: `/api/1.0/unity-control/auth/azure-login/start`
- Token exchange: `/api/1.0/unity-control/auth/bootstrap/token-exchange`

---

## Next Steps

After successful bootstrap:

1. **🔐 Secure Token Storage**: Store PAT tokens in secure credential management
2. **👥 User Management**: Set up additional users and role assignments  
3. **📊 Monitoring**: Configure authentication and authorization monitoring
4. **🔄 Automation**: Use PAT tokens for CI/CD and automation workflows
5. **📚 Documentation**: Document your specific deployment procedures

For more information, see:
- [Unity Catalog CLI Documentation](../README.md)
- [API Reference](../api/README.md)
- [Helm Chart Documentation](../helm/README.md)
- [Server Configuration Guide](deployment.md)
