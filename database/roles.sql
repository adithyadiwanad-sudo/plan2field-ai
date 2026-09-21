-- Passwords are assigned by bootstrap from .env, never by application startup.
CREATE ROLE p2f_api LOGIN;
CREATE ROLE p2f_worker LOGIN;
GRANT CONNECT ON DATABASE plan2field TO p2f_api,p2f_worker;
GRANT USAGE ON SCHEMA public TO p2f_api,p2f_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO p2f_api,p2f_worker;
GRANT INSERT,UPDATE,DELETE ON sessions TO p2f_api;
GRANT INSERT,UPDATE ON projects,schedule_versions,site_reports,staged_proposals,jobs TO p2f_api;
GRANT UPDATE ON schedule_activities TO p2f_api;
GRANT INSERT ON progress_events,audit_events,proposal_revisions,export_outbox,historical_activity_records TO p2f_api;
GRANT INSERT,DELETE ON component_completions TO p2f_api;
GRANT INSERT,UPDATE ON schedule_versions,site_reports,jobs,worker_health TO p2f_worker;
GRANT INSERT ON schedule_activities,activity_baselines,activity_components,activity_relationships,report_events,staged_proposals,activity_embeddings TO p2f_worker;
GRANT UPDATE ON activity_embeddings TO p2f_worker;
REVOKE UPDATE,DELETE,TRUNCATE ON activity_baselines,progress_events,audit_events,proposal_revisions FROM p2f_api,p2f_worker;
