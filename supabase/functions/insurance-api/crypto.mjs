const encoder=new TextEncoder();
export const toB64=bytes=>btoa(String.fromCharCode(...bytes));
export const fromB64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export const randomToken=()=>toB64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function sha256(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function secureEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!b)return false;
  const [ha,hb]=await Promise.all([sha256(a),sha256(b)]);let diff=0;
  for(let i=0;i<ha.length;i++)diff|=ha.charCodeAt(i)^hb.charCodeAt(i);
  return diff===0;
}
export function keyBytes(value){const raw=fromB64(value);if(raw.length!==32)throw new Error('Invalid key configuration');return raw;}
export async function keyedHash(key,value){
  const imported=await crypto.subtle.importKey('raw',keyBytes(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',imported,encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function encryptRecord(key,record,idHash){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const imported=await crypto.subtle.importKey('raw',keyBytes(key),'AES-GCM',false,['encrypt']);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('busan:v1:'+idHash)},imported,encoder.encode(JSON.stringify(record)));
  return {payload_ciphertext:toB64(new Uint8Array(bytes)),payload_iv:toB64(iv),key_version:1};
}
export async function decryptRecord(key,row){
  if(row.key_version!==1)throw new Error('Unsupported encryption version');
  const imported=await crypto.subtle.importKey('raw',keyBytes(key),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(row.payload_iv),additionalData:encoder.encode('busan:v1:'+row.idno_hash)},imported,fromB64(row.payload_ciphertext));
  return {...JSON.parse(new TextDecoder().decode(plain)),updatedAt:row.updated_at};
}
