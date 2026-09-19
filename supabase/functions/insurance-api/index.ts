import {createHandler} from './handler.mjs';
import {createDatabase} from './db.mjs';
const config=Object.fromEntries([
  'SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
  'STATS_PASSWORD','DATA_ENCRYPTION_KEY','INDEX_HASH_KEY','ALLOWED_ORIGINS',
].map(name=>[name,Deno.env.get(name)??'']));
// Public registration sessions and independent stats authentication in handler.mjs.
Deno.serve(createHandler(config,createDatabase(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY)));
