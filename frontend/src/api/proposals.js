import { api } from "./client";
export const proposals = (project, status = "PENDING") =>
  api(`/projects/${project}/proposals?status=${status}`);
export const proposalAction = (project, id, action, body) =>
  api(`/projects/${project}/proposals/${id}${action ? "/" + action : ""}`, {
    method: action ? "POST" : "PATCH",
    body,
  });
