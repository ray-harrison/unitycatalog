# Path Credentials Authorization

This document explains how Unity Catalog handles authorization for temporary path credentials, particularly for external table creation.

## Background

When creating external tables in Unity Catalog through Spark, the system needs to:
1. Verify the user has permission to create tables
2. Generate temporary credentials for accessing the storage location
3. Pass these credentials to Spark for table creation

## The Challenge

The `generateTemporaryPathCredentials` API originally required METASTORE OWNER privileges, which meant only admin users could create external tables. This was overly restrictive since users with CREATE_TABLE permissions should be able to create external tables.

## Solution

The authorization has been updated to:

1. **Always allow METASTORE OWNER** - Admin users retain full access
2. **Allow PATH_CREATE_TABLE operations** - Users creating tables can get credentials
3. **Restrict other operations** - PATH_READ and PATH_READ_WRITE still require OWNER

### Authorization Expression

```java
@AuthorizeExpression("""
    #authorize(#principal, #metastore, OWNER) ||
    (#generateTemporaryPathCredential.operation.name() == 'PATH_CREATE_TABLE')
""")
```

## How It Works

### Creating External Tables

When a user with CREATE_TABLE permission creates an external table:

1. **Spark requests table creation** with a LOCATION clause
2. **Unity Catalog checks** CREATE_TABLE permission in TableService
3. **Spark requests path credentials** with PATH_CREATE_TABLE operation
4. **Path credentials are granted** without requiring OWNER
5. **Table is created** with the temporary credentials

### Security Considerations

- The actual table creation permission is still checked in `TableService.createTable()`
- Users can only get credentials for PATH_CREATE_TABLE, not for general read/write
- The credentials are scoped to the specific path and operation
- This maintains security while enabling non-admin users to create external tables

## Example Permissions

A user needs these permissions to create an external table:

```
- USE_CATALOG on the target catalog
- USE_SCHEMA + CREATE_TABLE on the target schema
```

They do NOT need:
- METASTORE OWNER
- Schema or Catalog OWNER

## API Operations

### PATH_CREATE_TABLE
- **Who can use**: Any user creating a table with proper schema permissions
- **Credentials granted**: Read + Write (needed for table initialization)
- **Use case**: Creating external Delta/Parquet/CSV tables

### PATH_READ
- **Who can use**: METASTORE OWNER only
- **Credentials granted**: Read-only
- **Use case**: Administrative operations

### PATH_READ_WRITE  
- **Who can use**: METASTORE OWNER only
- **Credentials granted**: Read + Write
- **Use case**: Administrative operations

## Spark Integration

The Spark connector automatically uses PATH_CREATE_TABLE when:
- Creating a table with a LOCATION clause
- The table is EXTERNAL (not managed)

Example:
```sql
CREATE TABLE catalog.schema.my_table (
  id INT,
  name STRING
) USING delta
LOCATION 's3://my-bucket/my-table'
```

This will request PATH_CREATE_TABLE credentials, allowing non-admin users to create the table.