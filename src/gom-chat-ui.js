const SECRET_RE=/(?:AQ\.|AIza)[\w-]{20,}|\d{6}\s*-\s*[1-4]\d{6}|\b20\d{6,8}\b|비밀번호\s*(?:는|은|:|=)\s*\S+|\d{2,6}-\d{2,6}-\d{4,8}(?!\d)/;
function gdOpen(){
  $('#gd').hidden=false;$('#gd-open').hidden=true;
  if(!$('#gd-log').children.length)gdAdd('bot','안녕하세요, 곰두리예요! 찾고 싶은 장학금이나 행사를 편하게 물어보세요.\n예를 들어 “삼척 2학년이고 파이썬을 배웠어. 나에게 맞는 공모전 있어?”처럼요.');
  $('#gd-in').focus();
}
function gdClose(){$('#gd').hidden=true;$('#gd-open').hidden=false;$('#gd-open').focus();}
async function gdSend(raw){
  const text=String(raw||'').trim();if(!text||GD.busy)return;
  $('#gd-in').value='';
  if(SECRET_RE.test(text)){gdAdd('bot','학번·비밀번호·주민등록번호는 빼고 다시 적어 주세요.');return;}
  GD.busy=true;const btn=$('#gd-form button');btn.disabled=true;gdAdd('me',text);
  const wait=gdAdd('typing','자료를 확인하고 있어요…');
  try{await gomConversation.route(text);}
  catch{gdAdd('bot','질문을 처리하는 중에 문제가 생겼어요. 공지 제목이나 지역을 넣어 다시 물어보세요.');}
  finally{for(const row of document.querySelectorAll('#gd-log [data-gom-pending]')){row.style.display='';delete row.dataset.gomPending;}wait.remove();GD.busy=false;btn.disabled=false;$('#gd-log').scrollTop=$('#gd-log').scrollHeight;}
}
$('#gd-open').onclick=gdOpen;$('#gd-close').onclick=gdClose;
$('#gd').addEventListener('keydown',e=>{if(e.key==='Escape')gdClose();});
$('#gd-form').onsubmit=e=>{e.preventDefault();gdSend($('#gd-in').value);};
$('#gd').addEventListener('click',async e=>{
  const b=e.target.closest('[data-gd]');
  if(b){const n=gdFind(b.dataset.id);if(!n)return;
    gomConversation.state.focus=String(n.id);
    gomConversation.follow(n,({open_notice:'자세히',create_plan:'할 일 만들어줘',draft_inquiry:'문의 메일 초안'})[b.dataset.gd]||'자세히');return;}
  if(e.target.closest('[data-gd-copytext],[data-gd-copy]')){
    const ta=e.target.closest('.gd-draft')?.querySelector('textarea');if(!ta)return;
    try{await navigator.clipboard.writeText(ta.value);toast('초안을 복사했어요.');}
    catch{ta.focus();ta.select();toast('선택된 초안을 복사해 주세요.');}
  }
});
