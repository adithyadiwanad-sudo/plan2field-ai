import { api } from "./client";
export const projects = async () => {
  const user = JSON.parse(sessionStorage.getItem("p2f-last-user") || "null");
  const key = "p2f-projects-" + user?.id;
  try {
    const rows = await api("/projects");
    sessionStorage.setItem(key, JSON.stringify(rows));
    return rows;
  } catch (e) {
    if (!navigator.onLine) {
      const rows = sessionStorage.getItem(key);
      if (rows) return JSON.parse(rows);
    }
    throw e;
  }
};
export const project = (id) => api(`/projects/${id}`);
export const activities = (id) => api(`/projects/${id}/activities?limit=200`);
