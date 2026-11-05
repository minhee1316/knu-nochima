// AI 정확도 확인표: AI 분석 공지 20건을 골라, 사람이 원문과 대조해 맞음/틀림을 표시하는 HTML을 만든다.
// 실행: node scripts/accuracy-sheet.mjs [저장 경로] [개수=20]
// 표시 결과는 그 브라우저에 저장되고, 위쪽에 정확도(%)가 자동 계산되며 CSV로 내려받을 수 있다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { guessDeadline } from './knu.mjs';

const file = p => fileURLToPath(new URL(p, import.meta.url));
const OUT = process.argv[2] || file('../../KNU_자격판정기_AI정확도_확인표.html');
const COUNT = Number(process.argv[3]) || 20;
const data = JSON.parse(await readFile(file('../data/notices.json'), 'utf8'));
const raw = JSON.parse(await readFile(file('../data/raw.json'), 'utf8'));
const rule = new Map(raw.items.map(i => [`${i.board.id}-${i.row.sn}`, guessDeadline(i.row.title + '\n' + i.det.body, i.row.posted)]));

// 같은 데이터면 항상 같은 20건이 뽑히도록 id 해시로 정렬(무작위처럼 고르되 재현 가능)
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pool = data.notices.filter(n => !n.aiPending && n.kind !== 'event' && !n.imageOnly).sort((a, b) => h(a.id) - h(b.id)).slice(0, COUNT);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const condTxt = c => Object.entries({ campus: '캠퍼스', grade: '학년', college: '계열', residence: '거주', status: '국적', minGpa: '평점', maxIncome: '소득구간' })
  .map(([k, l]) => c[k] == null ? null : `${l}: ${c[k] === 'unknown' ? '원문 확인 필요' : Array.isArray(c[k]) ? c[k].join('·') : c[k]}`).filter(Boolean).join(' / ') || '제한 없음';

