# Database Schema Management

## Overview

Unity Catalog uses **manual schema creation** via SQL scripts with **no automatic migration framework**. This document outlines how to handle database schema changes for auth/user management features, particularly for PostgreSQL deployments.

## Current Schema Management Approach

### Evidence from Codebase
- **Schema files**: `server/src/main/resources/schema-postgres.sql` contains complete PostgreSQL schema
- **Initialization logic**: `server/src/main/java/io/unitycatalog/server/persist/utils/SqlBackendUtils.java:44-67` checks for existing tables and creates missing ones
- **No migration framework**: Unity Catalog does **not** use Flyway, Liquibase, or similar tools

### What Happens Automatically
- ✅ **New tables**: Created if they don't exist during server startup
- ❌ **New columns**: Will cause SQL errors if application code expects them
- ❌ **Modified columns**: No migration logic exists
- ❌ **Data migrations**: Must be handled manually

## Schema Change Process

### 1. Update Base Schema File
Update `server/src/main/resources/schema-postgres.sql` with new schema elements:

```sql
-- Add new columns with IF NOT EXISTS (PostgreSQL 9.6+)
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_object_id VARCHAR(255);
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Add new tables for auth/user management
CREATE TABLE IF NOT EXISTS uc_user_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES uc_users(id) ON DELETE CASCADE,
    token_name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Create Migration Scripts
For existing deployments, create migration scripts in `server/src/main/resources/migrations/`:

```sql
-- server/src/main/resources/migrations/001-azure-auth.sql
-- Migration for Azure AD authentication features
-- Run manually before server upgrade

DO $$ 
BEGIN
    -- Check if columns exist before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='uc_users' AND column_name='azure_object_id') THEN
        ALTER TABLE uc_users ADD COLUMN azure_object_id VARCHAR(255) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='uc_users' AND column_name='azure_tenant_id') THEN
        ALTER TABLE uc_users ADD COLUMN azure_tenant_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='uc_users' AND column_name='last_login_at') THEN
        ALTER TABLE uc_users ADD COLUMN last_login_at TIMESTAMP;
    END IF;
END $$;

-- Create PAT tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS uc_user_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES uc_users(id) ON DELETE CASCADE,
    token_name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    scopes TEXT[], -- PostgreSQL array for token scopes
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON uc_user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_hash ON uc_user_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_tokens_active ON uc_user_tokens(is_active) WHERE is_active = true;
```

### 3. Production Deployment Process

#### For Local Development (H2)
```bash
# H2 database - restart server (schema recreated automatically)
pkill -f UnityCatalogServer
./bin/start-uc-server &
```

#### For PostgreSQL Production
```bash
# 1. Apply migration before server restart
psql -h your-postgres-host -d unitycatalog -f server/src/main/resources/migrations/001-azure-auth.sql

# 2. Verify migration success
psql -h your-postgres-host -d unitycatalog -c "\d uc_users"
psql -h your-postgres-host -d unitycatalog -c "\d uc_user_tokens"

# 3. Restart server with new code
helm upgrade unitycatalog ./helm -f values.yaml.prod
```

#### For Helm Deployments
```bash
# Option 1: Manual migration via kubectl
kubectl run postgres-migration --rm -i --tty --image=postgres:15 -- \
  psql postgres://user:pass@postgres-host:5432/unitycatalog \
  -f /migrations/001-azure-auth.sql

# Option 2: Init container (future enhancement)
# Add init container to Helm chart for automatic migrations
```

## Schema Requirements for Auth/User Management

### Azure AD Integration Schema
```sql
-- Azure AD user fields
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_object_id VARCHAR(255) UNIQUE;
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_tenant_id VARCHAR(255);
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_upn VARCHAR(255); -- User Principal Name

-- Audit fields for authentication tracking
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
```

### Personal Access Tokens (PAT) Schema
```sql
-- PAT tokens table (hashed storage only)
CREATE TABLE IF NOT EXISTS uc_user_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES uc_users(id) ON DELETE CASCADE,
    token_name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash, never store plaintext
    scopes TEXT[], -- PostgreSQL array: ['read:catalog', 'write:schema']
    expires_at TIMESTAMP, -- NULL = never expires
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints
    CONSTRAINT uc_user_tokens_name_user_unique UNIQUE (user_id, token_name)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON uc_user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_hash ON uc_user_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_tokens_active ON uc_user_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires ON uc_user_tokens(expires_at) WHERE expires_at IS NOT NULL;
