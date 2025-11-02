import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface IncomingMatchRequest {
  id: string;
  requester_id: string;
  matched_user_id: string;
  status: string;
  created_at: string | null;
  expires_at: string | null;
  compatibility_score?: number | null;
}

/**
 * Subscribe to pending incoming match requests for the current user.
 * Returns a list of requests and a refresh function.
 */
export function useIncomingMatchRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<IncomingMatchRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select('*')
        .eq('matched_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as IncomingMatchRequest[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load incoming requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();

    const channel = supabase
      .channel(`incoming_match_requests:${user.id}`)
      // Listen for new requests targeting this user
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_requests',
          filter: `matched_user_id=eq.${user.id}`,
        },
        (payload) => {
          const newReq = payload.new as IncomingMatchRequest;
          if (newReq.status === 'pending') {
            setRequests((prev) => {
              const exists = prev.some((r) => r.id === newReq.id);
              return exists ? prev : [newReq, ...prev];
            });
          }
        }
      )
      // Listen for updates to requests for this user
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_requests',
          filter: `matched_user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as IncomingMatchRequest;
          setRequests((prev) => {
            const without = prev.filter((r) => r.id !== updated.id);
            // Keep only if still pending
            return updated.status === 'pending' ? [updated, ...without] : without;
          });
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const count = useMemo(() => requests.length, [requests]);

  return { requests, count, loading, error, refresh };
}

