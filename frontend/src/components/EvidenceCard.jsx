import { apiUrl } from "../api/client";
export default function EvidenceCard({ proposal, compact = false }) {
  const status = proposal.geofence_status || "UNKNOWN";
  const retrieval = proposal.raw_scores?.retrieval;
  const similarity =
    typeof retrieval === "number" && Number.isFinite(retrieval)
      ? `${(Math.max(-1, Math.min(1, retrieval)) * 100).toFixed(1)}%`
      : "Not scored";
  return (
    <div className="evidence-card">
      <span className={`trust-badge ${status.toLowerCase()}`}>
        📍 GPS {status.replaceAll("_", " ")}
      </span>
      <span className="trust-badge">
        🤖{" "}
        {proposal.discipline ||
          proposal.proposed_changes?.discipline ||
          "Unknown discipline"}{" "}
        · Cosine similarity {similarity}
      </span>
      {!compact && (
        <>
          <p className="muted">
            Vector similarity is not a calibrated AI confidence probability. GPS
            is browser-reported, not tamper-proof attestation.
          </p>
          {proposal.latitude != null && (
            <small>
              Coordinates: {proposal.latitude}, {proposal.longitude}
            </small>
          )}
          <div className="evidence-photos">
            {(proposal.evidence_urls || []).map((photo) => (
              <figure key={photo.id}>
                <a href={apiUrl(photo.url)} target="_blank" rel="noreferrer">
                  <img
                    crossOrigin="use-credentials"
                    src={apiUrl(photo.url)}
                    alt="Attached site evidence"
                    loading="lazy"
                  />
                </a>
                <figcaption>
                  📷 Uploaded {new Date(photo.uploaded_at).toLocaleString()}
                  <br />
                  Report captured {new Date(photo.captured_at).toLocaleString()}
                </figcaption>
              </figure>
            ))}
          </div>
          {!proposal.evidence_urls?.length && (
            <small>No site photos attached.</small>
          )}
        </>
      )}
      {compact && (
        <small>
          📷 {proposal.evidence_urls?.length || 0} attached photo(s)
        </small>
      )}
    </div>
  );
}
