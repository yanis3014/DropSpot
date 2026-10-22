/** French messages for request_claim / suggest_place / cancel_claim error codes. */
const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Tu dois être connecté pour continuer.',
  invalid_proof_method: 'Mode de preuve invalide.',
  invalid_role: 'Choisis ton rôle dans l’établissement.',
  proof_required: 'Ajoute un justificatif (PDF, JPG ou PNG).',
  invalid_proof_path: 'Le fichier de preuve est invalide. Réessaie l’envoi.',
  place_not_found: 'Ce café est introuvable.',
  place_not_unclaimed: 'Ce café n’est plus libre à la revendication.',
  claim_already_open: 'Une demande est déjà en cours pour ce café.',
  not_found: 'Demande introuvable.',
  forbidden: 'Action non autorisée.',
  not_pending: 'Cette demande n’est plus en attente.',
  invalid_name: 'Le nom du café doit faire entre 2 et 80 caractères.',
  invalid_address: 'Indique l’adresse du café (3 à 200 caractères).',
  invalid_coords: 'Adresse introuvable. Vérifie l’adresse et la ville.',
  rate_limited:
    'Tu as déjà suggéré 3 cafés aujourd’hui. Réessaie demain.',
  insert_failed: 'Impossible d’ajouter ce café. Réessaie plus tard.',
  file_too_large: 'Le fichier dépasse 10 Mo.',
  invalid_file_type: 'Formats acceptés : PDF, JPG ou PNG.',
  missing_file: 'Ajoute un justificatif pour envoyer ta demande.',
  certify_required: 'Coche la case pour certifier que tu gères cet établissement.',
};

export function claimErrorMessage(code: string | null | undefined): string {
  if (!code) return 'Une erreur est survenue. Réessaie.';
  return CLAIM_ERROR_MESSAGES[code] ?? 'Une erreur est survenue. Réessaie.';
}
