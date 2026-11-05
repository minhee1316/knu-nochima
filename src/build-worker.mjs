import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const files = {
  '/index.html': 'text/html; charset=utf-8',
  '/styles.css': 'text/css; charset=utf-8',
  '/profile.css': 'text/css; charset=utf-8',
  '/match.css': 'text/css; charset=utf-8',
  '/audience.css': 'text/css; charset=utf-8',
  '/design.css': 'text/css; charset=utf-8',
  '/app.js': 'text/javascript; charset=utf-8',
  '/auth.js': 'text/javascript; charset=utf-8',
  '/profile.js': 'text/javascript; charset=utf-8',
  '/match.mjs': 'text/javascript; charset=utf-8',
  '/feed.mjs': 'text/javascript; charset=utf-8',
  '/notices.json': 'application/json; charset=utf-8',
  '/events.json': 'application/json; charset=utf-8'
};
// The downloadable HTML and the online Worker use the same embedded client.
const indexPath = resolve(root,'dist/index.html');
const index = await readFile(indexPath,'utf8');
let embedded=index;
for(const [id,file] of [['kosaf-client','scholarship-ui.js'],['startup-client','startup-ui.js'],['work24-client','work24-ui.js'],['gov24-client','gov24-ui.js'],['qnet-client','qnet-ui.js'],['gom-search','ai/gom-semantic.js'],['gom-assist','ai/gom-assist.js']]){
  const marker=new RegExp('<script id="'+id+'">[\\s\\S]*?</script>');
  if(!marker.test(embedded))throw Error(id+' entry missing');
  const client=await readFile(resolve(root,'src',file),'utf8');
  embedded=embedded.replace(marker,()=>'<script id="'+id+'">\n'+client.trim()+'\n</script>');
}
const model=await readFile(resolve(root,'src/ai/gom-ko.json'),'utf8');
embedded=embedded.replace(/<script type="application\/json" id="gom-model">[\s\S]*?<\/script>/,()=>'<script type="application/json" id="gom-model">'+model.replace(/</g,'\\u003c')+'</script>');
const subjects=await readFile(resolve(root,'data/qnet-subjects.json'),'utf8');
embedded=embedded.replace(/<script type="application\/json" id="qnet-subjects">[\s\S]*?<\/script>/,()=>'<script type="application/json" id="qnet-subjects">'+subjects.trim().replace(/</g,'\\u003c')+'</script>');
const conversation=await readFile(resolve(root,'src/gom-conversation.js'),'utf8');
const conversationBlock=/\(function conversation\(\)\{[\s\S]*?window\.gomConversation=\{[^\n]*\n\}\)\(\);/;
if(!conversationBlock.test(embedded))throw Error('Missing conversation source');
embedded=embedded.replace(conversationBlock,()=>conversation.trim());
if(embedded!==index)await writeFile(indexPath,embedded,'utf8');
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([path, type]) =>
  [path, { type, body: await readFile(resolve(root, 'dist', path.slice(1)), 'utf8') }]
)));
const parser = (await readFile(resolve(root, 'src/live-feed.mjs'), 'utf8')).replaceAll('export function ', 'function ');
const auth = await readFile(resolve(root, 'worker/auth.mjs'), 'utf8');
const conditions = await readFile(resolve(root, 'worker/conditions.mjs'), 'utf8');
const scholarships = (await readFile(resolve(root,'worker/scholarships.mjs'),'utf8')).replace(/^export /gm,'');
const startups = (await readFile(resolve(root,'worker/startups.mjs'),'utf8')).replace(/^export /gm,'');
const work24=(await readFile(resolve(root,'worker/work24.mjs'),'utf8')).replace(/^export /gm,'');
const gov24=(await readFile(resolve(root,'worker/gov24.mjs'),'utf8')).replace(/^export /gm,'');
const welfare=await build({entryPoints:[resolve(root,'worker/bokjiro.mjs')],bundle:true,platform:'browser',format:'iife',globalName:'Bokjiro',target:'es2022',write:false});
const exam=await build({entryPoints:[resolve(root,'worker/qnet.mjs')],bundle:true,platform:'browser',format:'iife',globalName:'Qnet',target:'es2022',write:false});
const gomAi = (await readFile(resolve(root,'worker/gom-ai.mjs'),'utf8')).replace(/^export /gm,'');
const worker = await readFile(resolve(root, 'worker/index.mjs'), 'utf8');
await mkdir(resolve(root, 'dist/server'), { recursive: true });
await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await writeFile(resolve(root, 'dist/server/index.js'), `const STATIC_ASSETS = ${JSON.stringify(assets)};\n${parser}\n${auth}\n${conditions}\n${scholarships}\n${startups}\n${work24}\n${gov24}\n${welfare.outputFiles[0].text}\n${exam.outputFiles[0].text}\n${gomAi}\n${worker}`, 'utf8');
await writeFile(resolve(root, 'dist/.openai/hosting.json'), await readFile(resolve(root, '.openai/hosting.json'), 'utf8'));
console.log('Worker package ready');
