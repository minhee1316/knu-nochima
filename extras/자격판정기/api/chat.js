// 곰두리 에이전트 (/api/chat): 화면이 보낸 대화를 Gemini에 넘기고, Gemini가 고른 "도구 호출" 또는 답장을 돌려준다.
// 도구는 화면(브라우저)이 실행한다 — 공지 목록·내 조건이 브라우저에 있기 때문. 서버는 키 보관·검증·호출 제한만 한다.
// 흐름: 화면 → (대화) → 서버 → Gemini → functionCall → 화면이 실행 → functionResponse를 붙여 다시 → … → 글 답장
import { TOOL_DECLS, systemPrompt, toOpenAITools, toOpenAIMessages, fromOpenAIMessage } from '../lib/gomduri.js';
import { limit, tooMany, reqIp } from '../lib/ratelimit.js';

const NAMES = new Set(TOOL_DECLS.map(t => t.name));
const MAX_TURNS = 30, MAX_TEXT = 1500, MAX_JSON = 6000;

const rules = env => [
  { name: 'ch-m', max: 15, sec: 60, msg: s => `곰두리가 숨 좀 고를게요 🐻 ${s}초 뒤에 다시 말해 주세요.` },
  { name: 'ch-d', max: 200, sec: 86400, msg: () => '오늘 곰두리와 대화할 수 있는 횟수를 다 썼어요. 내일 또 만나요!' },
  { name: 'ch-all', max: Number(env.GEMINI_DAILY_CAP) || 500, sec: 86400, global: true, msg: () => '오늘 서비스 전체 AI 사용량이 다 찼어요. 곰두리는 간단한 규칙 모드로 도와드릴게요.' }
];

// 화면이 보낸 대화는 믿지 않는다: 허용된 모양·길이만 통과
export function cleanContents(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_TURNS) return null;
  const out = [];
  for (const c of raw) {
    if (!c || !['user', 'model'].includes(c.role) || !Array.isArray(c.parts) || !c.parts.length || c.parts.length > 8) return null;
    const parts = [];
    for (const p of c.parts) {
      const q = {};
      if (typeof p.text === 'string') q.text = p.text.slice(0, MAX_TEXT);
      else if (p.functionCall && NAMES.has(p.functionCall.name) && c.role === 'model') q.functionCall = { name: p.functionCall.name, args: p.functionCall.args && typeof p.functionCall.args === 'object' ? p.functionCall.args : {}, ...(typeof p.functionCall.id === 'string' ? { id: p.functionCall.id.slice(0, 80) } : {}) };
      else if (p.functionResponse && NAMES.has(p.functionResponse.name) && c.role === 'user') q.functionResponse = { name: p.functionResponse.name, response: p.functionResponse.response && typeof p.functionResponse.response === 'object' ? p.functionResponse.response : {}, ...(typeof p.functionResponse.id === 'string' ? { id: p.functionResponse.id.slice(0, 80) } : {}) };
      else return null;
      if (typeof p.thoughtSignature === 'string' && p.thoughtSignature.length < 20000) q.thoughtSignature = p.thoughtSignature; // 일부 모델은 도구 호출 서명을 되돌려 받아야 함
      parts.push(q);
    }
    out.push({ role: c.role, parts });
  }
  return out[0].role === 'user' && JSON.stringify(out).length < MAX_JSON * 12 ? out : null; // 도구 결과까지 합쳐 약 70KB 이하
}

