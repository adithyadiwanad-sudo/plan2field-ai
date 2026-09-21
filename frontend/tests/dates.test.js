import test from 'node:test';import assert from 'node:assert/strict';
import {day,displayDate,signed} from '../src/lib/dates.js';
test('date display and arithmetic are date-only',()=>{assert.equal(day('2026-09-12')-day('2026-09-10'),2);assert.equal(displayDate(null),'Not available');assert.equal(signed(-2),'-2 d');});
