export function captureLocation(
  geolocation = globalThis.navigator?.geolocation,
) {
  if (!geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({}), 9000);
    try { geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          gps_accuracy_m: position.coords.accuracy,
        });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    ); } catch { clearTimeout(timer); resolve({}); }
  });
}