```

### Bootstrap Owner Schema
```sql
-- Bootstrap tracking (optional)
CREATE TABLE IF NOT EXISTS uc_bootstrap_history (
    id BIGSERIAL PRIMARY KEY,
    azure_object_id VARCHAR(255) NOT NULL,
    azure_upn VARCHAR(255) NOT NULL,
    bootstrapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL
);
```

## Integration with Bootstrap Process

### Schema Requirements for Azure Bootstrap
Based on `server/src/main/java/io/unitycatalog/server/service/BootstrapTokenExchangeService.java:73-89`:

```sql
-- Required for Azure AD bootstrap user creation
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_object_id VARCHAR(255) UNIQUE;

-- Required for OWNER privilege assignment
-- (uses existing uc_permissions/uc_role_assignments tables)
```

### Bootstrap-Safe Migrations
Ensure migrations are idempotent and bootstrap-compatible:

```sql
-- Safe: Uses IF NOT EXISTS
CREATE TABLE IF NOT EXISTS uc_user_tokens (...);
ALTER TABLE uc_users ADD COLUMN IF NOT EXISTS azure_object_id VARCHAR(255);

-- Unsafe: Would fail if table/column exists
CREATE TABLE uc_user_tokens (...);
ALTER TABLE uc_users ADD COLUMN azure_object_id VARCHAR(255);
```

## Schema Versioning Strategy

### Current: Manual Tracking
- Document schema changes in git commit messages
- Version migration scripts numerically: `001-azure-auth.sql`, `002-pat-enhancements.sql`
- Test migrations on development environment first

### Future: Migration Framework
Consider implementing proper schema versioning following Unity Catalog's additive API evolution:

```sql
-- Track applied migrations (future enhancement)
CREATE TABLE IF NOT EXISTS uc_schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    checksum VARCHAR(64) -- for integrity validation
);
```

## Security Considerations

### PAT Token Storage
- **Never store plaintext tokens** - only SHA-256 hashes
- **Display tokens once** during creation
- **Audit token usage** via last_used_at timestamps

### Migration Script Security
- **No secrets in migration files** - parameterize sensitive values
- **Test rollback procedures** before production deployment
- **Backup before migrations** in production

## Risk Mitigation

### Pre-Migration Checklist
- [ ] Test migration on development environment
- [ ] Backup production database
- [ ] Verify application compatibility with new schema
- [ ] Plan rollback strategy
- [ ] Schedule maintenance window for production

### Rollback Strategy
```sql
-- Example rollback for Azure auth migration
ALTER TABLE uc_users DROP COLUMN IF EXISTS azure_object_id;
ALTER TABLE uc_users DROP COLUMN IF EXISTS azure_tenant_id;
ALTER TABLE uc_users DROP COLUMN IF EXISTS azure_upn;
ALTER TABLE uc_users DROP COLUMN IF EXISTS last_login_at;
DROP TABLE IF EXISTS uc_user_tokens;
DROP TABLE IF EXISTS uc_bootstrap_history;
```

## Post-Migration Verification

### Schema Validation
```sql
-- Verify Azure auth columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'uc_users' 
AND column_name IN ('azure_object_id', 'azure_tenant_id', 'azure_upn', 'last_login_at')
ORDER BY ordinal_position;

-- Verify PAT tokens table exists with correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'uc_user_tokens' 
ORDER BY ordinal_position;

-- Check constraints and indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('uc_users', 'uc_user_tokens');
```

### Application Health Checks
After schema migration, verify:
- [ ] Server starts without SQL errors (`etc/logs/server.log`)
- [ ] Bootstrap process works with new schema (`/api/1.0/unity-control/auth/bootstrap/token-exchange`)
- [ ] User management features function correctly (`/api/2.1/unity-catalog/users/*`)
- [ ] PAT token endpoints work (`/api/2.1/unity-catalog/tokens/*`)

## Future Enhancements

### Migration Framework Integration
Following Unity Catalog's additive evolution principles:

```java
// Future: Migration runner in SqlBackendUtils
public class MigrationRunner {
    public void runMigrations(Connection conn) {
        // Check uc_schema_migrations table
        // Apply pending migrations additively
        // Record successful migrations with checksums
    }
}
```

### Helm Chart Integration
Add migration init containers to Helm charts:

```yaml
# helm/templates/server/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "unitycatalog.fullname" . }}-db-migration
spec:
  template:
    spec:
      initContainers:
      - name: db-migrate
        image: postgres:15
        command: ["/bin/sh", "-c"]
        args:
        - |
          psql $DATABASE_URL -f /migrations/001-azure-auth.sql
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{ .Values.server.db.secretName }}
              key: connectionString
```

---

**Next Steps**: When implementing auth/user management features, create the corresponding migration scripts following this process and test thoroughly in development before production deployment.