
export interface Permission {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface RoleWithPermissions extends Role {
  permissionIds: string[];
  permissions?: Permission[]; // Optionally include full permission objects
}

// For the form
export interface RoleFormValues {
  name: string;
  description?: string | null;
  permissionIds: string[];
}
