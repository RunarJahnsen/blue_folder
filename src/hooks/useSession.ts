import { useState, useEffect } from 'react';

const SESSION_ID_KEY = 'allsang_session_id';

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Get existing session ID or create new one
    let existingSessionId = localStorage.getItem(SESSION_ID_KEY);

    if (!existingSessionId) {
      existingSessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, existingSessionId);
    }

    setSessionId(existingSessionId);
  }, []);

  return sessionId;
}