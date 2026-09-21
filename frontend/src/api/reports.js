import { api } from "./client";
export function sendReport(projectId, data) {
  const form = new FormData();
  for (const [key, value] of Object.entries(data))
    if (value !== undefined && value !== null) form.append(key, value);
  return api(`/projects/${projectId}/reports`, { method: "POST", body: form });
}
