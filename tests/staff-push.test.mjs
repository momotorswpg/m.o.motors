import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSecret, safeEndpoint } from '../supabase/functions/staff-push/core.mjs';

test('dispatch secret must match and cannot be empty',()=>{
  assert.equal(sameSecret('abc','abc'),true);
  assert.equal(sameSecret('abc','abd'),false);
  assert.equal(sameSecret('abc','abcd'),false);
  assert.equal(sameSecret('',''),false);
});

test('push endpoint cannot target arbitrary or local servers',()=>{
  assert.equal(safeEndpoint('https://fcm.googleapis.com/fcm/send/test'),true);
  assert.equal(safeEndpoint('https://web.push.apple.com/test'),true);
  assert.equal(safeEndpoint('http://fcm.googleapis.com/test'),false);
  assert.equal(safeEndpoint('https://localhost/test'),false);
  assert.equal(safeEndpoint('https://127.0.0.1/test'),false);
  assert.equal(safeEndpoint('https://fcm.googleapis.com.evil.test/test'),false);
  assert.equal(safeEndpoint('https://fcm.googleapis.com:8443/test'),false);
});
