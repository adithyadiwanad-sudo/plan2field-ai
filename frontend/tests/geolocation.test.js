import test from 'node:test';
import assert from 'node:assert/strict';
import {captureLocation} from '../src/lib/geolocation.js';
test('capture current GPS without reusing a cached location',async()=>{
 const data=await captureLocation({getCurrentPosition(success,_failure,options){assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);success({coords:{latitude:0,longitude:1,accuracy:3}});}});
 assert.deepEqual(data,{latitude:0,longitude:1,gps_accuracy_m:3});
});
test('denied or unavailable GPS leaves reports submittable with no fabricated coordinates',async()=>{
 assert.deepEqual(await captureLocation(null),{});
 assert.deepEqual(await captureLocation({getCurrentPosition(_success,failure){failure({code:1});}}),{});
 assert.deepEqual(await captureLocation({getCurrentPosition(){throw new Error('Browser security policy');}}),{});
});
