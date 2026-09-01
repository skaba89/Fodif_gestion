'use client';

import { useRouter } from 'next/navigation';

export function DirectionAccountMenu() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/direction/connexion');
    router.refresh();
  }

  return <button className="profile-button" type="button" onClick={logout} title="Se déconnecter" aria-label="Se déconnecter">DG</button>;
}