const rows = pool.map((n, i) => {
  const r = rule.get(n.id) || '';
  return `<tr data-id="${esc(n.id)}"><td>${i + 1}</td><td><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><small>${esc(n.source)} · ${esc(n.posted)}</small></td>
<td><b>${esc(n.deadline || '없음')}</b>${r && r !== n.deadline ? `<small class="d">규칙: ${esc(r)}</small>` : ''}</td><td>${esc(condTxt(n.cond))}</td><td class="sm">${esc(n.summary).replace(/\n/g, '<br>')}</td>
${['dl', 'cond', 'sum'].map(k => `<td class="pick" data-k="${k}"><label><input type="radio" name="${k}${i}" value="o"> 맞음</label><label><input type="radio" name="${k}${i}" value="x"> 틀림</label><label><input type="radio" name="${k}${i}" value="na"> 판단불가</label></td>`).join('')}
<td><input class="memo" aria-label="${i + 1}번 메모" placeholder="메모"></td></tr>`;
}).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 정확도 확인표</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2.0.5/fonts/static/woff2/SUIT.css">
<style>:root{font-family:SUIT,'Malgun Gothic',sans-serif;color:#141414}body{margin:0;background:#F4F5F6}header{background:#001546;color:#fff;padding:26px 28px}h1{margin:0 0 6px;font-size:26px}header p{margin:0;color:#C9D3EA;font-size:14px}
.score{display:flex;gap:22px;flex-wrap:wrap;padding:16px 28px;background:#fff;border-bottom:2px solid #141414;position:sticky;top:0;z-index:2}.score div{font-size:14px;color:#4E5359}.score b{display:block;font-size:26px;color:#3F60A9}
.score button{margin-left:auto;height:40px;padding:0 18px;border-radius:40px;border:0;background:#3F60A9;color:#fff;font-weight:700;cursor:pointer}
.wrap{padding:16px 28px 60px;overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:1300px;background:#fff;font-size:13.5px}th,td{border:1px solid #DCDEE2;padding:8px;vertical-align:top;text-align:left}th{background:#ECEFF6;font-size:13px}
td small{display:block;color:#646B73;font-size:12px;margin-top:3px}small.d{color:#A15C00;font-weight:700}.sm{color:#4E5359;min-width:220px}.pick label{display:block;white-space:nowrap}.memo{width:120px;border:1px solid #D1D5DB;padding:4px}
.howto{margin:0 28px;padding:12px 16px;background:#FFF3DF;color:#6B3D00;font-size:14px}</style></head><body>
<header><h1>AI 정확도 확인표 (${pool.length}건)</h1><p>${esc(data.collectedAt.slice(0, 10))} 수집 · AI 분석 ${data.analyzed}/${data.notices.length}건 중 재현 가능한 방식으로 ${pool.length}건 선택 · 제목을 눌러 원문과 대조하세요</p></header>
<div class="score" aria-live="polite"><div>마감일 정확도<b id="s-dl">-</b></div><div>자격 조건 정확도<b id="s-cond">-</b></div><div>요약 정확도<b id="s-sum">-</b></div><div>확인한 칸<b id="s-n">0/${pool.length * 3}</b></div><button type="button" id="csv">CSV로 내려받기</button></div>
<p class="howto">기준: <b>마감일</b>은 신청 마감 날짜가 원문과 같으면 맞음. <b>자격 조건</b>은 캠퍼스·학년·평점·소득 등이 원문과 어긋나지 않으면 맞음("원문 확인 필요"는 원문에도 불명확하면 맞음). <b>요약</b>은 대상·혜택·신청 내용에 원문에 없는 말이 없으면 맞음. 판단불가는 정확도 계산에서 뺍니다.</p>
<div class="wrap"><table><thead><tr><th>#</th><th>공지 (원문 링크)</th><th>AI 마감일</th><th>AI 자격 조건</th><th>AI 요약 (대상/혜택/신청)</th><th>마감일</th><th>자격 조건</th><th>요약</th><th>메모</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<script>
const KEY='knu-acc-${esc(data.collectedAt)}';let st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
document.querySelectorAll('tbody tr').forEach((tr,i)=>{const s=st[tr.dataset.id]||{};['dl','cond','sum'].forEach(k=>{if(s[k]){const r=tr.querySelector('input[name='+k+i+'][value='+s[k]+']');if(r)r.checked=true;}});tr.querySelector('.memo').value=s.memo||'';});
function calc(){const t={dl:[0,0],cond:[0,0],sum:[0,0]};let n=0;st={};
 document.querySelectorAll('tbody tr').forEach((tr,i)=>{const s={};['dl','cond','sum'].forEach(k=>{const c=tr.querySelector('input[name='+k+i+']:checked');if(c){s[k]=c.value;n++;if(c.value!=='na'){t[k][1]++;if(c.value==='o')t[k][0]++;}}});s.memo=tr.querySelector('.memo').value;st[tr.dataset.id]=s;});
 ['dl','cond','sum'].forEach(k=>document.getElementById('s-'+k).textContent=t[k][1]?Math.round(t[k][0]/t[k][1]*100)+'% ('+t[k][0]+'/'+t[k][1]+')':'-');
 document.getElementById('s-n').textContent=n+'/${pool.length * 3}';try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}
document.addEventListener('change',calc);document.addEventListener('input',e=>{if(e.target.classList.contains('memo'))calc();});calc();
document.getElementById('csv').onclick=()=>{const L=['번호,공지,AI마감일,마감일,자격조건,요약,메모'];
 document.querySelectorAll('tbody tr').forEach((tr,i)=>{const s=st[tr.dataset.id]||{};const q=v=>'"'+String(v||'').replace(/"/g,'""')+'"';L.push([i+1,q(tr.querySelector('a').textContent),q(tr.cells[2].querySelector('b').textContent),s.dl||'',s.cond||'',s.sum||'',q(s.memo)].join(','));});
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+L.join('\\n')],{type:'text/csv'}));a.download='AI정확도_확인결과.csv';a.click();};
</script></body></html>`;
await writeFile(OUT, html);
console.log(`저장: ${OUT} (${pool.length}건)`);
