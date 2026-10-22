import { supabase } from '@/lib/supabase/client';
import type { PlaceMemberRole } from '@/app/(pro)/dashboard-pro/lib/api/vendor';

export type TeamMember = {
  userId: string;
  role: PlaceMemberRole;
  fullName: string | null;
  email: string | null;
  joinedAt: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: PlaceMemberRole;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export type TeamRpcResult =
  | { ok: true; role?: string; token?: string; invitationId?: string }
  | { ok: false; error: string };

const TEAM_ERROR_FR: Record<string, string> = {
  not_authenticated: 'Tu dois être connecté.',
  forbidden: 'Tu n’as pas le droit de faire ça.',
  invalid_role: 'Rôle invalide.',
  invalid_email: 'Indique une adresse e-mail valide.',
  not_found: 'Membre ou invitation introuvable.',
  last_owner:
    'Tu es le dernier gérant de ce café. Nomme un autre gérant avant de partir ou de changer de rôle.',
  pro_required: 'Le rôle Responsable nécessite l’offre Pro.',
  already_accepted: 'Cette invitation a déjà été acceptée.',
  already_member: 'Cette personne fait déjà partie de l’équipe.',
  cannot_invite_self: 'Tu ne peux pas t’inviter toi-même.',
};

export function teamErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Une erreur est survenue. Réessaie.';
  return TEAM_ERROR_FR[code] ?? 'Une erreur est survenue. Réessaie.';
}

function normalizeRole(raw: unknown): PlaceMemberRole | null {
  if (raw === 'owner' || raw === 'manager' || raw === 'staff') return raw;
  return null;
}

export async function listPlaceTeam(placeId: string): Promise<TeamMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_place_team', {
    p_place_id: placeId,
  });
  if (error) {
    console.error('listPlaceTeam:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const role = normalizeRole(row.role);
      if (!role || typeof row.user_id !== 'string') return null;
      return {
        userId: row.user_id,
        role,
        fullName: typeof row.full_name === 'string' ? row.full_name : null,
        email: typeof row.email === 'string' ? row.email : null,
        joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
      } satisfies TeamMember;
    })
    .filter((row): row is TeamMember => row !== null);
}

export async function listPendingInvitations(
  placeId: string
): Promise<PendingInvitation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('place_invitations')
    .select('id, email, role, token, created_at, expires_at, accepted_at')
    .eq('place_id', placeId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    // Non-owners get RLS empty / error — treat as no invitations
    console.error('listPendingInvitations:', error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const role = normalizeRole(row.role) ?? 'staff';
      if (typeof row.id !== 'string' || typeof row.email !== 'string') {
        return null;
      }
      return {
        id: row.id,
        email: row.email,
        role,
        token: typeof row.token === 'string' ? row.token : '',
        createdAt: String(row.created_at ?? ''),
        expiresAt: String(row.expires_at ?? ''),
      } satisfies PendingInvitation;
    })
    .filter((row): row is PendingInvitation => row !== null);
}

export async function inviteMember(
  placeId: string,
  email: string,
  role: Exclude<PlaceMemberRole, 'owner'>
): Promise<TeamRpcResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('invite_member', {
    p_place_id: placeId,
    p_email: email,
    p_role: role,
  });
  if (error) throw error;
  const row = data as {
    ok?: boolean;
    error?: string;
    token?: string;
    invitation_id?: string;
  } | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'forbidden' };
  }
  return {
    ok: true,
    token: row.token,
    invitationId: row.invitation_id,
  };
}

export async function setMemberRole(
  placeId: string,
  userId: string,
  role: PlaceMemberRole
): Promise<TeamRpcResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('set_member_role', {
    p_place_id: placeId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string; role?: string } | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'forbidden' };
  }
  return { ok: true, role: row.role };
}

export async function removeMember(
  placeId: string,
  userId: string
): Promise<TeamRpcResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('remove_member', {
    p_place_id: placeId,
    p_user_id: userId,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string } | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'forbidden' };
  }
  return { ok: true };
}

export async function cancelInvitation(
  invitationId: string
): Promise<TeamRpcResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('cancel_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string } | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'forbidden' };
  }
  return { ok: true };
}

export function invitationPublicUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `/dashboard-pro/invitation/${token}`;
  }
  return `${window.location.origin}/dashboard-pro/invitation/${encodeURIComponent(token)}`;
}

export function memberDisplayName(
  member: TeamMember,
  selfId: string | null
): string {
  const base =
    member.fullName?.trim() ||
    member.email?.split('@')[0] ||
    'Membre';
  if (selfId && member.userId === selfId) {
    return `${base} (toi)`;
  }
  return base;
}

export function memberInitials(name: string): string {
  const parts = name
    .replace(/\(toi\)/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}
