/**
 * Admin permission management types
 */

import type { SecurableType, Privilege } from '../api/catalog.gen';

export interface PermissionListItem {
  securableType: SecurableType;
  securableName: string;
  privilege: Privilege;
  principal: string;
}

export { SecurableType, Privilege };
