import { useState } from 'react';

const SESSION_ID_KEY = 'allsang_session_id';

export function useSession() {
  const [sessionId] = useState<string | null>(() => {
    // Initialize session ID synchronously
    let existingSessionId = localStorage.getItem(SESSION_ID_KEY);

    if (!existingSessionId) {
      existingSessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, existingSessionId);
    }

    return existingSessionId;
  });

  return sessionId;
}