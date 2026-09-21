import { CloudOff, RefreshCw } from "lucide-react";
export default function SyncStatus({ queue }) {
  return (
    <section className="sync">
      <CloudOff size={16} />
      <span>{queue.drafts.length} saved on this device</span>
      <button className="text-button" onClick={queue.sync}>
        <RefreshCw size={14} /> Sync now
      </button>
      {queue.error && <span role="alert">{queue.error}</span>}
      {queue.drafts.some((d) => d.error) && (
        <details>
          <summary>Sync needs attention</summary>
          {queue.drafts
            .filter((d) => d.error)
            .map((d) => (
              <p key={d.id}>{d.error}</p>
            ))}
        </details>
      )}
    </section>
  );
}
