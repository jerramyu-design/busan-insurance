import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const path=new URL('../.env.local',import.meta.url);
await writeFile(path,[
'COMPANY_ACCESS_CODE=','STATS_PASSWORD=',
'DATA_ENCRYPTION_KEY='+randomBytes(32).toString('base64'),
'INDEX_HASH_KEY='+randomBytes(32).toString('base64'),
'ALLOWED_ORIGINS=','',
].join('\n'),{flag:'wx',mode:0o600});
console.log('Created ignored .env.local. Fill both passwords and the exact website origin locally; never commit this file. Back up both keys securely.');
