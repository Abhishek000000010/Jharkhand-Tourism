import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 30000;

/**
 * Unread message count for the sidebar badge.
 *
 * Failures are swallowed on purpose: the badge is decoration, and a hiccup here
 * must never put an error banner in front of someone trying to use the app.
 */
export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const userId = user?._id || user?.id || null;

  useEffect(() => {
    let alive = true;

    // Reset first, so a badge from a previous session never carries over.
    setUnread(0);
    if (!userId) return undefined;

    const fetchCount = async () => {
      try {
        const res = await axios.get('/api/messages/unread');
        if (alive) setUnread(res.data.unread || 0);
      } catch {
        // ignored — see above
      }
    };

    fetchCount();
    const timer = setInterval(fetchCount, POLL_MS);

    return () => { alive = false; clearInterval(timer); };
  }, [userId]);

  return unread;
};
