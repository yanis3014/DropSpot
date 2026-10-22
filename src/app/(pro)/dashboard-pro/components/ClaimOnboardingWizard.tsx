'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock,
  FileText,
  Hourglass,
  MagnifyingGlass,
  MapPin,
  Phone,
  Spinner,
  UploadSimple,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import ConfirmDialog from '@/components/pro/ConfirmDialog';
import StatusTag from '@/components/pro/StatusTag';
import { CONTACT_EMAIL } from '@/lib/pro/contact';
import { geocodeAddress } from '@/lib/geocode';
import { Place } from '@/lib/api/places';
import { supabase } from '@/lib/supabase/client';
import { claimErrorMessage } from '@/app/(pro)/dashboard-pro/lib/onboarding/claimErrors';
import {
  buildClaimProofPath,
  canSubmitClaimStep,
  placeNameInitials,
  validateClaimProofFile,
} from '@/app/(pro)/dashboard-pro/lib/onboarding/claimProof';
import {
  cancelPlaceClaim,
  getPendingPlaceClaim,
  requestPlaceClaim,
  searchPlacesForClaim,
  suggestPlace,
  uploadClaimProof,
  type PendingPlaceClaim,
} from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import { formatParisClaimSentAt } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import { cn } from '@/lib/cn';

type Step = 1 | 2 | 3;

const DECLARED_ROLES = ['Gérant·e', 'Propriétaire', 'Associé·e'] as const;
type DeclaredRole = (typeof DECLARED_ROLES)[number];

