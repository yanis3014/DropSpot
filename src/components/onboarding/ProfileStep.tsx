'use client';

import { Spinner } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { AVATAR_COLORS, avatarColorHex, type AvatarColorId } from '@/lib/onboarding';
import { cn } from '@/lib/cn';
import StepLayout, { StepTitle } from './StepLayout';

/** Shortest pseudo accepted. */
export const MIN_NAME_LENGTH = 2;

interface ProfileStepProps {
  name: string;
  onNameChange: (value: string) => void;
  /** Photo from Google / Apple, when there is one. */
  photoUrl: string | null;
  color: AvatarColorId;
  onColorChange: (value: AvatarColorId) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}

/** Pseudo + avatar colour, right after the account is created. */
export default function ProfileStep({
  name,
  onNameChange,
  photoUrl,
  color,
  onColorChange,
  saving,
  error,
  onSubmit,
}: ProfileStepProps) {
  const trimmed = name.trim();
  const canSubmit = trimmed.length >= MIN_NAME_LENGTH && !saving;

  return (
    <StepLayout
      footer={
        <>
          {error ? <p className="pb-2 text-center text-sm text-ds-danger">{error}</p> : null}
          <Button variant="main" onClick={onSubmit} disabled={!canSubmit} className="w-full">
            {saving ? <Spinner size={18} className="animate-spin" aria-hidden /> : null}
            {saving ? 'Un instant…' : 'C’est moi'}
          </Button>
        </>
      }
    >
      <div className="pt-6">
        <StepTitle
          title="Comment on t’appelle ?"
          subtitle="C’est ce que verront les autres quand tu confirmes une info."
        />
      </div>

      <div className="my-6 flex justify-center">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-24 w-24 rounded-full object-cover shadow-ds ring-4 ring-ds-surface"
          />
        ) : (
          <span
            aria-hidden
            style={{ backgroundColor: avatarColorHex(color) ?? undefined }}
            className="font-display flex h-24 w-24 items-center justify-center rounded-full text-[40px] font-extrabold text-white shadow-ds ring-4 ring-ds-surface"
          >
            {trimmed ? trimmed.charAt(0).toUpperCase() : '?'}
          </span>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-extrabold uppercase tracking-wider text-ds-text2">
          Pseudo
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) onSubmit();
          }}
          placeholder="Ton prénom ou un pseudo"
          maxLength={40}
          autoComplete="nickname"
          className="mt-2 w-full rounded-[14px] border border-ds-line bg-ds-surface px-4 py-3.5 text-base font-semibold text-ds-text placeholder:font-normal placeholder:text-ds-text2 focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/20"
        />
      </label>

      {photoUrl ? (
        <p className="mt-4 text-[12.5px] text-ds-text2">
          On reprend la photo de ton compte. Tu pourras changer ton pseudo dans ton profil.
        </p>
      ) : (
        <fieldset className="mt-6">
          <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-ds-text2">
            Ta couleur
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {AVATAR_COLORS.map((c) => {
              const selected = c.id === color;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={selected}
                  onClick={() => onColorChange(c.id)}
                  style={{ backgroundColor: c.hex, ['--swatch' as string]: c.hex }}
                  className={cn(
                    'h-11 w-11 rounded-full transition-transform active:scale-95',
                    selected &&
                      'shadow-[0_0_0_3px_var(--bg),0_0_0_5px_var(--swatch)]'
                  )}
                />
              );
            })}
          </div>
        </fieldset>
      )}
    </StepLayout>
  );
}
