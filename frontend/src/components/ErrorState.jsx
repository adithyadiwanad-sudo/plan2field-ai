export default function ErrorState({ error, retry }) {
  return (
    <div className="error" role="alert">
      <strong>
        {error?.status === 403
          ? "Access restricted"
          : error?.status === 409
            ? "This record changed"
            : "Unable to complete request"}
      </strong>
      <p>{error?.message || String(error)}</p>
      {error?.requestId && <small>Reference: {error.requestId}</small>}
      {retry && <button onClick={retry}>Refresh and try again</button>}
    </div>
  );
}
