// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@/lib/db'; // Assuming named export

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'YOUR_STRONG_RANDOM_SECRET_HERE_PLEASE_REPLACE_ME') {
  const errorMessage = "FATAL ERROR: NEXTAUTH_SECRET is not set or is still the placeholder. Please generate a strong secret and set it in your .env file.";
  console.error(errorMessage);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(errorMessage);
  } else {
    console.warn("Application is running in development with a missing or placeholder NEXTAUTH_SECRET. This is insecure and may cause issues.");
  }
}


export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) {
          console.log('Auth: Missing credentials');
          return null;
        }

        // --- Mock User Fetch & Role Assignment ---
        // In a real app, you'd query your database here for the user by email
        // and verify their password (e.g., using bcrypt.compare).

        let mockUser: { id: string; name: string; email: string; roleId: string | null; roleName?: string } | null = null;

        // Simulate fetching user and their role_id from DB
        // For this mock, we'll assign a role_id based on email.
        // You should replace these with actual role UUIDs from your 'roles' table.
        // For simplicity, I'm using placeholder role names to query role IDs.
        // Ensure these roles exist in your `roles` table.

        const emailLower = credentials.email.toLowerCase();
        let targetRoleName = 'Requestor'; // Default role

        if (emailLower.includes('admin')) {
          targetRoleName = 'System Administrator';
        } else if (emailLower.includes('hod')) {
          targetRoleName = 'HOD'; // Assuming you have an 'HOD' role
        } else if (emailLower.includes('finance')) {
          targetRoleName = 'Finance Clerk'; // Assuming 'Finance Clerk' role
        }
        
        console.log(`Auth: Attempting to find role_id for roleName: ${targetRoleName}`);
        
        try {
            const roleResult = await sql`SELECT id FROM roles WHERE name = ${targetRoleName} LIMIT 1`;
            let fetchedRoleId: string | null = null;
            if (roleResult && roleResult.count > 0) {
                fetchedRoleId = roleResult[0].id as string;
                console.log(`Auth: Found role_id ${fetchedRoleId} for roleName ${targetRoleName}`);
            } else {
                console.warn(`Auth: Role named "${targetRoleName}" not found in database. Defaulting user roleId to null.`);
            }

            mockUser = {
                id: `mock-user-${Math.random().toString(36).substring(7)}`, // Mock user ID
                name: credentials.email.split('@')[0], // Mock name from email
                email: credentials.email,
                roleId: fetchedRoleId,
                roleName: fetchedRoleId ? targetRoleName : null, // Store roleName for immediate use in JWT
            };

        } catch (dbError) {
            console.error("Auth: Database error during role lookup in authorize:", dbError);
            // Fallback if DB query fails
             mockUser = {
                id: `mock-user-${Math.random().toString(36).substring(7)}`,
                name: credentials.email.split('@')[0],
                email: credentials.email,
                roleId: null, // No role if DB fails
            };
        }


        if (mockUser) {
          console.log('Auth: User authorized (mock):', { id: mockUser.id, email: mockUser.email, roleId: mockUser.roleId, roleName: mockUser.roleName });
          return {
            id: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            roleId: mockUser.roleId, // Pass roleId to JWT callback
            role: mockUser.roleName,   // Pass roleName to JWT callback as 'role'
          };
        } else {
          console.log('Auth: Authorization failed (mock user not found)');
          return null; // Authentication failed
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // `user` object is passed on initial sign-in
      if (user) {
        console.log('JWT Callback: Initial sign-in, user object:', user);
        token.uid = user.id;
        token.roleId = user.roleId || null; 
        token.role = user.role || null; // Role name from authorize
        token.permissions = []; // Initialize as empty

        if (token.roleId) {
          try {
            console.log(`JWT Callback: Fetching permissions for roleId: ${token.roleId}`);
            const permissionsResult = await sql`
              SELECT p.name
              FROM permissions p
              INNER JOIN role_permissions rp ON p.id = rp.permission_id
              WHERE rp.role_id = ${token.roleId}
            `;
            token.permissions = permissionsResult.map(p => p.name as string);
            console.log(`JWT Callback: Permissions for roleId ${token.roleId}:`, token.permissions);
          } catch (error) {
            console.error('JWT Callback: Error fetching permissions:', error);
            token.permissions = []; // Default to no permissions on error
          }
        } else {
            console.log('JWT Callback: No roleId found, no permissions fetched.');
        }
      }
       // If update trigger is used (e.g. for session update after profile change)
      if (trigger === "update" && session) {
        // Potentially update token with new session data if needed
        // For example, if role or permissions could be updated live
        // For now, we are not implementing live session updates beyond login
      }
      return token;
    },
    async session({ session, token }) {
      // Transfer properties from JWT token to session object
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.roleId = token.roleId;
        session.user.role = token.role; // Role name from token
        session.user.permissions = token.permissions;
        console.log('Session Callback: Session created/updated:', session);
      } else {
        console.warn("Session Callback: session.user is undefined");
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    // error: '/auth/error', // Optional: custom error page
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
