const GUEST_KEY = 'allsang_guest';

interface GuestSession {
  guestFolderId: string;
  guestGroupId: string;
  guestCode: string;
}

export function useGuestSession() {
  const raw = localStorage.getItem(GUEST_KEY);
  const guest: GuestSession | null = raw ? (JSON.parse(raw) as GuestSession) : null;

  const setGuest = (session: GuestSession) => {
    localStorage.setItem(GUEST_KEY, JSON.stringify(session));
  };

  const clearGuest = () => {
    localStorage.removeItem(GUEST_KEY);
  };

  return {
    isGuest: guest !== null,
    guestFolderId: guest?.guestFolderId ?? null,
    guestGroupId: guest?.guestGroupId ?? null,
    guestCode: guest?.guestCode ?? null,
    setGuest,
    clearGuest,
  };
}
