import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Throws if the user is not authenticated or does not have one of the allowed roles.
 * Usage: await requireRole(request, ['Admin', 'System Administrator'])
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) throw new Error('Not authenticated');
  if (!allowedRoles.includes(session.user.role)) throw new Error('Forbidden');
  return session.user;
} 