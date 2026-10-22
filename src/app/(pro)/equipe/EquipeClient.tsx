'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Minus,
  UserPlus,
  X,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/pro/ConfirmDialog';
import PlanBadge from '@/components/pro/PlanBadge';
import StatusTag from '@/components/pro/StatusTag';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { useAuth } from '@/lib/hooks/useAuth';
import { useVendorPlan } from '@/hooks/useVendorPlan';
import {
  canManageTeam,
  TEAM_CAPABILITY_MATRIX,
  TEAM_ROLE_LABELS,
} from '@/lib/pro/navAccess';
import type { PlaceMemberRole } from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import {
  cancelInvitation,
  invitationPublicUrl,
  inviteMember,
  listPendingInvitations,
  listPlaceTeam,
  memberDisplayName,
  memberInitials,
  removeMember,
  setMemberRole,
  teamErrorMessage,
  type PendingInvitation,
  type TeamMember,
} from '@/app/(pro)/dashboard-pro/lib/api/team';
import { formatParisClaimSentAt } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import { cn } from '@/lib/cn';

type InviteRole = 'staff' | 'manager';

export default function EquipeClient() {
  const { user } = useAuth();
  const { activePlace, activeMemberRole, loading: placeLoading } =
    useActivePlace();
  const { hasPro } = useVendorPlan();
  const isOwner = canManageTeam(activeMemberRole);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvitation[]>([]);
  const [loadedPlaceId, setLoadedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('staff');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<PlaceMemberRole>('staff');
  const [editBusy, setEditBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [lastOwnerMsg, setLastOwnerMsg] = useState<string | null>(null);

  const selfId = user?.id ?? null;
  const placeId = activePlace?.id ?? null;

  const loadTeam = useCallback(async (id: string) => {
    const [team, pending] = await Promise.all([
      listPlaceTeam(id),
      listPendingInvitations(id),
    ]);
    return { team, pending };
  }, []);

  useEffect(() => {
    if (!placeId) return;
    const id = placeId;
    let cancelled = false;
    void (async () => {
      try {
        const { team, pending } = await loadTeam(id);
        if (cancelled) return;
        setMembers(team);
        setInvites(pending);
        setLoadedPlaceId(id);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Impossible de charger l’équipe.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, loadTeam]);

  const reload = useCallback(async (id: string) => {
    setError(null);
    try {
      const { team, pending } = await loadTeam(id);
      setMembers(team);
      setInvites(pending);
      setLoadedPlaceId(id);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger l’équipe.');
    }
  }, [loadTeam]);

  const peopleCount = members.length + invites.length;

  const handleInvite = async () => {
    if (!placeId || !isOwner) return;
    setInviteBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const result = await inviteMember(placeId, inviteEmail.trim(), inviteRole);
      if (!result.ok) {
        setError(teamErrorMessage(result.error));
        return;
      }
      if (result.token) {
        setInviteLink(invitationPublicUrl(result.token));
      }
      await reload(placeId);
    } catch (err) {
      console.error(err);
      setError('Invitation impossible. Réessaie.');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible. Sélectionne le lien manuellement.');
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!placeId || !isOwner) return;
    setError(null);
    try {
      const result = await cancelInvitation(id);
      if (!result.ok) {
        setError(teamErrorMessage(result.error));
        return;
      }
      await reload(placeId);
    } catch (err) {
      console.error(err);
      setError('Annulation impossible.');
    }
  };

  const openEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditRole(member.role);
    setLastOwnerMsg(null);
    setError(null);
  };

  const handleSaveRole = async () => {
    if (!placeId || !editMember || !isOwner) return;
    setEditBusy(true);
    setLastOwnerMsg(null);
    setError(null);
    try {
      const result = await setMemberRole(placeId, editMember.userId, editRole);
      if (!result.ok) {
        const msg = teamErrorMessage(result.error);
        if (result.error === 'last_owner') setLastOwnerMsg(msg);
        else setError(msg);
        return;
      }
      setEditMember(null);
      await reload(placeId);
    } catch (err) {
      console.error(err);
      setError('Impossible de changer le rôle.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!placeId || !editMember || !isOwner) return;
    setEditBusy(true);
    setLastOwnerMsg(null);
    setError(null);
    try {
      const result = await removeMember(placeId, editMember.userId);
      if (!result.ok) {
        const msg = teamErrorMessage(result.error);
        if (result.error === 'last_owner') setLastOwnerMsg(msg);
        else setError(msg);
        setRemoveOpen(false);
        return;
      }
      setRemoveOpen(false);
      setEditMember(null);
      await reload(placeId);
    } catch (err) {
      console.error(err);
      setError('Impossible de retirer ce membre.');
      setRemoveOpen(false);
    } finally {
      setEditBusy(false);
    }
  };

  const roleTag = (role: PlaceMemberRole | 'pending', isSelf: boolean) => {
    if (role === 'pending') {
      return <StatusTag variant="warn">En attente</StatusTag>;
    }
    return (
      <StatusTag variant={isSelf ? 'scheduled' : 'done'}>
        {TEAM_ROLE_LABELS[role]}
      </StatusTag>
    );
  };

  if (!placeLoading && !activePlace) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold">Équipe</h1>
        <p className="m-0 text-sm text-ds-text2">
          Aucun café actif. Choisis un établissement dans le menu.
        </p>
      </div>
    );
  }

  if (
    placeLoading ||
    loading ||
    !activePlace ||
    loadedPlaceId !== activePlace.id
  ) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex shrink-0 flex-col gap-3 border-b border-ds-line px-4 py-4 sm:h-[84px] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-0">
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[26px] font-extrabold tracking-tight">
            Équipe
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            {activePlace.name} · {peopleCount} personne
            {peopleCount > 1 ? 's' : ''}
          </p>
        </div>
        {isOwner ? (
          <Button
            variant="main"
            className="h-11 rounded-xl px-[18px] text-[15px]"
            onClick={() => {
              setInviteOpen(true);
              setInviteLink(null);
              setInviteEmail('');
              setInviteRole('staff');
              setError(null);
            }}
          >
            <UserPlus className="h-5 w-5" weight="bold" aria-hidden />
            Inviter quelqu&apos;un
          </Button>
        ) : null}
      </header>

      {error ? (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-xl bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger sm:mx-8"
        >
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-5 lg:px-8 lg:py-6">
        <section className="min-w-0 flex-1 self-start overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
          <ul className="m-0 list-none divide-y divide-ds-line p-0">
            {members.map((member) => {
              const name = memberDisplayName(member, selfId);
              const isSelf = member.userId === selfId;
              return (
                <li
                  key={member.userId}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1.4fr)_auto_auto]"
                >
                  <span
                    className={cn(
                      'font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold',
                      isSelf
                        ? 'bg-ds-accent text-ds-onaccent'
                        : 'bg-ds-surface2 text-ds-text2'
                    )}
                  >
                    {memberInitials(name)}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-base font-bold">{name}</p>
                    {member.email ? (
                      <p className="m-0 truncate text-[13px] text-ds-text2">
                        {member.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="justify-self-end sm:justify-self-center">
                    {roleTag(member.role, isSelf)}
                  </div>
                  {isOwner ? (
                    <div className="col-span-3 flex justify-end sm:col-span-1">
                      <button
                        type="button"
                        className="h-[34px] rounded-[10px] border-[1.5px] border-ds-line bg-ds-surface px-3 text-sm font-bold"
                        onClick={() => openEdit(member)}
                      >
                        Modifier
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}

            {invites.map((inv) => {
              const label =
                inv.email.split('@')[0] || inv.email;
              return (
                <li
                  key={inv.id}
                  className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1.4fr)_auto_auto]"
                >
                  <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ds-surface2 text-[15px] font-extrabold text-ds-text2">
                    {memberInitials(label)}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-base font-bold">{inv.email}</p>
                    <p className="m-0 truncate text-[13px] text-ds-text2">
                      Invitation envoyée
                      {inv.createdAt
                        ? ` ${formatParisClaimSentAt(inv.createdAt)}`
                        : ''}
                    </p>
                  </div>
                  <div className="col-start-2 sm:col-start-auto">
                    {roleTag('pending', false)}
                  </div>
                  {isOwner ? (
                    <div className="col-span-2 flex flex-wrap justify-end gap-2 sm:col-span-1">
                      {inv.token ? (
                        <button
                          type="button"
                          className="h-[34px] rounded-[10px] border-[1.5px] border-ds-line bg-ds-surface px-3 text-sm font-bold"
                          onClick={() =>
                            void copyLink(invitationPublicUrl(inv.token))
                          }
                        >
                          Copier le lien
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="h-[34px] rounded-[10px] px-3 text-sm font-bold text-ds-danger"
                        onClick={() => void handleCancelInvite(inv.id)}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="w-full shrink-0 self-start rounded-[18px] border border-ds-line bg-ds-surface p-5 lg:w-[420px]">
          <h2 className="font-display m-0 mb-2.5 text-[17px] font-bold">
            Qui peut faire quoi
          </h2>
          <div className="mb-1 grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-1 text-center text-[12px] font-bold text-ds-text2">
            <span />
            <span>Gérant·e</span>
            <span className="inline-flex items-center justify-center gap-1">
              Responsable
              <PlanBadge plan="pro" />
            </span>
            <span>Équipier·e</span>
          </div>
          {TEAM_CAPABILITY_MATRIX.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-1 border-t border-ds-line py-2.5 text-sm"
            >
              <span className="pr-1 font-semibold leading-snug">{row.label}</span>
              <CapabilityCell yes={row.owner} />
              <CapabilityCell yes={row.manager} />
              <CapabilityCell yes={row.staff} />
            </div>
          ))}
        </aside>
      </div>

      {/* Invite modal */}
      {inviteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setInviteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Inviter quelqu'un"
            className="relative z-[71] flex w-full max-w-[520px] flex-col gap-4 rounded-t-[22px] bg-ds-surface p-6 shadow-ds sm:rounded-[22px] sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display m-0 text-[22px] font-extrabold">
                Inviter quelqu&apos;un
              </h3>
              <button
                type="button"
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-surface2"
                onClick={() => setInviteOpen(false)}
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            {inviteLink ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-sm leading-relaxed text-ds-text2">
                  Aucun e-mail n&apos;est envoyé. Copie ce lien et envoie-le
                  toi-même à la personne invitée :
                </p>
                <code className="break-all rounded-xl bg-ds-bg px-3 py-2 text-[13px]">
                  {inviteLink}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="main"
                    className="h-11 rounded-xl px-4 text-[15px]"
                    onClick={() => void copyLink(inviteLink)}
                  >
                    <Copy className="h-4 w-4" weight="bold" aria-hidden />
                    {copied ? 'Copié' : 'Copier le lien'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl px-4 text-[15px]"
                    onClick={() => setInviteOpen(false)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-bold">
                  E-mail
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="hugo@exemple.fr"
                    className="h-11 rounded-[12px] border border-ds-line bg-ds-bg px-3 text-[15px] font-medium outline-none"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold">Rôle</span>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-3.5',
                      inviteRole === 'staff'
                        ? 'border-ds-accent bg-ds-surface'
                        : 'border-ds-line'
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      checked={inviteRole === 'staff'}
                      onChange={() => setInviteRole('staff')}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-bold">Équipier·e</span>
                      <span className="text-[13px] font-medium text-ds-text2">
                        Valide les drops au comptoir et voit l&apos;accueil du
                        jour.
                      </span>
                    </span>
                  </label>

                  <div
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border-[1.5px] border-ds-line p-3.5',
                      !hasPro && 'opacity-75'
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      checked={inviteRole === 'manager'}
                      disabled={!hasPro}
                      onChange={() => setInviteRole('manager')}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 font-bold">
                        Responsable
                        <PlanBadge plan="pro" />
                      </span>
                      <span className="text-[13px] font-medium text-ds-text2">
                        Crée et arrête des drops, sans accès à l&apos;abonnement.
                      </span>
                    </span>
                    {!hasPro ? (
                      <Link
                        href="/abonnement"
                        className="shrink-0 text-sm font-bold text-ds-accent no-underline"
                      >
                        Passer au Pro
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border-transparent bg-transparent px-4 text-[15px] shadow-none"
                    onClick={() => setInviteOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="main"
                    className="h-11 rounded-xl px-[18px] text-[15px]"
                    disabled={inviteBusy || !inviteEmail.trim()}
                    onClick={() => void handleInvite()}
                  >
                    {inviteBusy ? 'Envoi…' : 'Envoyer l’invitation'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Edit member modal */}
      {editMember ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setEditMember(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Modifier le membre"
            className="relative z-[71] flex w-full max-w-[480px] flex-col gap-4 rounded-t-[22px] bg-ds-surface p-6 shadow-ds sm:rounded-[22px] sm:p-7"
          >
            <h3 className="font-display m-0 text-[22px] font-extrabold">
              Modifier
            </h3>
            <p className="m-0 text-sm text-ds-text2">
              {memberDisplayName(editMember, selfId)}
              {editMember.email ? ` · ${editMember.email}` : ''}
            </p>

            {lastOwnerMsg ? (
              <p
                role="alert"
                className="m-0 rounded-xl bg-ds-warnsoft px-3 py-2.5 text-sm font-semibold text-ds-warn"
              >
                {lastOwnerMsg}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Rôle</span>
              {(['owner', 'manager', 'staff'] as PlaceMemberRole[]).map(
                (role) => {
                  const locked = role === 'manager' && !hasPro;
                  return (
                    <label
                      key={role}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-ds-line px-3 py-2.5',
                        locked && 'opacity-60'
                      )}
                    >
                      <input
                        type="radio"
                        checked={editRole === role}
                        disabled={locked}
                        onChange={() => setEditRole(role)}
                      />
                      <span className="flex items-center gap-2 font-semibold">
                        {TEAM_ROLE_LABELS[role]}
                        {role === 'manager' ? <PlanBadge plan="pro" /> : null}
                      </span>
                    </label>
                  );
                }
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-4 text-[15px] text-ds-danger"
                onClick={() => setRemoveOpen(true)}
              >
                Retirer de l&apos;équipe
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl px-4 text-[15px]"
                  onClick={() => setEditMember(null)}
                >
                  Annuler
                </Button>
                <Button
                  variant="main"
                  className="h-11 rounded-xl px-4 text-[15px]"
                  disabled={editBusy || editRole === editMember.role}
                  onClick={() => void handleSaveRole()}
                >
                  {editBusy ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={removeOpen}
        title="Retirer ce membre ?"
        description="Il perdra l’accès à ce café immédiatement."
        confirmLabel={editBusy ? 'Retrait…' : 'Retirer'}
        cancelLabel="Annuler"
        danger
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}

function CapabilityCell({ yes }: { yes: boolean }) {
  return (
    <span className="flex justify-center text-ds-text2">
      {yes ? (
        <Check
          className="h-4 w-4 text-ds-ok"
          weight="bold"
          aria-label="Oui"
        />
      ) : (
        <Minus className="h-4 w-4" aria-label="Non" />
      )}
    </span>
  );
}
