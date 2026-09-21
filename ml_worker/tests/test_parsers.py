from pathlib import Path
import pytest
from parsers import canonical_csv,primavera_xer,ms_project_xml
ROOT=Path('/fixtures') if Path('/fixtures').exists() else Path(__file__).resolve().parents[2]/'database'/'fixtures'
@pytest.mark.parametrize('module,name',[(canonical_csv,'csv'),(primavera_xer,'xer'),(ms_project_xml,'xml')])
def test_fixture_parsers(module,name):
    r=module.parse((ROOT/f'demo_schedule.{name}').read_bytes());assert len(r['rows'])==30;assert not r['errors']
def test_xml_external_entity_rejected():
    with pytest.raises(Exception):ms_project_xml.parse(b'<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><Project>&x;</Project>')
def test_duplicate_and_bad_dates():
    row={'external_activity_id':'A','description':'Test','wbs_path':'A.B','activity_type':'ERECTION','planned_total_quantity':'10','quantity_unit':'spool','measurement_method':'QUANTITY','baseline_start':'2026-09-20','baseline_finish':'2026-09-10'}
    assert len(canonical_csv.validate([row,row])['errors'])==2
def test_explicit_relationship_validation():
    rows=canonical_csv.parse((ROOT/'demo_schedule.csv').read_bytes())['rows']
    rows[0]['relationships']=[{'predecessor':rows[2]['external_activity_id'],'type':'FS','lag':0,'lag_unit':'CALENDAR_DAYS'}]
    assert not canonical_csv.validate(rows)['errors']
    rows[0]['relationships'][0]['predecessor']='UNKNOWN'
    assert canonical_csv.validate(rows)['errors']
