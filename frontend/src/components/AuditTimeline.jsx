export default function AuditTimeline({ events }) {
  return (
    <div className="timeline">
      {events.length ? (
        events.map((e) => (
          <article key={e.id}>
            <span className="timeline-dot" />
            <div>
              <b>{e.action || e.event_type}</b>
              <small>
                {new Date(e.created_at || e.committed_at).toLocaleString()}
              </small>
              <p>
                Reference {e.id} · Approved by{" "}
                {e.actor_id || e.approved_by || "Not available"}{" "}
                {e.request_id && `· Request ${e.request_id}`}
              </p>
              <details>
                <summary>Evidence and state change</summary>
                <pre>
                  {JSON.stringify(
                    {
                      before: e.before_json || e.before_state,
                      after: e.after_json || e.after_state,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          </article>
        ))
      ) : (
        <p className="empty">No accepted updates yet.</p>
      )}
    </div>
  );
}
