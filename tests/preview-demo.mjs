import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fixture} from './fixture.mjs';
const f=await fixture(),root=resolve(import.meta.dirname,'../dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.jpg':'image/jpeg'};
createServer(async(req,res)=>{
  try{
    if(req.url==='/api'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const response=await f.handler(new Request('http://127.0.0.1:4173/api',{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.url==='/config.js'){
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
      res.end('window.BUSAN_INSURANCE_CONFIG={apiUrl:"http://127.0.0.1:4173/api"};');return;
    }
    const pathname=new URL(req.url,'http://localhost').pathname;
    const path=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(root+sep))throw new Error();
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Isolated test preview ready on http://127.0.0.1:4173 (in-memory PostgreSQL; no live data).'));

