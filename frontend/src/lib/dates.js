export const displayDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T00:00:00Z"))
    : "Not available";
export const day = (value) => Date.parse(value + "T00:00:00Z") / 86400000;
export const signed = (value) =>
  value === null || value === undefined
    ? "Not available"
    : `${value > 0 ? "+" : ""}${value} d`;