export async function chat(body, env, method, ip) {
  if (method !== 'POST') return { status: 405, json: { error: 'POST만 지원합니다.' } };
  const key = env.GEMINI_API_KEY;
  if (!key && !env.OPENAI_API_KEY) return { status: 503, json: { error: 'AI 키가 없어 규칙 모드로 동작해요.', fallback: true } };
  const contents = cleanContents(body?.contents);
  if (!contents) return { status: 400, json: { error: '대화 형식이 올바르지 않아요.' } };
  const l = await limit(env, ip, rules(env));
  if (!l.ok) return { ...tooMany(l), json: { ...tooMany(l).json, fallback: true } };
  if (env.OPENAI_API_KEY) return openaiChat(contents, env); // OpenAI 키가 있으면 ChatGPT, 없으면 아래 Gemini

  // 무료 모델은 자주 "사용량 많음(503)"이 난다 → 차례로 다른 모델을 시도. 도구 호출을 잘 지키는 모델을 앞에 둔다(2026-11 확인).
  // 한 턴 안에서 도구 결과를 돌려줄 때는 서명(thoughtSignature)을 만든 같은 모델을 먼저 쓴다(body.model).
  const MODELS = String(env.GEMINI_CHAT_MODELS || 'gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-latest').split(',').map(s => s.trim()).filter(Boolean);
  // 도구 결과를 돌려주는 중(서명 있음)엔 다른 모델이 400을 내므로 같은 모델을 잠깐 쉬었다 다시 부른다
  const signed = JSON.stringify(contents).includes('thoughtSignature');
  // 같은 모델로 3번(1.5·3초 쉬고) → 그래도 안 되면 다른 모델 (서명은 Google 문서의 대체값으로 바꿔 보냄)
  const order = signed && body?.model ? [body.model, body.model, body.model, ...MODELS.filter(m => m !== body.model)] : MODELS.includes(body?.model) ? [body.model, ...MODELS.filter(m => m !== body.model)] : MODELS;
  const started = Date.now();
  let resp, model, last = 0;
  for (const [i, m] of order.entries()) {
    model = m;
    if (Date.now() - started > 20000) break;
    if (signed && i && i < 3) await new Promise(r => setTimeout(r, 1500 * i));
    try {
      resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)) }] }, // 한국 날짜
          contents: model === order[0] ? contents : contents.map(c => ({ ...c, parts: c.parts.map(({ thoughtSignature, ...q }) => q.functionCall ? { ...q, thoughtSignature: 'skip_thought_signature_validator' } : q) })), // 다른 모델의 서명은 대체값으로
          tools: [{ functionDeclarations: TOOL_DECLS }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
        }),
        signal: AbortSignal.timeout(12000)
      });
      if (resp.ok) break;
      last = resp.status;
      if (![429, 500, 503, 404].includes(resp.status) && !(resp.status === 400 && model !== order[order.length - 1])) break; // 요청 자체가 잘못된 경우(400 등)는 다른 모델도 같음
    } catch { last = 504; }
    resp = null;
  }
  if (!resp?.ok) return { status: 502, json: { error: last === 429 ? 'AI 무료 한도가 잠시 찼어요.' : last === 504 ? 'AI 응답이 늦어요.' : `AI 호출 실패 (${last})`, fallback: true } };

  const data = await resp.json();
  const parts = (data?.candidates?.[0]?.content?.parts || [])
    .filter(p => typeof p.text === 'string' || (p.functionCall && NAMES.has(p.functionCall.name)))
    .map(p => ({ ...(p.text != null ? { text: p.text } : { functionCall: { name: p.functionCall.name, args: p.functionCall.args || {}, ...(p.functionCall.id ? { id: p.functionCall.id } : {}) } }), ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}) }))
    .filter(p => p.functionCall || p.text.trim());
  if (!parts.length) return { status: 502, json: { error: 'AI가 빈 답을 보냈어요. 다시 말해 주세요.', fallback: true } };
  return { status: 200, json: { content: { role: 'model', parts }, model } };
}

// ChatGPT(OpenAI Chat Completions): 대화·도구는 Gemini 모양 그대로 받아 변환해서 보내고, 답장도 같은 모양으로 돌려준다
export async function openaiChat(contents, env, doFetch = fetch) {
  const model = env.OPENAI_MODEL || 'gpt-4o-mini', names = new Set(TOOL_DECLS.map(t => t.name));
  let resp, last = 0;
  for (let i = 0; i < 2; i++) { // 사용량 많음(429·5xx)이면 한 번만 다시
    if (i) await new Promise(r => setTimeout(r, 1500));
    try {
      resp = await doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: toOpenAIMessages(systemPrompt(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)), contents),
          tools: toOpenAITools(TOOL_DECLS), tool_choice: 'auto', max_completion_tokens: 800 }),
        signal: AbortSignal.timeout(20000)
      });
      if (resp.ok || ![429, 500, 502, 503].includes(resp.status)) break;
      last = resp.status;
    } catch { last = 504; resp = null; }
  }
  if (!resp?.ok) {
    const st = resp?.status || last;
    const why = st === 401 ? 'OpenAI 키가 올바르지 않아요' : st === 404 ? `모델 "${model}"을 쓸 수 없어요. OPENAI_MODEL을 확인하세요` : st === 429 ? 'OpenAI 사용 한도·결제를 확인하세요' : `OpenAI 호출 실패 (${st})`;
    return { status: 502, json: { error: why, fallback: true } };
  }
  const parts = fromOpenAIMessage((await resp.json())?.choices?.[0]?.message, names);
  if (!parts.length) return { status: 502, json: { error: 'AI가 빈 답을 보냈어요. 다시 말해 주세요.', fallback: true } };
  return { status: 200, json: { content: { role: 'model', parts }, model } };
}

// Vercel 진입점
export default async function handler(req, res) {
  const r = await chat(req.body, process.env, req.method, reqIp(req));
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
  res.status(r.status).json(r.json);
}
