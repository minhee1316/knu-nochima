const SKEY='knu-elig-session';let SESSION=null;
try{localStorage.removeItem(SKEY)}catch{}
const online='https://knu-esungan-preview-20261105.hydroai4.chatgpt.site';
const disk=location.protocol==='file:';
function paintAcct(){
  $('#acct').innerHTML=SESSION?'<span class="who-me"></span><button type="button" id="logout-btn">로그아웃</button>':'<a href="#login">로그인</a><a href="#signup">회원가입</a>';
  if(SESSION){$('#acct .who-me').textContent=(SESSION.user.nickname||SESSION.user.email)+' 님';$('#logout-btn').onclick=signOut;}
  $('#privacy').textContent=SESSION?'계정 저장 버튼을 누르면 현재 학사정보와 관심 분야를 다른 기기에서도 불러올 수 있어요.':'입력한 조건은 이 브라우저에 저장됩니다. 계정에 보관할 때는 직접 저장을 눌러 주세요.';
  $('#wb-save-account').hidden=!SESSION;
  if(disk)$('#acct').querySelectorAll('a').forEach(a=>a.href=online+'/'+a.hash);
}
async function api(path,method='GET',body){
  const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const j=await r.json();if(!r.ok)throw Error(j.error||'서버 요청을 마치지 못했습니다.');return j;
}
const userShape=u=>({email:u.username,nickname:'',role:'회원'});
async function loadMember(){
  if(!SESSION)return;
  const session=SESSION,initial={...profile};
  const {conditions:p}=await api('conditions');
  if(!p||SESSION!==session)return;
  const restored=readConditions(p);
  for(const k of Object.keys(EMPTY)){
    if(JSON.stringify(initial[k])!==JSON.stringify(profile[k]))restored[k]=profile[k];
  }
  profile=restored;SESSION.user.nickname=p.nickname||'';SESSION.user.role=p.role||'회원';
  save();syncForm();syncInterests();render();paintAcct();
}
async function signOut(){
  try{await api('auth/logout','POST');SESSION=null;profile={...EMPTY,interests:[]};save();syncForm();syncInterests();render();paintAcct();acRoute();toast('로그아웃했어요. 이 기기의 내 조건도 지웠어요.');}
  catch(e){toast(e.message);}
}
$('#wb-save-account').onclick=async()=>{try{await api('conditions','PUT',{...profile,role:SESSION.user.role,nickname:SESSION.user.nickname});toast('계정에 현재 조건을 저장했어요.');}catch(e){toast(e.message);}};
paintAcct();
if(!disk)api('auth/me').then(async j=>{if(j.user){SESSION={user:userShape(j.user)};paintAcct();await loadMember();acRoute();}}).catch(()=>{});

