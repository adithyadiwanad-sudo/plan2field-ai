import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { transaction } from "../db/transactions.js";
import { reviewer } from "../middleware/projectAccess.js";
import { ApiError } from "../middleware/errors.js";
import { eventSchema } from "../schemas/event.js";
import { revalidate } from "../services/proposalService.js";
import { approve } from "../services/approvalService.js";
import { audit } from "../services/auditService.js";
import { page } from "./activities.js";
export const proposalsRouter = Router({ mergeParams: true });
proposalsRouter.post("/:proposalId/validate", async (req, res) => {
  reviewer(res);
  const d = z
    .object({
      selected_activity_id: z.string().uuid(),
      proposed_changes: eventSchema,
    })
    .parse(req.body);
  const p = (
    await pool.query(
      "SELECT p.*,pr.reporting_date,pr.active_schedule_version_id FROM staged_proposals p JOIN projects pr ON pr.id=p.project_id WHERE p.id=$1 AND p.project_id=$2",
      [z.string().uuid().parse(req.params.proposalId), res.locals.projectId],
    )
  ).rows[0];
  if (!p) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  if (p.schedule_version_id !== p.active_schedule_version_id)
    throw new ApiError(
      409,
      "STALE_PROPOSAL",
      "The active schedule has changed.",
    );
  const a = (
    await pool.query(
      "SELECT * FROM schedule_activities WHERE id=$1 AND project_id=$2 AND schedule_version_id=$3",
      [d.selected_activity_id, res.locals.projectId, p.schedule_version_id],
    )
  ).rows[0];
  if (!a)
    throw new ApiError(
      422,
      "INVALID_CANDIDATE",
      "Candidate is outside the proposal schedule.",
    );
  res.json(await revalidate(pool, a, d.proposed_changes, p.reporting_date));
});
proposalsRouter.get("/", async (req, res) => {
  const p = page(req.query),
    status = z
      .enum([
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CLARIFICATION_REQUESTED",
        "STALE",
        "SUPERSEDED",
      ])
      .optional()
      .parse(req.query.status);
  res.json(
    (
      await pool.query(
        "SELECT p.*,r.original_text,r.transcript,r.source_type,r.reporting_date,r.id AS report_id,r.submitted_by,r.reporter_role,r.received_at,e.discipline,e.evidence AS source_evidence FROM staged_proposals p JOIN report_events e ON e.id=p.report_event_id JOIN site_reports r ON r.id=e.site_report_id WHERE p.project_id=$1 AND ($2::text IS NULL OR p.lifecycle_status=$2) ORDER BY r.received_at DESC LIMIT $3 OFFSET $4",
        [res.locals.projectId, status || null, p.limit, p.offset],
      )
    ).rows,
  );
});
proposalsRouter.get("/:proposalId", async (req, res) => {
  const p = (
    await pool.query(
      "SELECT * FROM staged_proposals WHERE id=$1 AND project_id=$2",
      [z.string().uuid().parse(req.params.proposalId), res.locals.projectId],
    )
  ).rows[0];
  if (!p) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  res.json(p);
});
proposalsRouter.patch("/:proposalId", async (req, res) => {
  reviewer(res);
  const d = z
    .object({
      proposal_version: z.number().int().positive(),
      selected_activity_id: z.string().uuid(),
      proposed_changes: eventSchema,
    })
    .parse(req.body);
  res.json(
    await transaction(async (c) => {
      const project = (
        await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
          res.locals.projectId,
        ])
      ).rows[0];
      const p = (
        await c.query(
          "SELECT * FROM staged_proposals WHERE id=$1 AND project_id=$2 FOR UPDATE",
          [
            z.string().uuid().parse(req.params.proposalId),
            res.locals.projectId,
          ],
        )
      ).rows[0];
      if (!p) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
      if (
        !["PENDING", "CLARIFICATION_REQUESTED"].includes(p.lifecycle_status) ||
        p.proposal_version !== d.proposal_version ||
        p.schedule_version_id !== project.active_schedule_version_id
      )
        throw new ApiError(
          409,
          "STALE_PROPOSAL",
          "Refresh the proposal; its version or schedule changed.",
        );
      const a = (
        await c.query(
          "SELECT * FROM schedule_activities WHERE id=$1 AND project_id=$2 AND schedule_version_id=$3",
          [d.selected_activity_id, res.locals.projectId, p.schedule_version_id],
        )
      ).rows[0];
      if (!a)
        throw new ApiError(
          422,
          "INVALID_CANDIDATE",
          "Candidate is outside the active schedule.",
        );
      await revalidate(c, a, d.proposed_changes, project.reporting_date);
      const candidate = p.candidate_matches.find(
        (item: any) => item.id === a.id,
      );
      await c.query(
        "INSERT INTO proposal_revisions(proposal_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4)",
        [p.id, p.proposal_version, JSON.stringify(p), res.locals.user.id],
      );
      const updated = (
        await c.query(
          "UPDATE staged_proposals SET selected_activity_id=$2,proposed_changes=$3,expected_activity_row_version=$4,proposal_version=proposal_version+1,missing_fields='[]',lifecycle_status='PENDING',routing_status='REVIEW_NEEDED',match_score=$5,raw_scores=$6,proposed_variance='{}' WHERE id=$1 RETURNING *",
          [
            p.id,
            a.id,
            JSON.stringify(d.proposed_changes),
            a.row_version,
            candidate?.rerank_score ?? null,
            JSON.stringify(
              candidate
                ? {
                    retrieval: candidate.retrieval_score,
                    rerank: candidate.rerank_score,
                  }
                : {},
            ),
          ],
        )
      ).rows[0];
      await audit(
        c,
        res.locals.projectId,
        res.locals.user.id,
        "REVALIDATED",
        p.id,
        res.locals.requestId,
        p,
        updated,
      );
      return updated;
    }),
  );
});
proposalsRouter.post("/:proposalId/approve", async (req, res) => {
  reviewer(res);
  res.json(
    await approve(
      res.locals.projectId,
      z.string().uuid().parse(req.params.proposalId),
      z.number().int().positive().parse(req.body.proposal_version),
      res.locals.user.id,
      res.locals.requestId,
    ),
  );
});
for (const action of ["clarify", "reject"])
  proposalsRouter.post(`/:proposalId/${action}`, async (req, res) => {
    reviewer(res);
    const d = z
      .object({
        reason: z.string().trim().min(3).max(2000),
        proposal_version: z.number().int().positive(),
      })
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        await c.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [
          res.locals.projectId,
        ]);
        const previous = (
          await c.query(
            "SELECT * FROM staged_proposals WHERE id=$1 AND project_id=$2 FOR UPDATE",
            [
              z.string().uuid().parse(req.params.proposalId),
              res.locals.projectId,
            ],
          )
        ).rows[0];
        const p = (
          await c.query(
            "UPDATE staged_proposals SET lifecycle_status=$4,reviewed_by=$5,reviewed_at=now(),proposal_version=proposal_version+1,explanation=$6 WHERE id=$1 AND project_id=$2 AND proposal_version=$3 AND lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED') RETURNING *",
            [
              z.string().uuid().parse(req.params.proposalId),
              res.locals.projectId,
              d.proposal_version,
              action === "reject" ? "REJECTED" : "CLARIFICATION_REQUESTED",
              res.locals.user.id,
              d.reason,
            ],
          )
        ).rows[0];
        if (!p)
          throw new ApiError(
            409,
            "STALE_PROPOSAL",
            "Proposal changed or no longer accepts this action.",
          );
        await c.query(
          "INSERT INTO proposal_revisions(proposal_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4)",
          [
            p.id,
            previous.proposal_version,
            JSON.stringify(previous),
            res.locals.user.id,
          ],
        );
        await audit(
          c,
          res.locals.projectId,
          res.locals.user.id,
          action.toUpperCase(),
          p.id,
          res.locals.requestId,
          null,
          { reason: d.reason },
        );
        await c.query(
          "UPDATE site_reports r SET processing_status=CASE WHEN EXISTS(SELECT 1 FROM report_events e JOIN staged_proposals p ON p.report_event_id=e.id WHERE e.site_report_id=r.id AND p.lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED','STALE')) THEN 'NEEDS_REVIEW' WHEN EXISTS(SELECT 1 FROM report_events e JOIN staged_proposals p ON p.report_event_id=e.id WHERE e.site_report_id=r.id AND p.lifecycle_status='APPROVED') THEN 'ACCEPTED' ELSE 'REJECTED' END WHERE r.id=(SELECT site_report_id FROM report_events WHERE id=$1)",
          [p.report_event_id],
        );
        return p;
      }),
    );
  });
