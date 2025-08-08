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
          return null;
        }

        // Fetch user from DB
        const users = await sql`
          SELECT id, name, email, password, role_id, role
          FROM users
          WHERE email = ${credentials.email}
          LIMIT 1
        `;

        if (!users.length) return null;
        const user = users[0];

        // Check password (plaintext for now; use bcrypt in production)
        if (credentials.password !== user.password) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.role_id,
          role: user.role,
        };
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

        // Update last login time
        try {
          await sql`
            UPDATE users 
            SET last_login_at = NOW() 
            WHERE id = ${user.id}
          `;
          console.log(`JWT Callback: Updated last login time for user ${user.id}`);
        } catch (error) {
          console.error('JWT Callback: Error updating last login time:', error);
        }

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
