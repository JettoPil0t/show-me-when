import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalTime } from '../app/time.js';

const OPENED = '2026-11-12T03:03:00.000Z';

test('Berlin viewer sees CET time with day before month', () => {
  assert.equal(formatLocalTime(OPENED, { locale: 'de-DE', timeZone: 'Europe/Berlin' }), '12.11., 04:03 MEZ');
});

test('Auckland viewer sees NZDT time with day before month', () => {
  assert.equal(formatLocalTime(OPENED, { locale: 'en-NZ', timeZone: 'Pacific/Auckland' }), '12/11, 04:03 pm NZDT');
});

test('Polish viewer sees day before month', () => {
  assert.match(formatLocalTime(OPENED, { locale: 'pl-PL', timeZone: 'Europe/Warsaw' }), /^12\.11, 04:03/);
});

test('US viewer keeps month before day', () => {
  assert.match(formatLocalTime(OPENED, { locale: 'en-US', timeZone: 'America/New_York' }), /^11\/11, 10:03/);
});

test('raw value is returned when the time cannot be parsed', () => {
  assert.equal(formatLocalTime('not a time'), 'not a time');
});
