async function handleConditions(request, env) {
  if (new URL(request.url).pathname !== '/api/conditions') return null;
  if (!env.DB) return apiJson({ error: '계정 저장소에 연결할 수 없습니다.' }, 503);
  const user = await currentAccount(request, env.DB);
  if (!user) return apiJson({error:'로그인이 필요합니다.'}, 401);
  const row = await env.DB.prepare('SELECT data_json FROM profiles WHERE account_id = ?').bind(user.id).first();
  const saved = row ? JSON.parse(row.data_json) : {};
  const accountRole=saved.accountRole||saved.conditions?.role||'학생';
  if (request.method === 'GET') {
    const legacy = row ? {campus:saved.campus,grade:saved.year,gpa:saved.lastGpa,income:saved.incomeBracket,academic:saved.status,program:saved.program,currentSemester:saved.currentSemester,major:saved.major,cumulativeGpa:saved.cumulativeGpa,earnedCredits:saved.earnedCredits,completedSemesters:saved.completedSemesters,lastCredits:saved.lastCredits,lastPercentile:saved.lastPercentile} : null;
    const conditions=saved.conditions||legacy;
    if(conditions){delete conditions.status;conditions.role=accountRole;if(accountRole==='학생')conditions.affiliation='';}
    return apiJson({conditions});
  }
  if (request.method !== 'PUT') return apiJson({error:'지원하지 않는 요청입니다.'},405);
  if (!validOrigin(request)) return apiJson({error:'요청 출처를 확인해 주세요.'},403);
  let body;
  try { body=await requestBody(request); } catch(e){return apiJson({error:e.message},400);}
  const conditions={};
  for(const key of ['campus','grade','gpa','income','academic','currentSemester','completedSemesters','lastCredits','lastPercentile','earnedCredits','cumulativeGpa','program','residence','college','major','courses','affiliation','role','nickname']){
    conditions[key]=String(body?.[key] ?? '').trim().slice(0,key==='courses'?300:80);
  }
  for(const [key,max] of Object.entries({gpa:4.5,cumulativeGpa:4.5,grade:6,income:10,lastPercentile:100,earnedCredits:400,lastCredits:40,completedSemesters:24,currentSemester:2})){
    const v=conditions[key];if(v && (!Number.isFinite(Number(v))||Number(v)<0||Number(v)>max)) return apiJson({error:'학사정보 입력 범위를 확인해 주세요.'},400);
  }
  conditions.role=accountRole;
  if(accountRole==='학생')conditions.affiliation='';
  conditions.interests=Array.isArray(body?.interests)?body.interests.slice(0,10).map(x=>String(x).slice(0,30)):[];
  const updated=new Date().toISOString();
  const next={...saved,accountRole,conditions,campus:conditions.campus,year:conditions.grade,lastGpa:conditions.gpa,incomeBracket:conditions.income,status:conditions.academic,gpaScale:'4.5'};
  for(const k of ['program','major','currentSemester','cumulativeGpa','earnedCredits','completedSemesters','lastCredits','lastPercentile']) next[k]=conditions[k];
  await env.DB.prepare('INSERT INTO profiles (account_id,data_json,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at').bind(user.id,JSON.stringify(next),updated).run();
  return apiJson({conditions});
}
