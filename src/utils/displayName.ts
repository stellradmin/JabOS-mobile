import type { User } from '@supabase/supabase-js';

// Determines the best display name to show in UI, avoiding generic placeholders
// IMPORTANT: Never falls back to email; if no name available, returns 'User'.
export function resolveDisplayName(
  profile?: { display_name?: string | null } | null,
  user?: User | null,
  _userData?: { email?: string | null } | null
): string {
  const candidates: Array<string | null | undefined> = [
    profile?.display_name,
    // Common OAuth user metadata fields
    (user as any)?.user_metadata?.full_name,
    (user as any)?.user_metadata?.name,
    (user as any)?.user_metadata?.given_name,
    (user as any)?.user_metadata?.first_name,
  ];

  const isGeneric = (val?: string | null) => !!val && /^(viewer|user|friend)$/i.test(val.trim());

  // First non-empty, non-generic candidate
  const value = candidates.find((v) => v && v.toString().trim().length > 0 && !isGeneric(v));
  return (value || 'User').toString();
}

export function resolveFirstName(
  profile?: { display_name?: string | null } | null,
  user?: User | null,
  userData?: { email?: string | null } | null
): string {
  const name = resolveDisplayName(profile, user, userData).trim();
  const first = name.split(/\s+/)[0];
  return first || 'User';
}

export function resolveInitial(
  profile?: { display_name?: string | null } | null,
  user?: User | null,
  userData?: { email?: string | null } | null
): string {
  const first = resolveFirstName(profile, user, userData);
  return first.charAt(0).toUpperCase();
}
