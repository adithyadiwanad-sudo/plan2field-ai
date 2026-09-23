import { api } from "./client.js";

// Public demo account, intentionally available in this demo frontend bundle.
export const demoCredentials = {
  email: import.meta.env?.VITE_DEMO_EMAIL || "reviewer@plan2field.local",
  password: import.meta.env?.VITE_DEMO_PASSWORD || "ChangeThisDemoPassword123!",
};
export const demoRoles = [
  { email: "engineer@plan2field.ai", label: "👷 Demo as Field Engineer", role: "ENGINEER", color: "bg-blue-700! hover:bg-blue-800!" },
  { email: "planner@plan2field.ai", label: "📊 Demo as Project Planner", role: "REVIEWER", color: "bg-emerald-700! hover:bg-emerald-800!" },
];
export function loginDemo(email) {
  if (!demoRoles.some((role) => role.email === email)) throw new Error("Unknown demo role");
  return api("/auth/login", { method: "POST", body: { email, password: "ChangeThisDemoPassword123!" } });
}
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
