// 더블클릭으로 열리는 단독 HTML 만들기: 공지 데이터(data/notices.json)와 lib 모듈을 파일 안에 넣는다.
// 서버 기능(계정)은 빠지고, 목록·판정·검색은 그대로 동작한다.
// 실행: node scripts/export-standalone.mjs [저장 경로] [--no-key]
// 기본: .env의 GEMINI_API_KEY를 파일에 넣어, 받은 사람 누구나 곰두리 AI를 쓰게 한다(사용자 요청 2026-11-06).
//   주의: 파일을 연 사람은 '소스 보기'로 키를 볼 수 있다. 공유용으로 키를 빼려면 --no-key.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = p => fileURLToPath(new URL(p, import.meta.url));
const out = process.argv.slice(2).find(a => !a.startsWith('--')) || file('../dist/KNU_놓치지마.html');
let key = '';
if (!process.argv.includes('--no-key')) { try { key = ((await readFile(file('../.env'), 'utf8')).match(/^GEMINI_API_KEY=(.*)$/m)?.[1] || '').trim(); } catch { /* .env 없음 */ } }

const strip = src => src.replace(/^import .*$/gm, '').replace(/^export (const|function|async function) /gm, '$1 ');
const libs = (await Promise.all(['tags', 'gomduri'].map(n => readFile(file(`../lib/${n}.js`), 'utf8')))).map(strip).join('\n');
const inline = `<script type="module">
${libs}
window.GOM={TOOL_DECLS,systemPrompt,careerPlan,CAREER_LINKS,toOpenAITools,toOpenAIMessages,fromOpenAIMessage,cleanPatch,searchNotices,searchSmart,brief,makePlan,draftInquiry,digest,campusLink,noticeQA,applicationOutline,compareWhatIf,roadmap,extractProfile,recommend,counselReport,perksOf,parseLocal,replyLocal};
window.initTags(TAGS);
</script>`;

const data = JSON.parse(await readFile(file('../data/notices.json'), 'utf8'));
const embed = `<script>window.EMBED=${JSON.stringify(data).replace(/</g, '\\u003c')};${key ? `window.GD_KEY=${JSON.stringify(key)};` : ''}</script>`;

let html = await readFile(file('../index.html'), 'utf8');
const mod = /<script type="module">[\s\S]*?<\/script>/;
if (!mod.test(html)) throw new Error('index.html에서 모듈 스크립트를 찾지 못했습니다');
html = html.replace(mod, m => inline.replace('</script>', m.replace(/^<script type="module">/, '').replace(/^import .*$/gm, '').replace(/^window\.GOM=GOM;window\.initTags\(TAGS\);$/m, ''))).replace('<script>\n// ===== 옵션 =====', () => embed + '\n<script>\n// ===== 옵션 =====');
if (!html.includes('window.EMBED=')) throw new Error('데이터를 넣을 위치를 찾지 못했습니다');
await writeFile(out, html);
// 바탕화면 "놓치지마_발표자료" 폴더가 있으면 그 안의 HTML도 같이 갱신한다 (예전 "놓치지마" 폴더는 사용자가 정리함)
try {
  const folder = 'C:/Users/user/Desktop/놓치지마_발표자료';
  if (out.replace(/\\/g, '/') !== `${folder}/KNU_놓치지마.html`) { await writeFile(`${folder}/KNU_놓치지마.html`, html); console.log('바탕화면 놓치지마_발표자료 폴더도 갱신'); }
} catch { /* 폴더 없음 */ }
console.log(`저장: ${out} (${(html.length / 1024).toFixed(0)}KB, 공지 ${data.notices.length}건, AI 분석 ${data.analyzed}건, 곰두리 AI 키 ${key ? '포함' : '없음'})`);
