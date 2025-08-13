// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import bcrypt from 'bcryptjs';
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
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid profile email User.Read"
        }
      }
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        console.log('NEXTAUTH CREDENTIALS - Login attempt for:', credentials?.email);
        
        if (!credentials?.email || !credentials.password) {
          console.log('NEXTAUTH CREDENTIALS - Missing email or password');
          return null;
        }

        try {
          // Fetch user from DB
          const users = await sql`
            SELECT id, name, email, password, role_id, role, status
            FROM users
            WHERE email = ${credentials.email}
            LIMIT 1
          `;

          console.log('NEXTAUTH CREDENTIALS - User found:', users.length > 0);

          if (!users.length) {
            console.log('NEXTAUTH CREDENTIALS - No user found with email:', credentials.email);
            return null;
          }
          
          const user = users[0];
          console.log('NEXTAUTH CREDENTIALS - User details:', {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            hasPassword: !!user.password
          });

          // Check if user is active
          if (user.status !== 'Active') {
            console.log('NEXTAUTH CREDENTIALS - User is not active:', user.status);
            return null;
          }

          // Check password using bcrypt
          const isValidPassword = await bcrypt.compare(credentials.password, user.password);
          console.log('NEXTAUTH CREDENTIALS - Password valid:', isValidPassword);

          if (!isValidPassword) {
            console.log('NEXTAUTH CREDENTIALS - Invalid password for user:', credentials.email);
            return null;
          }

          console.log('NEXTAUTH CREDENTIALS - Login successful for:', credentials.email);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            roleId: user.role_id,
            role: user.role,
          };
        } catch (error) {
          console.error('NEXTAUTH CREDENTIALS - Error during authentication:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      console.log('JWT callback triggered', { token, user, account, trigger, session });
      
      // Handle initial sign-in
      if (user) {
        console.log('JWT Callback: Initial sign-in, user object:', user);
        
        // Handle Azure AD sign-in
        if (account?.provider === 'azure-ad') {
          console.log('JWT Callback: Azure AD sign-in detected');
          
          // Check if user exists in database, if not create them
          let dbUser;
          try {
            const existingUsers = await sql`
              SELECT id, name, email, role_id, role
              FROM users
              WHERE email = ${user.email}
              LIMIT 1
            `;

            if (existingUsers.length > 0) {
              dbUser = existingUsers[0];
              console.log('JWT Callback: Found existing user in database:', dbUser);
            } else {
              // Create new user with default role
              const newUserResult = await sql`
                INSERT INTO users (name, email, role_id, role, created_at, updated_at)
                VALUES (${user.name}, ${user.email}, 1, 'user', NOW(), NOW())
                RETURNING id, name, email, role_id, role
              `;
              dbUser = newUserResult[0];
              console.log('JWT Callback: Created new user in database:', dbUser);
            }

            token.uid = dbUser.id;
            token.roleId = dbUser.role_id;
            token.role = dbUser.role;
          } catch (error) {
            console.error('JWT Callback: Error handling Azure AD user:', error);
            token.uid = user.id;
            token.roleId = 1; // Default role
            token.role = 'user';
          }
        } else {
          // Handle credentials sign-in
          token.uid = user.id;
          token.roleId = user.roleId || null;
          token.role = user.role || null;
        }

        token.permissions = []; // Initialize as empty

        // Update last login time
        try {
          await sql`
            UPDATE users 
            SET last_login_at = NOW() 
            WHERE id = ${token.uid}
          `;
          console.log(`JWT Callback: Updated last login time for user ${token.uid}`);
        } catch (error) {
          console.error('JWT Callback: Error updating last login time:', error);
        }

        // Fetch permissions
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
      console.log('Returning token:', token);
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback triggered', { session, token });
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
      console.log('Returning session:', session);
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
