/**
 * Permission validation utilities for Unity Catalog privilege management
 */

import type { SecurableType, Privilege } from '../../types/admin/permission';
import { Privilege as PrivilegeEnum } from '../../types/api/catalog.gen';

interface PermissionGroup {
  resourceType: SecurableType;
  resourceName: string;
  privileges: Privilege[];
}

/**
 * Mapping of resource types to their valid privileges
 */
export const PRIVILEGE_MAP: Record<SecurableType, Privilege[]> = {
  metastore: [PrivilegeEnum.CREATE_CATALOG],
  catalog: [PrivilegeEnum.USE_CATALOG, PrivilegeEnum.CREATE_SCHEMA],
  schema: [
    PrivilegeEnum.USE_SCHEMA,
    PrivilegeEnum.CREATE_TABLE,
    PrivilegeEnum.CREATE_FUNCTION,
    PrivilegeEnum.CREATE_VOLUME,
  ],
  table: [PrivilegeEnum.SELECT, PrivilegeEnum.MODIFY],
  volume: [PrivilegeEnum.READ_VOLUME],
  function: [PrivilegeEnum.EXECUTE],
  registered_model: [PrivilegeEnum.CREATE_MODEL],
};

/**
 * Get valid privileges for a given resource type
 */
export function getValidPrivileges(resourceType: SecurableType): Privilege[] {
  return PRIVILEGE_MAP[resourceType] || [];
}

/**
 * Validate permission hierarchy dependencies
 * 
 * Rules:
 * - Schema permissions require USE CATALOG on parent catalog
 * - Table/volume/function permissions require USE SCHEMA on parent schema
 */
export function validatePermissionHierarchy(
  existingPermissions: PermissionGroup[],
  newPermission: { resourceType: SecurableType; resourceName: string; privileges: Privilege[] }
): { valid: boolean; warning?: string } {
  // Schema requires parent catalog USE privilege
  if (newPermission.resourceType === 'schema') {
    const catalogName = newPermission.resourceName.split('.')[0];
    const hasUseCatalog = existingPermissions.some(
      (p) =>
        p.resourceType === 'catalog' &&
        p.resourceName === catalogName &&
        p.privileges.includes(PrivilegeEnum.USE_CATALOG)
    );

    if (!hasUseCatalog) {
      return {
        valid: false,
        warning: `User must have USE CATALOG privilege on "${catalogName}" before granting schema permissions.`,
      };
    }
  }

  // Table/volume/function require parent schema USE privilege
  if (['table', 'volume', 'function'].includes(newPermission.resourceType)) {
    const parts = newPermission.resourceName.split('.');
    if (parts.length >= 2) {
      const [catalog, schema] = parts;
      const schemaFullName = `${catalog}.${schema}`;
      
      const hasUseSchema = existingPermissions.some(
        (p) =>
          p.resourceType === 'schema' &&
          p.resourceName === schemaFullName &&
          p.privileges.includes(PrivilegeEnum.USE_SCHEMA)
      );

      if (!hasUseSchema) {
        return {
          valid: false,
          warning: `User must have USE SCHEMA privilege on "${schemaFullName}" before granting ${newPermission.resourceType} permissions.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if a privilege is valid for a resource type
 */
export function isValidPrivilegeForResourceType(
  privilege: Privilege,
  resourceType: SecurableType
): boolean {
  return PRIVILEGE_MAP[resourceType]?.includes(privilege) || false;
}
