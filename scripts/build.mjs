import {mkdir,copyFile,cp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
if(dist!==join(root,'dist'))throw new Error('Unsafe build path');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','app.js'])await copyFile(join(root,file),join(dist,file));
await copyFile(join(root,'supabase/functions/insurance-api/domain.mjs'),join(dist,'domain.mjs'));
await cp(join(root,'assets'),join(dist,'assets'),{recursive:true});
let config=await readFile(join(root,'config.js'),'utf8');
if(process.env.BUSAN_API_URL){
  const url=new URL(process.env.BUSAN_API_URL);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!='/functions/v1/insurance-api'||url.search||url.hash)throw new Error('Invalid Supabase function URL');
  config='window.BUSAN_INSURANCE_CONFIG = '+JSON.stringify({apiUrl:url.href})+';\n';
}
if(process.argv.includes('--production')&&config.includes('PASTE_FUNCTION_URL_HERE'))throw new Error('Set BUSAN_API_URL before production build');
await writeFile(join(dist,'config.js'),config);
await writeFile(join(dist,'_headers'),"/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n");
await writeFile(join(dist,'.nojekyll'),'');
console.log('Static website built in dist/. '+(config.includes('PASTE_FUNCTION_URL_HERE')?'API is not configured yet.':'API configured.'));
