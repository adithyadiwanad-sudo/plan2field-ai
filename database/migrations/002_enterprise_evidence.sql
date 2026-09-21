BEGIN;
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS reporter_role text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE report_events ADD COLUMN IF NOT EXISTS discipline text GENERATED ALWAYS AS (COALESCE(extracted_fields->>'discipline','UNKNOWN')) STORED;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS match_classification text GENERATED ALWAYS AS (
 CASE WHEN selected_activity_id IS NULL THEN 'UNMATCHED'
 WHEN routing_status='AUTO_STAGED' THEN 'AUTO_LINKED'
 WHEN reason_codes ? 'LOW_UNCALIBRATED_SCORE' OR reason_codes ? 'CANDIDATE_AMBIGUITY' THEN 'LOW_CONFIDENCE'
 ELSE 'REVIEW_REQUIRED' END) STORED;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS proposed_variance jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS report_events_discipline_idx ON report_events(project_id,discipline);
CREATE INDEX IF NOT EXISTS history_discipline_work_idx ON historical_activity_records(discipline,work_type);
-- Capture the role at submission, not the mutable role at query time. Older records
-- remain UNKNOWN: a current membership cannot prove a historical reporter role.
CREATE OR REPLACE FUNCTION capture_reporter_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT role INTO NEW.reporter_role FROM project_memberships WHERE project_id=NEW.project_id AND user_id=NEW.submitted_by;
 NEW.reporter_role := COALESCE(NEW.reporter_role,'UNKNOWN');
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS report_role_snapshot ON site_reports;
CREATE TRIGGER report_role_snapshot BEFORE INSERT ON site_reports FOR EACH ROW EXECUTE FUNCTION capture_reporter_role();
-- Trigger-only audit writer; runtime roles cannot modify the append-only audit.
CREATE OR REPLACE FUNCTION audit_evidence_creation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO audit_events(project_id,actor_id,action,entity_type,entity_id,request_id,after_json)
 VALUES(NEW.project_id,CASE WHEN TG_TABLE_NAME='site_reports' THEN (to_jsonb(NEW)->>'submitted_by')::uuid ELSE NULL END,
 CASE WHEN TG_TABLE_NAME='site_reports' THEN 'REPORT_SUBMITTED' ELSE 'AI_STAGED' END,TG_TABLE_NAME,NEW.id,'db:'||NEW.id,to_jsonb(NEW));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION audit_evidence_creation() FROM PUBLIC;
DROP TRIGGER IF EXISTS report_creation_audit ON site_reports;
CREATE TRIGGER report_creation_audit AFTER INSERT ON site_reports FOR EACH ROW EXECUTE FUNCTION audit_evidence_creation();
DROP TRIGGER IF EXISTS proposal_creation_audit ON staged_proposals;
CREATE TRIGGER proposal_creation_audit AFTER INSERT ON staged_proposals FOR EACH ROW EXECUTE FUNCTION audit_evidence_creation();
COMMIT;
