import { redirect } from 'next/navigation';

/** Grains / badges live on /profile now. */
export default function GamificationPage() {
  redirect('/profile');
}
