export interface PlaceChecklistInput {
  hasCoverPhoto: boolean;
  hasOpeningHours: boolean;
  hasDescription: boolean;
  hasFirstDrop: boolean;
}

export interface ChecklistTask {
  id: 'photo' | 'hours' | 'description' | 'drop';
  label: string;
  done: boolean;
  href: string;
}

export const CHECKLIST_TOTAL = 4;

export function countChecklistDone(input: PlaceChecklistInput): number {
  let n = 0;
  if (input.hasCoverPhoto) n += 1;
  if (input.hasOpeningHours) n += 1;
  if (input.hasDescription) n += 1;
  if (input.hasFirstDrop) n += 1;
  return n;
}

export function buildChecklistTasks(
  input: PlaceChecklistInput,
  hrefs: {
    photo: string;
    hours: string;
    description: string;
    drop: string;
  }
): ChecklistTask[] {
  return [
    {
      id: 'photo',
      label: 'Ajouter une photo principale',
      done: input.hasCoverPhoto,
      href: hrefs.photo,
    },
    {
      id: 'hours',
      label: 'Renseigner les horaires',
      done: input.hasOpeningHours,
      href: hrefs.hours,
    },
    {
      id: 'description',
      label: 'Rédiger la description',
      done: input.hasDescription,
      href: hrefs.description,
    },
    {
      id: 'drop',
      label: 'Publier un premier drop',
      done: input.hasFirstDrop,
      href: hrefs.drop,
    },
  ];
}

export function showWelcomeChecklist(done: number): boolean {
  return done < CHECKLIST_TOTAL;
}
