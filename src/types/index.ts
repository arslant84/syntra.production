
export type User = {
  id: string;
  name: string;
  email: string;
  role: string; // Role name as a string
  role_id?: string | null; // UUID of the role from the roles table
  roleName?: string | null; // Alias for role name from joined query
  department?: string | null;
  staff_id?: string | null;
  gender?: 'Male' | 'Female' | null;
  status?: string; // 'Active' | 'Inactive'
  lastLogin?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;

  // These were from original mock data, might not be in the primary 'users' table
  // or could be joined from another table in a more complex setup.
  // For now, keeping them optional.
  staffPosition?: string;
  costCenter?: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ElementType;
  adminOnly?: boolean;
  children?: NavItem[];
  badge?: number;
};
