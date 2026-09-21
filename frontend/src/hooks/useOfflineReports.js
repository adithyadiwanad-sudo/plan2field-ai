import { useEffect, useState, useCallback, useRef } from "react";
import { draftsFor, saveDraft, removeDraft } from "../lib/offlineStore";
import { sendReport } from "../api/reports";
import { api, setCsrf } from "../api/client";
export default function useOfflineReports(userId, onSynced) {
  const [drafts, setDrafts] = useState([]),
    [error, setError] = useState("");
  const running = useRef(false),
    active = useRef(userId);
  active.current = userId;
  const refresh = useCallback(async () => {
    if (userId) setDrafts(await draftsFor(userId));
  }, [userId]);
  const sync = useCallback(async () => {
    if (running.current || !navigator.onLine || !userId) return;
    running.current = true;
    setError("");
    try {
      const session = await api("/auth/me");
      if (session.id !== userId)
        throw new Error(
          "Sign in to the account that captured these reports before syncing.",
        );
      setCsrf(session.csrf_token);
      for (const draft of await draftsFor(userId)) {
        if (active.current !== userId) break;
        try {
          await sendReport(draft.projectId, draft.payload);
          await removeDraft(draft.id);
          onSynced?.();
        } catch (e) {
          await saveDraft({ ...draft, error: e.message });
          if (e.status === 401 || e.status === 403) break;
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      running.current = false;
      await refresh();
    }
  }, [userId, refresh, onSynced]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const online = () => sync();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [refresh, sync]);
  async function enqueue(projectId, payload) {
    await saveDraft({
      id: payload.idempotency_key,
      userId,
      projectId,
      payload,
      createdAt: new Date().toISOString(),
    });
    await refresh();
    await sync();
  }
  return { drafts, error, enqueue, sync };
}
