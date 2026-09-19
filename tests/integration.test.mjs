import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,traveler} from './fixture.mjs';
import {sha256,keyedHash,encryptRecord,decryptRecord} from '../supabase/functions/insurance-api/crypto.mjs';
import {createHandler} from '../supabase/functions/insurance-api/handler.mjs';

test('PostgreSQL schema, encryption and actual HTTP handler integration',async t=>{
  const f=await fixture();
  const call=async(body,token,extra={})=>{
    const response=await f.handler(new Request('https://example.supabase.co/functions/v1/insurance-api',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4173',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify(body),
    }));
    return {status:response.status,data:await response.json(),headers:response.headers};
  };
  const reset=()=>f.pg.exec('delete from public.insurance_records;delete from public.insurance_sessions;delete from public.insurance_rate_buckets;delete from public.insurance_clear_challenges;');
  const login=async()=>{const r=await call({action:'login'});assert.equal(r.status,200);return r.data.token;};
  try{
    await t.test('No anonymous or authenticated table access, RPC execution, or missing RLS',async()=>{
      for(const role of ['anon','authenticated']){
        for(const table of ['insurance_records','insurance_sessions','insurance_rate_buckets','insurance_clear_challenges']){
          await assert.rejects(f.pg.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query('select * from public.'+table);}));
        }
        for(const query of ["select public.insurance_stats_snapshot()","select public.insurance_clear('x')","select public.insurance_session_create(repeat('a',64))","select public.insurance_rate_limit('x',1,1)"]){
          await assert.rejects(f.pg.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query(query);}));
        }
      }
      const {rows}=await f.pg.query("select relrowsecurity from pg_class where relname in ('insurance_records','insurance_sessions','insurance_rate_buckets','insurance_clear_challenges')");
      assert.equal(rows.length,4);assert.ok(rows.every(r=>r.relrowsecurity));
    });
    await t.test('Public sessions need no company password; direct operations still require a session',async()=>{
      await reset();
      assert.equal((await call({action:'login'})).status,200);
      for(const action of ['submit','stats','clear'])assert.equal((await call({action,statsPassword:f.config.STATS_PASSWORD,record:traveler()})).status,401);
    });
    await t.test('Public session stores only a token digest; ending registration revokes it',async()=>{
      await reset();const token=await login();
      const {rows}=await f.pg.query('select * from public.insurance_sessions');
      assert.equal(rows[0].token_hash,await sha256(token));assert.ok(!JSON.stringify(rows).includes(token));
      assert.equal((await call({action:'logout'},token)).status,200);
      assert.equal((await call({action:'submit',record:traveler()},token)).status,401);
    });
    await t.test('Expired sessions fail',async()=>{
      await reset();const token=await login();await f.pg.exec("update public.insurance_sessions set expires_at=now()-interval '1 second'");
      assert.equal((await call({action:'submit',record:traveler()},token)).status,401);
    });
    await t.test('Age and all modified plan fields rejected by API',async()=>{
      await reset();const token=await login();
      for(const record of [traveler({dob:'2011-10-19'}),traveler({premium:1}),traveler({cover:'69 / 10 / 10 萬'}),traveler({planName:'fake'}),traveler({dob:'2026-11-01'}),traveler({planCode:'Y1',planName:'保障型',cover:'69 / 10 / 10 萬',premium:176})]){
        assert.equal((await call({action:'submit',record},token)).status,400);
      }
    });
    await t.test('Independent devices update the same identity and share stats; ciphertext only at rest',async()=>{
      await reset();const one=await login(),two=await login();
      assert.equal((await call({action:'submit',record:traveler()},one)).data.updated,false);
      const update=traveler({planCode:'Z9',planName:'雙重守護型',premium:1225});
      assert.equal((await call({action:'submit',record:update},two)).data.updated,true);
      const {rows}=await f.pg.query('select * from public.insurance_records');
      assert.equal(rows.length,1);
      for(const value of ['測試旅客','A123456789','2011-10-18','雙重守護型'])assert.ok(!JSON.stringify(rows).includes(value));
      assert.notEqual(rows[0].idno_hash,await sha256('A123456789'));
      assert.equal((await call({action:'stats',statsPassword:'old-company-password'},one)).status,403);
      const stats=await call({action:'stats',statsPassword:f.config.STATS_PASSWORD},two);
      assert.equal(stats.status,200);assert.equal(stats.data.records.length,1);assert.equal(stats.data.records[0].premium,1225);
      assert.equal(stats.headers.get('cache-control'),'no-store');
    });
    await t.test('Under-15 record is accepted only as fixed Y1',async()=>{
      await reset();const token=await login();
      const record=traveler({dob:'2011-10-19',planCode:'Y1',planName:'保障型',cover:'69 / 10 / 10 萬',premium:176});
      assert.equal((await call({action:'submit',record},token)).status,200);
      const r=await call({action:'stats',statsPassword:f.config.STATS_PASSWORD},token);
      assert.equal(r.data.records[0].age,14);assert.equal(r.data.records[0].premium,176);
    });
    await t.test('Concurrent upserts preserve one row and report exactly one insert',async()=>{
      await reset();const hash=await keyedHash(f.config.INDEX_HASH_KEY,'id:A123456789');
      const row=await encryptRecord(f.config.DATA_ENCRYPTION_KEY,traveler(),hash);
      const results=await Promise.all(Array.from({length:12},()=>f.db.upsert(hash,row)));
      assert.equal(results.filter(r=>!r.updated).length,1);assert.equal((await f.db.stats()).length,1);
    });
    await t.test('Random IVs and authenticated binding reject tampering or row swaps',async()=>{
      const hash=await sha256('sample'),row=await encryptRecord(f.config.DATA_ENCRYPTION_KEY,traveler(),hash);
      const again=await encryptRecord(f.config.DATA_ENCRYPTION_KEY,traveler(),hash);assert.notEqual(row.payload_iv,again.payload_iv);
      await assert.rejects(decryptRecord(f.config.DATA_ENCRYPTION_KEY,{...row,idno_hash:await sha256('other')}));
      await assert.rejects(decryptRecord(f.config.DATA_ENCRYPTION_KEY,{...row,idno_hash:hash,payload_ciphertext:'A'+row.payload_ciphertext.slice(1,-4)+'AAAA'}));
    });
    await t.test('Persistent rate limit survives handler re-creation and enforces atomic counts',async()=>{
      await reset();
      const allowed=await Promise.all(Array.from({length:20},()=>f.db.rate('atomic',5,60)));
      assert.equal(allowed.filter(Boolean).length,5);
      for(let i=0;i<12;i++)assert.equal((await call({action:'login'})).status,200);
      f.handler=createHandler(f.config,f.db);
      assert.equal((await call({action:'login'})).status,429);
    });
    await t.test('Public sessions cannot read or delete without the independent stats password',async()=>{
      await reset();const token=await login();
      for(const action of ['stats','prepareClear','clear']){
        assert.equal((await call({action},token)).status,403);
        assert.equal((await call({action,statsPassword:'wrong'},token)).status,403);
      }
      assert.equal((await call({action:'stats',statsPassword:f.config.STATS_PASSWORD},token)).status,200);
    });
    await t.test('Stats password guessing stays limited across fresh public sessions',async()=>{
      await reset();const one=await login(),two=await login();
      for(let i=0;i<12;i++)assert.equal((await call({action:'stats',statsPassword:'wrong'},i%2?one:two)).status,403);
      const three=await login();
      assert.equal((await call({action:'stats',statsPassword:f.config.STATS_PASSWORD},three)).status,429);
    });
    await t.test('Clear requires fresh password and one-use confirmation; edits invalidate it',async()=>{
      await reset();const token=await login();await call({action:'submit',record:traveler()},token);
      const base={statsPassword:f.config.STATS_PASSWORD};
      assert.equal((await call({action:'clear',...base},token)).status,400);
      assert.equal((await call({action:'prepareClear',statsPassword:'wrong'},token)).status,403);
      const a=await call({action:'prepareClear',...base},token);assert.equal(a.data.count,1);
      await call({action:'submit',record:traveler({name:'更新測試旅客'})},token);
      assert.equal((await call({action:'clear',...base,confirmationToken:a.data.confirmationToken},token)).status,409);
      assert.equal((await f.db.stats()).length,1);
      const b=await call({action:'prepareClear',...base},token);
      assert.equal((await call({action:'clear',...base,confirmationToken:b.data.confirmationToken},token)).data.deleted,1);
      assert.equal((await call({action:'clear',...base,confirmationToken:b.data.confirmationToken},token)).status,409);
    });
    await t.test('Expired confirmation cannot delete records',async()=>{
      await reset();const hash=await sha256('confirmation');await f.db.prepareClear(hash);
      await f.pg.exec("update public.insurance_clear_challenges set expires_at=now()-interval '1 second'");
      assert.equal((await f.db.clear(hash)).ok,false);
    });
    await t.test('Stats scalar snapshot includes more than 1000 rows',async()=>{
      await reset();
      await f.pg.exec("insert into public.insurance_records(idno_hash,payload_ciphertext,payload_iv,key_version) select md5(n::text)||md5(n::text),'test-cipher','AAAAAAAAAAAAAAAA',1 from generate_series(1,1105) n");
      assert.equal((await f.db.stats()).length,1105);
    });
    await t.test('CORS, malformed/oversized input and invalid server configuration fail closed',async()=>{
      assert.equal((await call({action:'login' },null,{Origin:'https://untrusted.example'})).status,403);
      assert.equal((await call({action:'login',x:'a'.repeat(9000)})).status,413);
      const bad=await f.handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}));assert.equal(bad.status,400);
      const handler=createHandler({...f.config,DATA_ENCRYPTION_KEY:'bad'},f.db);
      assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,503);
    });
  }finally{await f.close();}
});
