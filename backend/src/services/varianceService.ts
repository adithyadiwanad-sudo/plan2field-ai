export function variance(actual: string | null, baseline: string | null) {
  return actual && baseline
    ? Math.round(
        (Date.parse(actual + "T00:00:00Z") -
          Date.parse(baseline + "T00:00:00Z")) /
          86400000,
      )
    : null;
}