const HELP_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Aide revendication café — Dropspot Pro'
)}`;

function placeAddressLine(place: Place): string {
  return [place.address, place.city].filter(Boolean).join(', ') || 'Adresse non renseignée';
}

export interface ClaimOnboardingWizardProps {
  hasMemberships: boolean;
  initialPending: PendingPlaceClaim | null;
}

export default function ClaimOnboardingWizard({
  hasMemberships,
  initialPending,
}: ClaimOnboardingWizardProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(() => (initialPending ? 3 : 1));
  const [showMemberGate, setShowMemberGate] = useState(
    () => !initialPending && hasMemberships
  );

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Place[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addCity, setAddCity] = useState('');
  const [adding, setAdding] = useState(false);

  const [selected, setSelected] = useState<Place | null>(
    () => initialPending?.place ?? null
  );
  const [declaredRole, setDeclaredRole] = useState<DeclaredRole>('Gérant·e');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [certified, setCertified] = useState(false);

  const [pending, setPending] = useState<PendingPlaceClaim | null>(
    () => initialPending
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const q = query.trim();
  const results = q.length < 2 ? [] : searchResults;
  const showSearching = q.length >= 2 && searching;

  useEffect(() => {
    if (q.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!cancelled) setSearching(true);
        try {
          const list = await searchPlacesForClaim(q);
          if (!cancelled) setSearchResults(list);
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setError('Recherche impossible pour le moment.');
            setSearchResults([]);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  const selectPlace = useCallback((place: Place) => {
    setSelected(place);
    setError(null);
    setProofFile(null);
    setCertified(false);
    setShowAddForm(false);
    setStep(2);
  }, []);

  const handleSuggest = async () => {
    setError(null);
    const name = addName.trim();
    if (name.length < 2 || name.length > 80) {
      setError(claimErrorMessage('invalid_name'));
      return;
    }
    if (!addAddress.trim() || !addCity.trim()) {
      setError('Indique l’adresse et la ville.');
      return;
    }

    setAdding(true);
    try {
      const coords = await geocodeAddress(addAddress, addCity);
      const result = await suggestPlace({
        name,
        address: addAddress.trim(),
        city: addCity.trim(),
        lat: coords.lat,
        lng: coords.lng,
      });
      if (!result.ok) {
        setError(claimErrorMessage(result.error));
        return;
      }

      const place: Place = {
        id: result.placeId,
        name,
        address: addAddress.trim(),
        city: addCity.trim(),
        lat: coords.lat,
        lng: coords.lng,
        categories: [],
        verification_status: 'unclaimed',
        vendor_id: null,
      };
      selectPlace(place);
    } catch (err) {
      console.error(err);
      setError('Impossible d’ajouter ce café. Réessaie.');
    } finally {
      setAdding(false);
    }
  };

  const onProofChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setProofFile(null);
      return;
    }
    const code = validateClaimProofFile(file);
    if (code) {
      setProofFile(null);
      setError(claimErrorMessage(code));
      e.target.value = '';
      return;
    }
    setProofFile(file);
  };

  const handleSubmitClaim = async () => {
    setError(null);
    if (!selected) return;
    if (!certified) {
      setError(claimErrorMessage('certify_required'));
      return;
    }
    const fileErr = validateClaimProofFile(proofFile);
    if (fileErr || !proofFile) {
      setError(claimErrorMessage(fileErr ?? 'missing_file'));
      return;
    }
    if (!canSubmitClaimStep({ certified, file: proofFile })) {
      setError(claimErrorMessage('missing_file'));
      return;
    }

    setSubmitting(true);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(claimErrorMessage('not_authenticated'));
        return;
      }

      const path = buildClaimProofPath(user.id, selected.id, proofFile.name);
      await uploadClaimProof(selected.id, proofFile, path);
      const result = await requestPlaceClaim({
        placeId: selected.id,
        declaredRole,
        proofPath: path,
      });
      if (!result.ok) {
        setError(claimErrorMessage(result.error));
        return;
      }

      const claim = await getPendingPlaceClaim();
      setPending(
        claim ?? {
          id: result.claimId,
          place_id: selected.id,
          declared_role: declaredRole,
          proof_method: 'document',
          status: 'pending',
          created_at: new Date().toISOString(),
          place: selected,
        }
      );
      setStep(3);
    } catch (err) {
      console.error(err);
      const code =
        err instanceof Error && err.message === 'invalid_proof_path'
          ? 'invalid_proof_path'
          : null;
      setError(claimErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelClaim = async () => {
    if (!pending) return;
    setCancelling(true);
    setError(null);
    try {
      const result = await cancelPlaceClaim(pending.id);
      if (!result.ok) {
        setError(claimErrorMessage(result.error));
        setCancelOpen(false);
        return;
      }
      setPending(null);
      setSelected(null);
      setProofFile(null);
      setCertified(false);
      setCancelOpen(false);
      setStep(1);
      if (hasMemberships) setShowMemberGate(true);
    } catch (err) {
      console.error(err);
      setError('Impossible d’annuler la demande.');
      setCancelOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  if (showMemberGate && step !== 3) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-10">
        <header className="flex flex-col gap-2">
          <p className="font-display text-2xl font-extrabold tracking-tight text-ds-text">
            Dropspot{' '}
            <span className="text-sm font-bold text-ds-text2">Espace gérant</span>
          </p>
          <h1 className="font-display text-3xl font-extrabold text-ds-text">
            Tu as déjà un espace pro
          </h1>
          <p className="text-base leading-relaxed text-ds-text2">
            Retourne à ton tableau de bord, ou revendique un autre café.
          </p>
        </header>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="main"
            className="h-12 flex-1 rounded-xl text-[15px]"
            onClick={() => router.push('/dashboard-pro')}
          >
            Aller à mon espace pro
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-xl text-[15px]"
            onClick={() => setShowMemberGate(false)}
          >
            Revendiquer un autre café
          </Button>
        </div>
        <p className="text-center text-sm text-ds-text2">
          <Link href="/map" className="font-semibold text-ds-accent">
            Retour à l&apos;app client
          </Link>
        </p>
      </div>
    );
  }

  const cafeName = selected?.name ?? pending?.place?.name ?? 'ton café';
  const cafeLine = selected
    ? placeAddressLine(selected)
    : pending?.place
      ? placeAddressLine(pending.place)
      : '';

  return (
    <div className="flex min-h-full w-full flex-col bg-ds-bg text-ds-text">
      <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-ds-line bg-ds-surface px-4 sm:px-8">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Dropspot
          </span>
          <span className="hidden text-[13px] font-bold text-ds-text2 sm:inline">
            Espace gérant
          </span>
        </div>

        <ol
          aria-label="Étapes"
          className="hidden items-center gap-3 md:flex"
        >
          <StepItem n={1} label="Trouve ton café" current={step} />
          <span className="h-0.5 w-12 rounded-sm bg-ds-line" aria-hidden />
          <StepItem n={2} label="Prouve que c'est toi" current={step} />
          <span className="h-0.5 w-12 rounded-sm bg-ds-line" aria-hidden />
          <StepItem n={3} label="Vérification" current={step} />
        </ol>

        <a
          href={HELP_MAILTO}
          className="shrink-0 text-sm font-bold text-ds-accent no-underline"
        >
          Besoin d&apos;aide ?
        </a>
      </header>

      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger"
          >
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="font-display m-0 text-[34px] font-extrabold leading-tight tracking-tight">
                Trouve ton café
              </h1>
              <p className="m-0 text-base leading-relaxed text-ds-text2">
                Cherche-le par son nom.
              </p>
            </div>

            <label className="flex h-12 items-center gap-2.5 rounded-xl border border-ds-line bg-ds-surface px-3.5 text-ds-text2">
              <MagnifyingGlass className="h-5 w-5 shrink-0" aria-hidden />
              <input
                type="search"
                aria-label="Nom du café"
                placeholder="Nom du café"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent text-base text-ds-text outline-none placeholder:text-ds-text2"
              />
              {showSearching ? (
                <Spinner className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
            </label>

            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {results.map((place) => {
                const free = place.verification_status === 'unclaimed';
                const initials = placeNameInitials(place.name);
                return (
                  <li
                    key={place.id}
                    className="flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-3.5 sm:flex-row sm:items-center sm:gap-3.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <span
                        className={cn(
                          'font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold',
                          free
                            ? 'bg-ds-accent text-ds-onaccent'
                            : 'bg-ds-surface2 text-ds-text2'
                        )}
                      >
                        {initials}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-base font-bold">
                          {place.name}
                        </span>
                        {free ? (
                          <span className="truncate text-[13px] text-ds-text2">
                            {placeAddressLine(place)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-ds-text2">
                            Déjà géré par quelqu&apos;un. C&apos;est une erreur ?{' '}
                            <a
                              href={HELP_MAILTO}
                              className="font-bold text-ds-accent"
                            >
                              Écris-nous
                            </a>
                          </span>
                        )}
                      </div>
                      <StatusTag variant={free ? 'ok' : 'done'}>
                        {free ? 'Libre' : 'Déjà géré'}
                      </StatusTag>
                    </div>
                    {free ? (
                      <Button
                        variant="main"
                        className="h-11 shrink-0 rounded-xl px-[18px] text-[15px]"
                        onClick={() => selectPlace(place)}
                      >
                        C&apos;est mon café
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {!showAddForm ? (
              <div className="mt-auto flex items-center gap-3 rounded-[14px] bg-ds-surface2 p-4">
                <MapPin className="h-5 w-5 shrink-0 text-ds-text2" aria-hidden />
                <span className="flex-1 text-[15px]">
                  Ton café n&apos;est pas sur la carte ?
                </span>
                <button
                  type="button"
                  className="text-[15px] font-bold text-ds-accent"
                  onClick={() => setShowAddForm(true)}
                >
                  Ajoute-le
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-4">
                <p className="m-0 text-base font-bold">Ajouter ton café</p>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ds-text2">
                  Nom
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    maxLength={80}
                    className="h-11 rounded-xl border border-ds-line bg-ds-bg px-3 text-base font-normal text-ds-text outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ds-text2">
                  Adresse
                  <input
                    value={addAddress}
                    onChange={(e) => setAddAddress(e.target.value)}
                    className="h-11 rounded-xl border border-ds-line bg-ds-bg px-3 text-base font-normal text-ds-text outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ds-text2">
                  Ville
                  <input
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    className="h-11 rounded-xl border border-ds-line bg-ds-bg px-3 text-base font-normal text-ds-text outline-none"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl px-4 text-[15px]"
                    onClick={() => setShowAddForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="main"
                    className="h-11 rounded-xl px-4 text-[15px]"
                    disabled={adding}
                    onClick={() => void handleSuggest()}
                  >
                    {adding ? 'Ajout…' : 'Continuer'}
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {step === 2 && selected ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="font-display m-0 text-[34px] font-extrabold leading-tight tracking-tight">
                Prouve que tu gères ce café
              </h1>
              <p className="m-0 text-base leading-relaxed text-ds-text2">
                On vérifie chaque demande pour que personne ne publie de drop à
                ta place.
              </p>
            </div>

            <div className="flex items-center gap-3.5 rounded-[18px] border border-ds-line bg-ds-surface p-3.5">
              <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ds-accent text-base font-extrabold text-ds-onaccent">
                {placeNameInitials(selected.name)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-bold">{selected.name}</span>
                <span className="truncate text-[13px] text-ds-text2">
                  {cafeLine}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 px-2 text-[15px] font-bold text-ds-accent"
                onClick={() => {
                  setStep(1);
                  setSelected(null);
                }}
              >
                Changer
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[17px] font-bold">Ton rôle</span>
              <div className="flex flex-wrap gap-2">
                {DECLARED_ROLES.map((role) => (
                  <Chip
                    key={role}
                    active={declaredRole === role}
                    icon={
                      declaredRole === role ? (
                        <Check className="h-4 w-4" weight="bold" aria-hidden />
                      ) : undefined
                    }
                    onClick={() => setDeclaredRole(role)}
                  >
                    {role}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[17px] font-bold">
                Comment veux-tu le prouver ?
              </span>
              <div className="flex flex-col gap-3.5 lg:flex-row">
                <div
                  className="flex flex-1 flex-col gap-2.5 rounded-2xl border-[1.5px] border-ds-line bg-ds-surface p-[18px] opacity-60"
                  aria-disabled="true"
                >
                  <span className="flex items-center gap-2.5">
                    <Phone className="h-5 w-5" aria-hidden />
                    <span className="flex-1 text-base font-bold">
                      Par téléphone
                    </span>
                    <StatusTag variant="done">Bientôt</StatusTag>
                  </span>
                  <span className="text-sm text-ds-text2">
                    On appellera le numéro public du café. Disponible bientôt.
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border-[1.5px] border-ds-accent bg-ds-surface p-[18px] shadow-[0_0_0_3px_var(--accentsoft)]">
                  <span className="flex items-center gap-2.5">
                    <FileText className="h-5 w-5" aria-hidden />
                    <span className="text-base font-bold">Par justificatif</span>
                  </span>
                  <span className="text-sm text-ds-text2">
                    Kbis, bail ou facture au nom du café. PDF, JPG ou PNG · 10 Mo
                    max.
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    onChange={onProofChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-[132px] flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-ds-line text-sm text-ds-text2"
                  >
                    <UploadSimple className="h-6 w-6" aria-hidden />
                    {proofFile ? (
                      <span className="px-3 text-center font-semibold text-ds-text">
                        {proofFile.name}
                      </span>
                    ) : (
                      <span>
                        Glisse ton fichier ici ou{' '}
                        <span className="font-bold text-ds-accent">
                          choisis-le
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-[15px]">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--accent)]"
              />
              Je certifie gérer cet établissement.
            </label>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-transparent bg-transparent px-4 text-[15px] shadow-none"
                onClick={() => {
                  setStep(1);
                  setSelected(null);
                }}
              >
                Retour
              </Button>
              <Button
                variant="main"
                className="h-[52px] rounded-[14px] px-6 text-base"
                disabled={
                  submitting ||
                  !canSubmitClaimStep({ certified, file: proofFile })
                }
                onClick={() => void handleSubmitClaim()}
              >
                {submitting ? 'Envoi…' : 'Envoyer ma demande'}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mx-auto flex w-full max-w-[680px] flex-col gap-[22px] rounded-[18px] border border-ds-line bg-ds-surface p-6 sm:p-10">
            <div className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ds-warnsoft text-ds-warn">
                <Hourglass className="h-[26px] w-[26px]" aria-hidden />
              </span>
              <StatusTag variant="warn">En cours de vérification</StatusTag>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="font-display m-0 text-[30px] font-extrabold leading-tight tracking-tight">
                On vérifie que {cafeName} est bien à toi
              </h1>
              <p className="m-0 text-base leading-relaxed text-ds-text2">
                On te prévient par e-mail.
              </p>
            </div>

            <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-oksoft text-ds-ok">
                  <Check className="h-4 w-4" weight="bold" aria-hidden />
                </span>
                <span className="flex-1 font-semibold">Demande envoyée</span>
                {pending?.created_at ? (
                  <span className="text-[13px] text-ds-text2">
                    {formatParisClaimSentAt(pending.created_at)}
                  </span>
                ) : null}
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-warnsoft text-ds-warn">
                  <Clock className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex-1 font-semibold">
                  Vérification par l&apos;équipe Dropspot
                </span>
                <span className="text-[13px] text-ds-text2">en cours</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="box-border h-8 w-8 shrink-0 rounded-full border-[1.5px] border-ds-line" />
                <span className="flex-1 font-semibold text-ds-text2">
                  Accès complet : drops, équipe, spécificités
                </span>
              </li>
            </ol>

            <div className="pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-4 text-[15px]"
                onClick={() => setCancelOpen(true)}
              >
                Annuler la demande
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Annuler la demande ?"
        description="Tu pourras en renvoyer une plus tard pour ce café ou un autre."
        confirmLabel={cancelling ? 'Annulation…' : 'Annuler la demande'}
        cancelLabel="Garder ma demande"
        danger
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void handleCancelClaim()}
      />
    </div>
  );
}

function StepItem({
  n,
  label,
  current,
}: {
  n: Step;
  label: string;
  current: Step;
}) {
  const done = current > n;
  const on = current === n;
  return (
    <li
      className={cn(
        'flex items-center gap-2 text-sm font-semibold',
        on || done ? 'text-ds-text' : 'text-ds-text2'
      )}
    >
      <span
        className={cn(
          'box-border flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] text-[13px] font-extrabold',
          on && 'border-ds-accent bg-ds-accent text-ds-onaccent',
          done && 'border-transparent bg-ds-accentsoft text-ds-accenttext',
          !on && !done && 'border-ds-line'
        )}
      >
        {done ? <Check className="h-4 w-4" weight="bold" aria-hidden /> : n}
      </span>
      {label}
    </li>
  );
}
