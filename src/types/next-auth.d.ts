// src/types/next-auth.d.ts
import type { DefaultSession, User as NextAuthUser } from "next-auth";
import type { JWT as NextAuthJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends NextAuthUser {
    id: string; // Add your custom properties here
    role?: string | null; // This will hold the role name for display
    roleId?: string | null;
    permissions?: string[];
  }

  interface Session extends DefaultSession {
    user: User & DefaultSession["user"]; // Ensure compatibility with DefaultSession
  }
}

declare module "next-auth/jwt" {
  interface JWT extends NextAuthJWT {
    uid?: string; // User ID
    role?: string | null; // Role name
    roleId?: string | null;
    permissions?: string[];
  }
}
