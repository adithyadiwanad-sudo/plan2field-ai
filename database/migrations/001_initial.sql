BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL,
 description text NOT NULL DEFAULT '', timezone text NOT NULL DEFAULT 'Asia/Kolkata', reporting_date date NOT NULL,
 active_schedule_version_id uuid, status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLOSED')),
 provenance text NOT NULL DEFAULT 'IMPORTED_UNVERIFIED', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text UNIQUE NOT NULL,password_hash text NOT NULL, name text NOT NULL);
CREATE TABLE project_memberships(project_id uuid REFERENCES projects, user_id uuid REFERENCES users, role text NOT NULL CHECK(role IN ('ENGINEER','REVIEWER','ADMIN')),PRIMARY KEY(project_id,user_id));
CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users,csrf_token text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE schedule_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects,version_number integer NOT NULL,
 source_format text NOT NULL,source_filename text NOT NULL,source_hash text NOT NULL,import_status text NOT NULL DEFAULT 'QUEUED',
 imported_at timestamptz NOT NULL DEFAULT now(),imported_by uuid REFERENCES users,parser_version text NOT NULL DEFAULT '1',
 validation_summary jsonb NOT NULL DEFAULT '{}', UNIQUE(project_id,version_number), UNIQUE(id,project_id)
);
ALTER TABLE projects ADD CONSTRAINT active_version_fk FOREIGN KEY(active_schedule_version_id,id) REFERENCES schedule_versions(id,project_id);
CREATE TABLE schedule_activities(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects,schedule_version_id uuid NOT NULL,
 external_activity_id text NOT NULL,description text NOT NULL,wbs_path text NOT NULL,discipline text,area text,asset_tag text,line_number text,
 activity_type text NOT NULL,source_metadata jsonb NOT NULL DEFAULT '{}',planned_total_quantity numeric NOT NULL CHECK(planned_total_quantity>0),
 quantity_unit text NOT NULL,measurement_method text NOT NULL CHECK(measurement_method IN ('QUANTITY','EQUAL_COMPONENTS','WEIGHTED_COMPONENTS')),
 forecast_start date,forecast_finish date, actual_start date,actual_finish date,
 accepted_quantity numeric NOT NULL DEFAULT 0 CHECK(accepted_quantity>=0 AND accepted_quantity<=planned_total_quantity),
 physical_percent_complete numeric NOT NULL DEFAULT 0 CHECK(physical_percent_complete BETWEEN 0 AND 100),row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(actual_finish IS NULL OR (actual_start IS NOT NULL AND actual_finish>=actual_start)),
 CHECK(forecast_start IS NULL OR forecast_finish IS NULL OR forecast_finish>=forecast_start),
 UNIQUE(project_id,schedule_version_id,external_activity_id),UNIQUE(id,project_id,schedule_version_id),UNIQUE(id,project_id),
 FOREIGN KEY(schedule_version_id,project_id) REFERENCES schedule_versions(id,project_id)
);
CREATE TABLE activity_baselines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,schedule_version_id uuid NOT NULL,activity_id uuid NOT NULL UNIQUE,
 baseline_start date,baseline_finish date,baseline_quantity numeric CHECK(baseline_quantity>0),measurement_metadata jsonb NOT NULL,
 provenance jsonb NOT NULL,CHECK(baseline_finish>=baseline_start),
 FOREIGN KEY(activity_id,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id)
);
CREATE TABLE activity_relationships(
 project_id uuid NOT NULL,schedule_version_id uuid NOT NULL,predecessor uuid NOT NULL,successor uuid NOT NULL,
 relationship_type text CHECK(relationship_type IN ('FS','SS','FF','SF')),lag numeric NOT NULL DEFAULT 0,source_metadata jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(predecessor,successor),CHECK(predecessor<>successor),
 FOREIGN KEY(predecessor,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id),
 FOREIGN KEY(successor,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id)
);
CREATE TABLE activity_components(activity_id uuid REFERENCES schedule_activities,external_id text NOT NULL,weight numeric NOT NULL CHECK(weight>0),stage text NOT NULL DEFAULT 'COMPLETE',PRIMARY KEY(activity_id,external_id,stage));
CREATE TABLE activity_embeddings(
 activity_id uuid NOT NULL,project_id uuid NOT NULL,schedule_version_id uuid NOT NULL,model_id text NOT NULL,revision text NOT NULL,
 dimension integer NOT NULL CHECK(dimension=384),content_hash text NOT NULL,embedding vector(384) NOT NULL,
 PRIMARY KEY(activity_id,model_id,revision),FOREIGN KEY(activity_id,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id)
);
CREATE TABLE site_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects,submitted_by uuid NOT NULL REFERENCES users,
 source_type text NOT NULL CHECK(source_type IN ('TEXT','VOICE','SPREADSHEET','SCAN')),original_text text,transcript text,storage_ref text,content_hash text,
 reporting_date date NOT NULL,captured_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),language text NOT NULL DEFAULT 'en',
 extraction_provider text NOT NULL DEFAULT 'deterministic-v1',idempotency_key uuid NOT NULL,request_payload_hash text NOT NULL,
 processing_status text NOT NULL DEFAULT 'QUEUED',error_details text,metadata jsonb NOT NULL DEFAULT '{}',
 UNIQUE(project_id,submitted_by,idempotency_key),UNIQUE(id,project_id)
);
CREATE TABLE report_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_report_id uuid NOT NULL,project_id uuid NOT NULL,event_index integer NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('START','FINISH','PROGRESS','BLOCKER','PLAN','CORRECTION','UNKNOWN')),
 extracted_fields jsonb NOT NULL,evidence jsonb NOT NULL,extraction_version text NOT NULL,
 UNIQUE(site_report_id,extraction_version,event_index),UNIQUE(id,project_id),
 FOREIGN KEY(site_report_id,project_id) REFERENCES site_reports(id,project_id)
);
CREATE TABLE staged_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_event_id uuid NOT NULL,project_id uuid NOT NULL,schedule_version_id uuid NOT NULL,
 selected_activity_id uuid,candidate_matches jsonb NOT NULL,proposed_changes jsonb NOT NULL,expected_activity_row_version integer,
 raw_scores jsonb NOT NULL DEFAULT '{}',match_score double precision,score_type text NOT NULL DEFAULT 'HEURISTIC',calibrated_probability numeric,
 model_version text NOT NULL,calibration_version text,policy_version text NOT NULL DEFAULT 'conservative-v1',routing_status text NOT NULL CHECK(routing_status IN ('AUTO_STAGED','REVIEW_NEEDED','REJECTED')),
 lifecycle_status text NOT NULL DEFAULT 'PENDING' CHECK(lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED','APPROVED','REJECTED','STALE','SUPERSEDED')),
 missing_fields jsonb NOT NULL DEFAULT '[]',reason_codes jsonb NOT NULL DEFAULT '[]',explanation text NOT NULL,
 proposed_by text NOT NULL DEFAULT 'local-worker',reviewed_by uuid REFERENCES users,reviewed_at timestamptz,proposal_version integer NOT NULL DEFAULT 1,
 UNIQUE(report_event_id),UNIQUE(id,project_id),
 FOREIGN KEY(report_event_id,project_id) REFERENCES report_events(id,project_id),
 FOREIGN KEY(schedule_version_id,project_id) REFERENCES schedule_versions(id,project_id),
 FOREIGN KEY(selected_activity_id,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id)
);
CREATE TABLE proposal_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),proposal_id uuid NOT NULL REFERENCES staged_proposals,version integer NOT NULL,snapshot jsonb NOT NULL,actor_id uuid REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(proposal_id,version));
CREATE TABLE progress_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),proposal_id uuid NOT NULL UNIQUE,activity_id uuid NOT NULL,project_id uuid NOT NULL,schedule_version_id uuid NOT NULL,
 event_type text NOT NULL,effective_date date NOT NULL,quantity_mode text CHECK(quantity_mode IN ('INCREMENTAL','CUMULATIVE','COMPONENT_SET')),
 quantity numeric CHECK(quantity>=0),unit text,component_ids jsonb NOT NULL DEFAULT '[]',before_state jsonb NOT NULL,after_state jsonb NOT NULL,
 correction_of_event_id uuid,approved_by uuid NOT NULL REFERENCES users,committed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,project_id,activity_id),
 FOREIGN KEY(correction_of_event_id,project_id,activity_id) REFERENCES progress_events(id,project_id,activity_id),
 FOREIGN KEY(proposal_id,project_id) REFERENCES staged_proposals(id,project_id),
 FOREIGN KEY(activity_id,project_id,schedule_version_id) REFERENCES schedule_activities(id,project_id,schedule_version_id)
);
CREATE TABLE component_completions(activity_id uuid NOT NULL,external_id text NOT NULL,stage text NOT NULL DEFAULT 'COMPLETE',progress_event_id uuid NOT NULL REFERENCES progress_events,PRIMARY KEY(activity_id,external_id,stage),FOREIGN KEY(activity_id,external_id,stage) REFERENCES activity_components);
CREATE TABLE audit_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects,actor_id uuid REFERENCES users,action text NOT NULL,entity_type text NOT NULL,entity_id uuid NOT NULL,request_id text NOT NULL,before_json jsonb,after_json jsonb,evidence jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),type text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'QUEUED',attempt_count integer NOT NULL DEFAULT 0,max_attempts integer NOT NULL DEFAULT 3,available_at timestamptz NOT NULL DEFAULT now(),lease_owner text,lease_expires_at timestamptz,deduplication_key text NOT NULL UNIQUE,last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX jobs_claim_idx ON jobs(status,available_at);
CREATE TABLE worker_health(worker_id text PRIMARY KEY,heartbeat_at timestamptz NOT NULL,models_ready boolean NOT NULL,error text);
CREATE TABLE export_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),progress_event_id uuid NOT NULL UNIQUE REFERENCES progress_events,target_adapter text NOT NULL DEFAULT 'UPDATE_PROPOSAL',payload jsonb NOT NULL,status text NOT NULL DEFAULT 'UNCONFIRMED',attempt_count integer NOT NULL DEFAULT 0,idempotency_key uuid NOT NULL UNIQUE,external_acknowledgement jsonb,reconciliation_result jsonb);
CREATE TABLE historical_activity_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects,activity_id uuid,
 work_type text NOT NULL,discipline text NOT NULL,quantity numeric NOT NULL,unit text NOT NULL,context jsonb NOT NULL,
 baseline_duration integer NOT NULL,actual_duration integer NOT NULL,duration_basis text NOT NULL,calendar_reference text,
 date_evidence jsonb NOT NULL,deviation_reason text NOT NULL,provenance text NOT NULL CHECK(provenance IN ('SYNTHETIC','IMPORTED_UNVERIFIED','VERIFIED')),
 approved_by uuid REFERENCES users,approved_at timestamptz,closeout_version integer NOT NULL,UNIQUE(activity_id,closeout_version),
 FOREIGN KEY(activity_id,project_id) REFERENCES schedule_activities(id,project_id)
);
CREATE INDEX reports_project_idx ON site_reports(project_id,received_at DESC);
CREATE INDEX proposals_project_idx ON staged_proposals(project_id,lifecycle_status);
CREATE INDEX audit_project_idx ON audit_events(project_id,created_at DESC);
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable record: append a correction or create a new baseline version'; END $$;
CREATE TRIGGER baseline_immutable BEFORE UPDATE OR DELETE ON activity_baselines FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER progress_immutable BEFORE UPDATE OR DELETE ON progress_events FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER revisions_immutable BEFORE UPDATE OR DELETE ON proposal_revisions FOR EACH ROW EXECUTE FUNCTION immutable_record();
COMMIT;
