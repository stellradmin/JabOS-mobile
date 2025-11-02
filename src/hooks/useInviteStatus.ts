import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logError, logDebug } from '../utils/logger';

export interface InviteStatus {
  remaining: number;
  total: number;
  isPremium: boolean;
  needsReset: boolean;
  lastReset: string | null;
}

export function useInviteStatus() {
  const { user } = useAuth();
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInviteStatus = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_invite_status', {
        user_uuid: user.id
      });

      if (rpcError) {
        throw rpcError;
      }

      if (data && data.length > 0) {
        const statusData = data[0];
        setInviteStatus({
          remaining: statusData.remaining ?? 0,
          total: statusData.total ?? 5,
          isPremium: statusData.is_premium ?? false,
          needsReset: statusData.needs_reset ?? false,
          lastReset: statusData.last_reset ?? null
        });

        logDebug('Invite status fetched', "Debug", {
          remaining: statusData.remaining,
          total: statusData.total,
          isPremium: statusData.is_premium
        });
      }
    } catch (err) {
      const error = err as Error;
      logError('Failed to fetch invite status', "Error", error);
      setError(error);

      // Set default free tier values on error
      setInviteStatus({
        remaining: 0,
        total: 5,
        isPremium: false,
        needsReset: false,
        lastReset: null
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInviteStatus();
  }, [fetchInviteStatus]);

  const canSendInvite = useCallback((): boolean => {
    if (!inviteStatus) return false;
    return inviteStatus.remaining > 0;
  }, [inviteStatus]);

  const refreshInviteStatus = useCallback(async () => {
    await fetchInviteStatus();
  }, [fetchInviteStatus]);

  return {
    inviteStatus,
    loading,
    error,
    canSendInvite,
    refreshInviteStatus
  };
}
