import {InputError,validateRecord} from './domain.mjs';
import {keyBytes,keyedHash,sha256,secureEqual,randomToken,encryptRecord,decryptRecord} from './crypto.mjs';
export function createHandler(config,db){
  let configured=false;
  const origins=(config.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
  try{
    keyBytes(config.DATA_ENCRYPTION_KEY);keyBytes(config.INDEX_HASH_KEY);
    configured=Boolean(config.SUPABASE_URL&&config.SUPABASE_SERVICE_ROLE_KEY&&config.STATS_PASSWORD&&origins.length&&!origins.includes('*'));
  }catch{/* Fail closed without exposing values. */}
  return async function handler(req){
    const origin=req.headers.get('origin'),allowed=origin&&origins.includes(origin);
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    const fail=(error,status)=>json({ok:false,error},status);
    if(origin&&!allowed)return fail('此網站來源未獲允許。',403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return fail('不支援此操作方式。',405);
    if(!configured)return fail('線上資料庫尚未完成設定，請聯絡管理者。',503);
    try{
      if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return fail('請使用 JSON 格式。',415);
      if(Number(req.headers.get('content-length'))>8192)return fail('送出的資料過大。',413);
      const reader=req.body?.getReader();if(!reader)return fail('資料格式錯誤。',400);
      const chunks=[];let size=0;
      for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return fail('送出的資料過大。',413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('資料格式錯誤。',400);}
      if(!body||typeof body!=='object'||Array.isArray(body))return fail('資料格式錯誤。',400);
      const {action}=body;
      if(!['health','login','logout','submit','stats','prepareClear','clear'].includes(action))return fail('未知操作。',400);
      if(action==='health')return json({ok:true,configured:true});
      // Persistent atomic limits. Global limits also resist spoofed IP headers.
      const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,128);
      const ipHash=await keyedHash(config.INDEX_HASH_KEY,'ip:'+ip);
      if(action==='login'){
        // Public registration session: this token is not proof of identity or admin access.
        if(!await db.rate('login:global',60,60)||!await db.rate('login:'+ipHash,12,900))return fail('嘗試次數過多，請稍後再試。',429);
        const token=randomToken(),expiresAt=await db.sessionCreate(await sha256(token));
        return json({ok:true,token,expiresAt});
      }
      const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization')||'');
      if(!match)return fail('連線狀態無效，請再試一次。',401);
      const sessionHash=await sha256(match[1]);
      if(!await db.sessionValid(sessionHash))return fail('連線已逾時，請再試一次。',401);
      if(action==='logout'){await db.sessionDelete(sessionHash);return json({ok:true});}
      if(!await db.rate('session:'+sessionHash,120,60))return fail('操作過於頻繁，請稍後再試。',429);
      if(action==='submit'){
        const record=validateRecord(body.record),hash=await keyedHash(config.INDEX_HASH_KEY,'id:'+record.idno);
        const encrypted=await encryptRecord(config.DATA_ENCRYPTION_KEY,record,hash),result=await db.upsert(hash,encrypted);
        return json({ok:true,updated:result.updated});
      }
      // Verify the independent password on EVERY stats or destructive request.
      if(!await db.rate('stats:global',60,60)||!await db.rate('stats:ip:'+ipHash,12,900)||!await db.rate('stats:'+sessionHash,12,900))return fail('統計表嘗試次數過多，請稍後再試。',429);
      if(!await secureEqual(body.statsPassword,config.STATS_PASSWORD))return fail('統計表密碼不正確。',403);
      if(action==='stats'){
        const rows=await db.stats(),records=[];
        for(const row of rows)records.push(await decryptRecord(config.DATA_ENCRYPTION_KEY,row));
        return json({ok:true,records});
      }
      if(action==='prepareClear'){
        const token=randomToken(),count=await db.prepareClear(await sha256(token));
        return json({ok:true,confirmationToken:token,count});
      }
      if(typeof body.confirmationToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.confirmationToken))return fail('請重新確認清除操作。',400);
      const result=await db.clear(await sha256(body.confirmationToken));
      if(!result.ok)return fail('確認已失效或資料已有更新，請重新查看統計表。',409);
      return json({ok:true,deleted:result.deleted});
    }catch(error){
      if(error instanceof InputError)return fail(error.message,400);
      // Never log exceptions that might contain personal data.
      return fail('服務暫時無法完成，請稍後再試或聯絡管理者。',503);
    }
  };
}
