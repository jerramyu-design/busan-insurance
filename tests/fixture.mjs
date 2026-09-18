import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../supabase/functions/insurance-api/db.mjs';
import {createHandler} from '../supabase/functions/insurance-api/handler.mjs';
import {randomBytes} from 'node:crypto';
export async function fixture(){
  const pg=new PGlite();
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  const config={
    SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
    COMPANY_ACCESS_CODE:'test-company-only',STATS_PASSWORD:'test-stats-only',
    DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),INDEX_HASH_KEY:randomBytes(32).toString('base64'),
    ALLOWED_ORIGINS:'http://127.0.0.1:4173',
  };
  const db=createDatabase(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,async(url,opts)=>{
    const name=url.split('/').at(-1),args=JSON.parse(opts.body);
    if(!/^insurance_[a-z_]+$/.test(name))throw new Error('Invalid RPC');
    const names=Object.keys(args);if(!names.every(n=>/^p_[a-z_]+$/.test(n)))throw new Error('Invalid argument');
    const sql='select public.'+name+'('+names.map((n,i)=>n+'=> $'+(i+1)).join(',')+') as result';
    return pg.transaction(async tx=>{
      await tx.exec('set local role service_role');
      const data=await tx.query(sql,Object.values(args));
      return Response.json(data.rows[0].result);
    });
  });
  return {pg,db,config,handler:createHandler(config,db),close:()=>pg.close()};
}
export function traveler(overrides={}){
  return {name:'測試旅客',idno:'A123456789',dob:'2011-10-18',planCode:'U3',planName:'豪華定額型',cover:'300 / 30 / 30 萬',premium:953,...overrides};
}
