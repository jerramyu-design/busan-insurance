export function createDatabase(url,secret,fetcher=fetch){
  async function rpc(name,args={}){
    const response=await fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Database request failed');
    return response.json();
  }
  return {
    rate:(bucket,limit,seconds)=>rpc('insurance_rate_limit',{p_bucket:bucket,p_limit:limit,p_seconds:seconds}),
    sessionCreate:hash=>rpc('insurance_session_create',{p_hash:hash}),
    sessionValid:hash=>rpc('insurance_session_valid',{p_hash:hash}),
    sessionDelete:hash=>rpc('insurance_session_delete',{p_hash:hash}),
    upsert:(hash,row)=>rpc('insurance_upsert',{p_hash:hash,p_ciphertext:row.payload_ciphertext,p_iv:row.payload_iv,p_version:row.key_version}),
    stats:()=>rpc('insurance_stats_snapshot'),
    prepareClear:hash=>rpc('insurance_prepare_clear',{p_hash:hash}),
    clear:hash=>rpc('insurance_clear',{p_hash:hash}),
  };
}
