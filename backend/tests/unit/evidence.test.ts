import test from 'node:test';
import assert from 'node:assert/strict';
import {geofence,photoType} from '../../src/services/evidenceService.js';
import {reportSchema} from '../../src/routes/reports.js';
const site={site_latitude:0,site_longitude:0,geofence_radius_m:1000};
test('geofence handles inside, outside, accuracy boundary, missing configuration and zero coordinates',()=>{
 assert.equal(geofence(site,0,0,5),'VERIFIED');
 assert.equal(geofence(site,1,1,5),'OUT_OF_BOUNDS');
 assert.equal(geofence(site,0,0,1500),'UNKNOWN');
 assert.equal(geofence({},0,0,5),'UNKNOWN');
 assert.equal(geofence(site,undefined,undefined),'UNKNOWN');
});
test('report coordinates and delay reason validate multipart strings and reject incomplete or invalid values',()=>{
 const base={source_type:'TEXT',original_text:'Work delayed',reporting_date:'2026-09-15',captured_at:'2026-09-15T10:00:00Z',idempotency_key:'10000000-0000-4000-8000-000000000001'};
 const d=reportSchema.parse({...base,latitude:'0',longitude:'0',gps_accuracy_m:'5',delay_reason:'WEATHER_ACCESS',geofence_status:'VERIFIED'});
 assert.equal(d.latitude,0);assert.equal(d.longitude,0);assert.equal('geofence_status' in d,false);
 for(const extra of [{latitude:5},{latitude:91,longitude:0},{latitude:'NaN',longitude:0},{delay_reason:'FAKE'},{latitude:'',longitude:5}])assert.throws(()=>reportSchema.parse({...base,...extra}));
 assert.ok(reportSchema.parse(base));
 assert.equal(reportSchema.parse({...base,latitude:null,longitude:null}).latitude,undefined);
});
test('photos reject SVG/text and oversized evidence despite supplied MIME type',()=>{
 assert.throws(()=>photoType({buffer:Buffer.from('<svg/>'),mimetype:'image/png'} as any),/PNG or JPEG/);
 assert.throws(()=>photoType({buffer:Buffer.alloc(5*1024*1024+1)} as any),/5 MB/);
});
