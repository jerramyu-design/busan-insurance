import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
test('All eleven original images are byte-for-byte unchanged and all prices preserve original text',async()=>{
  const manifest=JSON.parse(await readFile(new URL('tests/original-manifest.json',root),'utf8'));
  assert.equal(Object.keys(manifest.hashes).length,11);
  for(const [name,hash] of Object.entries(manifest.hashes)){
    assert.equal(createHash('sha256').update(await readFile(new URL('assets/'+name,root))).digest('hex'),hash);
  }
  const html=await readFile(new URL('index.html',root),'utf8');
  const pricing=[...html.matchAll(/<table class="price-table">([\s\S]*?)<\/table>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').replace(/\s/g,''));
  assert.deepEqual(pricing,manifest.pricing);
  assert.match(html,/src="assets\/inconvenience_full.jpg"/);
  for(const name of Object.keys(manifest.hashes))assert.ok(html.includes('assets/'+name));
});
test('Production build excludes backend, credentials, database and tests',async()=>{
  const files=await readdir(new URL('dist/',root));
  assert.deepEqual(files.sort(),['.nojekyll','_headers','app.js','assets','config.js','domain.mjs','index.html'].sort());
  for(const file of files.filter(n=>/\.(js|mjs|html)$/.test(n))){
    const text=await readFile(new URL('dist/'+file,root),'utf8');
    assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|DATA_ENCRYPTION_KEY|INDEX_HASH_KEY|localStorage|sessionStorage/);
  }
});
