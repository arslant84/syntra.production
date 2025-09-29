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
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to fetch user details: ${response.status} ${response.statusText}`;
          
          if (contentType.includes('application/json')) {
            try {
              const errorData = await response.json();
              errorMessage = errorData?.error || errorData?.message || errorMessage;
            } catch {
              // If JSON parsing fails, use the default error message
            }
          } else {
            // For non-JSON responses (like HTML 503 pages), use status text
            errorMessage = `Failed to fetch user details: ${response.status}`;
          }
          
          throw new Error(errorMessage);
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