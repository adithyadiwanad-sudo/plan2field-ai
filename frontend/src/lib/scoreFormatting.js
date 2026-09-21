export const score = (value) =>
  value === null || value === undefined
    ? "Not scored"
    : Number(value).toFixed(3);
