BEGIN;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_latitude double precision CHECK(site_latitude BETWEEN -90 AND 90);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_longitude double precision CHECK(site_longitude BETWEEN -180 AND 180);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geofence_radius_m double precision CHECK(geofence_radius_m>0 AND geofence_radius_m<=100000);
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS latitude double precision CHECK(latitude BETWEEN -90 AND 90);
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS longitude double precision CHECK(longitude BETWEEN -180 AND 180);
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS gps_accuracy_m double precision CHECK(gps_accuracy_m>=0 AND gps_accuracy_m<1000000);
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS geofence_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(geofence_status IN ('VERIFIED','OUT_OF_BOUNDS','UNKNOWN'));
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS evidence_urls jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(evidence_urls)='array');
ALTER TABLE site_reports ADD COLUMN IF NOT EXISTS delay_reason text CHECK(delay_reason IN ('MATERIAL_SHORTAGE','MANPOWER_SHORTAGE','EQUIPMENT_FAILURE','WEATHER_ACCESS','DESIGN_REWORK','OTHER'));
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS latitude double precision CHECK(latitude BETWEEN -90 AND 90);
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS longitude double precision CHECK(longitude BETWEEN -180 AND 180);
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS geofence_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(geofence_status IN ('VERIFIED','OUT_OF_BOUNDS','UNKNOWN'));
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS evidence_urls jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(evidence_urls)='array');
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS delay_reason text CHECK(delay_reason IN ('MATERIAL_SHORTAGE','MANPOWER_SHORTAGE','EQUIPMENT_FAILURE','WEATHER_ACCESS','DESIGN_REWORK','OTHER'));
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS affected_successor_ids jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(affected_successor_ids)='array');
CREATE INDEX IF NOT EXISTS relationships_downstream_idx ON activity_relationships(project_id,schedule_version_id,predecessor);
CREATE OR REPLACE FUNCTION populate_proposal_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r site_reports%ROWTYPE; delayed boolean; baseline date; observed date;
BEGIN
 SELECT sr.* INTO r FROM report_events e JOIN site_reports sr ON sr.id=e.site_report_id WHERE e.id=NEW.report_event_id AND e.project_id=NEW.project_id;
 NEW.latitude:=r.latitude; NEW.longitude:=r.longitude; NEW.geofence_status:=COALESCE(r.geofence_status,'UNKNOWN');
 NEW.evidence_urls:=COALESCE(r.evidence_urls,'[]'); NEW.delay_reason:=r.delay_reason;
 delayed := NEW.delay_reason IS NOT NULL;
 IF NEW.selected_activity_id IS NOT NULL THEN
  SELECT CASE WHEN NEW.proposed_changes->>'event_type'='START' THEN b.baseline_start ELSE b.baseline_finish END INTO baseline
    FROM activity_baselines b WHERE b.activity_id=NEW.selected_activity_id AND b.project_id=NEW.project_id AND b.schedule_version_id=NEW.schedule_version_id;
  IF NEW.proposed_changes->>'event_type' IN ('START','FINISH') AND NEW.proposed_changes->>'event_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN
   observed := (NEW.proposed_changes->>'event_date')::date;
   delayed := delayed OR COALESCE(observed>baseline,false);
  END IF;
  delayed := delayed OR EXISTS(SELECT 1 FROM schedule_activities a JOIN activity_baselines b ON b.activity_id=a.id WHERE a.id=NEW.selected_activity_id AND a.project_id=NEW.project_id AND (a.actual_start>b.baseline_start OR a.actual_finish>b.baseline_finish));
 END IF;
 NEW.affected_successor_ids:='[]';
 IF delayed THEN
  SELECT COALESCE(jsonb_agg(a.external_activity_id ORDER BY a.external_activity_id),'[]') INTO NEW.affected_successor_ids
   FROM activity_relationships rel JOIN schedule_activities a ON a.id=rel.successor AND a.project_id=rel.project_id AND a.schedule_version_id=rel.schedule_version_id
   WHERE rel.project_id=NEW.project_id AND rel.schedule_version_id=NEW.schedule_version_id AND rel.predecessor=NEW.selected_activity_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proposal_evidence_snapshot ON staged_proposals;
CREATE TRIGGER proposal_evidence_snapshot BEFORE INSERT OR UPDATE ON staged_proposals FOR EACH ROW EXECUTE FUNCTION populate_proposal_evidence();
-- Populate additive metadata on pending legacy proposals without changing actuals.
UPDATE staged_proposals SET selected_activity_id=selected_activity_id WHERE lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED');
COMMIT;
