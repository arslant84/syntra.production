import { useEffect, useState } from 'react';

export interface UserDetails {
  requestorName: string;
  staffId: string;
  department: string;
  position: string | null;
}

export function useUserDetails() {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user-details');

        if (!response.ok) {
          const errorText = await response.text();
          console.error('User details API error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to fetch user details: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const data = await response.json();
        setUserDetails(data);
      } catch (err) {
        console.error('Error fetching user details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  return { userDetails, loading, error };
}