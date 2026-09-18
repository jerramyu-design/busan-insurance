import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calcAge,validateRecord,PLAN_RULES} from '../supabase/functions/insurance-api/domain.mjs';
import {traveler} from './fixture.mjs';
test('Exact age boundary, calendar validation, leap day and future dates',()=>{
  assert.equal(calcAge('2011-10-19'),14);assert.equal(calcAge('2011-10-18'),15);assert.equal(calcAge('2011-10-17'),15);
  assert.equal(calcAge('2012-02-29'),14);assert.equal(calcAge('2011-02-29'),null);assert.equal(calcAge('2026-10-19'),null);
  for(const v of ['',null,'2011-13-01','2011-04-31','0000-01-01','1800-01-01'])assert.equal(calcAge(v),null);
});
test('All fixed premiums and age eligibility are validated on the server',()=>{
  const prices={Y1:[176],U3:[953,1153,1390],Z10:[1100,1300,1537],Z9:[1225,1425,1662]};
  for(const [code,rules] of Object.entries(PLAN_RULES)){
    assert.deepEqual(Object.values(rules).map(r=>r.premium),prices[code]);
    for(const [cover,rule] of Object.entries(rules)){
      const input=traveler({dob:code==='Y1'?'2011-10-19':'2011-10-18',planCode:code,planName:rule.name,cover,premium:rule.premium});
      assert.equal(validateRecord(input).premium,rule.premium);
      assert.throws(()=>validateRecord({...input,dob:code==='Y1'?'2011-10-18':'2011-10-19'}));
      for(const change of [{premium:1},{premium:String(rule.premium)},{planName:'fake'},{cover:'changed'}])assert.throws(()=>validateRecord({...input,...change}));
    }
  }
});
test('Malformed data, invalid identity checksum and prototype keys are rejected',()=>{
  for(const value of [null,[],{},traveler({idno:'A123456788'}),traveler({planCode:'__proto__'}),traveler({name:'\u0000'}),traveler({name:' '})])assert.throws(()=>validateRecord(value));
  assert.equal(validateRecord(traveler({idno:' a123456789 ',age:999})).age,15);
});
