/**
 * Tests for permission validation utilities
 * Tests privilege mapping, hierarchy validation, and resource type validation
 */

import {
  PRIVILEGE_MAP,
  getValidPrivileges,
  validatePermissionHierarchy,
  isValidPrivilegeForResourceType,
} from '../../../utils/admin/permissionValidation';
import { SecurableType, Privilege } from '../../../types/api/catalog.gen';

describe('Permission Validation Utilities', () => {
  describe('PRIVILEGE_MAP', () => {
    it('should define privileges for metastore', () => {
      expect(PRIVILEGE_MAP[SecurableType.metastore]).toEqual([Privilege.CREATE_CATALOG]);
    });

    it('should define privileges for catalog', () => {
      expect(PRIVILEGE_MAP[SecurableType.catalog]).toEqual([
        Privilege.USE_CATALOG,
        Privilege.CREATE_SCHEMA,
      ]);
    });

    it('should define privileges for schema', () => {
      expect(PRIVILEGE_MAP[SecurableType.schema]).toEqual([
        Privilege.USE_SCHEMA,
        Privilege.CREATE_TABLE,
        Privilege.CREATE_FUNCTION,
        Privilege.CREATE_VOLUME,
      ]);
    });

    it('should define privileges for table', () => {
      expect(PRIVILEGE_MAP[SecurableType.table]).toEqual([
        Privilege.SELECT,
        Privilege.MODIFY,
      ]);
    });

    it('should define privileges for volume', () => {
      expect(PRIVILEGE_MAP[SecurableType.volume]).toEqual([Privilege.READ_VOLUME]);
    });

    it('should define privileges for function', () => {
      expect(PRIVILEGE_MAP[SecurableType.function]).toEqual([Privilege.EXECUTE]);
    });

    it('should define privileges for registered_model', () => {
      expect(PRIVILEGE_MAP[SecurableType.registered_model]).toEqual([
        Privilege.CREATE_MODEL,
      ]);
    });
  });

  describe('getValidPrivileges', () => {
    it('should return valid privileges for metastore', () => {
      const privileges = getValidPrivileges(SecurableType.metastore);
      expect(privileges).toEqual([Privilege.CREATE_CATALOG]);
    });

    it('should return valid privileges for catalog', () => {
      const privileges = getValidPrivileges(SecurableType.catalog);
      expect(privileges).toContain(Privilege.USE_CATALOG);
      expect(privileges).toContain(Privilege.CREATE_SCHEMA);
    });

    it('should return valid privileges for schema', () => {
      const privileges = getValidPrivileges(SecurableType.schema);
      expect(privileges).toContain(Privilege.USE_SCHEMA);
      expect(privileges).toContain(Privilege.CREATE_TABLE);
      expect(privileges).toContain(Privilege.CREATE_FUNCTION);
      expect(privileges).toContain(Privilege.CREATE_VOLUME);
    });

    it('should return empty array for invalid resource type', () => {
      const privileges = getValidPrivileges('invalid_type' as any);
      expect(privileges).toEqual([]);
    });
  });

  describe('validatePermissionHierarchy', () => {
    describe('Schema permissions', () => {
      it('should allow schema permission when user has USE CATALOG on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.catalog,
            resourceName: 'main',
            privileges: [Privilege.USE_CATALOG],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.schema,
          resourceName: 'main.default',
          privileges: [Privilege.USE_SCHEMA],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it('should deny schema permission when user lacks USE CATALOG on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.catalog,
            resourceName: 'other',
            privileges: [Privilege.USE_CATALOG],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.schema,
          resourceName: 'main.default',
          privileges: [Privilege.USE_SCHEMA],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(false);
        expect(result.warning).toContain('USE CATALOG');
        expect(result.warning).toContain('main');
      });

      it('should extract catalog name correctly from schema full name', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.catalog,
            resourceName: 'production',
            privileges: [Privilege.USE_CATALOG],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.schema,
          resourceName: 'production.analytics',
          privileges: [Privilege.CREATE_TABLE],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
      });
    });

    describe('Table permissions', () => {
      it('should allow table permission when user has USE SCHEMA on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.schema,
            resourceName: 'main.default',
            privileges: [Privilege.USE_SCHEMA],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.table,
          resourceName: 'main.default.users',
          privileges: [Privilege.SELECT],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
      });

      it('should deny table permission when user lacks USE SCHEMA on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.schema,
            resourceName: 'main.other',
            privileges: [Privilege.USE_SCHEMA],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.table,
          resourceName: 'main.default.users',
          privileges: [Privilege.SELECT],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(false);
        expect(result.warning).toContain('USE SCHEMA');
        expect(result.warning).toContain('main.default');
      });

      it('should extract schema name correctly from table full name', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.schema,
            resourceName: 'prod.analytics',
            privileges: [Privilege.USE_SCHEMA],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.table,
          resourceName: 'prod.analytics.revenue',
          privileges: [Privilege.MODIFY],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
      });
    });

    describe('Volume permissions', () => {
      it('should allow volume permission when user has USE SCHEMA on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.schema,
            resourceName: 'main.default',
            privileges: [Privilege.USE_SCHEMA],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.volume,
          resourceName: 'main.default.my_volume',
          privileges: [Privilege.READ_VOLUME],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
      });

      it('should deny volume permission when user lacks USE SCHEMA on parent', () => {
        const existingPermissions: any[] = [];

        const newPermission = {
          resourceType: SecurableType.volume,
          resourceName: 'main.default.my_volume',
          privileges: [Privilege.READ_VOLUME],
        };

        const result = validatePermissionHierarchy(existingPermissions, newPermission as any);
        expect(result.valid).toBe(false);
        expect(result.warning).toContain('USE SCHEMA');
      });
    });

    describe('Function permissions', () => {
      it('should allow function permission when user has USE SCHEMA on parent', () => {
        const existingPermissions = [
          {
            resourceType: SecurableType.schema,
            resourceName: 'main.default',
            privileges: [Privilege.USE_SCHEMA],
          },
        ];

        const newPermission = {
          resourceType: SecurableType.function,
          resourceName: 'main.default.my_function',
          privileges: [Privilege.EXECUTE],
        };

        const result = validatePermissionHierarchy(existingPermissions as any, newPermission as any);
        expect(result.valid).toBe(true);
      });

      it('should deny function permission when user lacks USE SCHEMA on parent', () => {
        const existingPermissions: any[] = [];

        const newPermission = {
          resourceType: SecurableType.function,
          resourceName: 'main.default.my_function',
          privileges: [Privilege.EXECUTE],
        };

        const result = validatePermissionHierarchy(existingPermissions, newPermission as any);
        expect(result.valid).toBe(false);
        expect(result.warning).toContain('USE SCHEMA');
      });
    });

    describe('Metastore and catalog permissions', () => {
      it('should allow metastore permission without dependencies', () => {
        const existingPermissions: any[] = [];

        const newPermission = {
          resourceType: SecurableType.metastore,
          resourceName: 'metastore',
          privileges: [Privilege.CREATE_CATALOG],
        };

        const result = validatePermissionHierarchy(existingPermissions, newPermission as any);
        expect(result.valid).toBe(true);
      });

      it('should allow catalog permission without dependencies', () => {
        const existingPermissions: any[] = [];

        const newPermission = {
          resourceType: SecurableType.catalog,
          resourceName: 'main',
          privileges: [Privilege.USE_CATALOG],
        };

        const result = validatePermissionHierarchy(existingPermissions, newPermission as any);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('isValidPrivilegeForResourceType', () => {
    it('should return true for valid metastore privilege', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.CREATE_CATALOG, SecurableType.metastore)
      ).toBe(true);
    });

    it('should return false for invalid metastore privilege', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.SELECT, SecurableType.metastore)
      ).toBe(false);
    });

    it('should return true for valid catalog privileges', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.USE_CATALOG, SecurableType.catalog)
      ).toBe(true);
      expect(
        isValidPrivilegeForResourceType(Privilege.CREATE_SCHEMA, SecurableType.catalog)
      ).toBe(true);
    });

    it('should return false for invalid catalog privilege', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.SELECT, SecurableType.catalog)
      ).toBe(false);
    });

    it('should return true for valid schema privileges', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.USE_SCHEMA, SecurableType.schema)
      ).toBe(true);
      expect(
        isValidPrivilegeForResourceType(Privilege.CREATE_TABLE, SecurableType.schema)
      ).toBe(true);
      expect(
        isValidPrivilegeForResourceType(Privilege.CREATE_FUNCTION, SecurableType.schema)
      ).toBe(true);
      expect(
        isValidPrivilegeForResourceType(Privilege.CREATE_VOLUME, SecurableType.schema)
      ).toBe(true);
    });

    it('should return true for valid table privileges', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.SELECT, SecurableType.table)
      ).toBe(true);
      expect(
        isValidPrivilegeForResourceType(Privilege.MODIFY, SecurableType.table)
      ).toBe(true);
    });

    it('should return true for valid volume privilege', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.READ_VOLUME, SecurableType.volume)
      ).toBe(true);
    });

    it('should return true for valid function privilege', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.EXECUTE, SecurableType.function)
      ).toBe(true);
    });

    it('should return false for invalid resource type', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.SELECT, 'invalid' as any)
      ).toBe(false);
    });

    it('should return false when privilege map is undefined', () => {
      expect(
        isValidPrivilegeForResourceType(Privilege.SELECT, 'unknown_type' as any)
      ).toBe(false);
    });
  });
});
