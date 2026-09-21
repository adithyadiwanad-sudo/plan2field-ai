import { api } from "./client.js";

// Public demo account, intentionally available in this demo frontend bundle.
export const demoCredentials = {
  email: import.meta.env?.VITE_DEMO_EMAIL || "reviewer@plan2field.local",
  password: import.meta.env?.VITE_DEMO_PASSWORD || "ChangeThisDemoPassword123!",
};
let pending;
export function restoreDemoSession() {
  if (!pending)
    pending = api("/auth/me")
      .catch((error) => {
        if (error.status !== 401 || error.code === "INVALID_API_RESPONSE")
          throw error;
        return api("/auth/login", { method: "POST", body: demoCredentials });
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
