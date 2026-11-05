  const release=async()=>{if(libs){try{await (await libs).terminate();}catch{} libs=null;}reading=false;};
  window.gomReadAttachments=async function(text){
    if(reading){gdAdd('bot','앞서 요청한 파일을 읽고 있어요.');return;}
    if(/내\s*(파일|포스터)|업로드|올리|올릴|선택|직접/.test(text)){
      const msg=gdAdd('bot','읽을 포스터나 PDF를 선택하세요. 판독은 이 기기에서 진행하며 PDF는 앞 네 쪽을 읽어요.').querySelector('.gd-msg');
      const input=document.createElement('input');input.type='file';input.accept='.png,.jpg,.jpeg,.webp,.pdf';input.multiple=true;input.setAttribute('aria-label','판독할 포스터나 PDF');msg.append(input);
      input.onchange=async()=>{if(reading)return;reading=true;input.disabled=true;
        try{for(const f of input.files){const out=document.createElement('p');msg.append(out);out.textContent=f.name+' 읽는 중…';try{const lines=await readDocument(f);out.textContent=f.name+' · '+(lines.join('\n')||'글자를 확인할 수 없어요.');}catch(err){out.textContent=f.name+' · '+err.message;}}}
        finally{await release();input.disabled=false;input.value='';}};return;
    }
    const queue=[];
    for(const n of NOTICES){if(!(n.aiPending||n.imageOnly)||dleft(n.deadline)<0)continue;
      for(const f of n.files||[]){if(!/\.(pdf|png|jpe?g|webp)$/i.test(f.name)||n.scan?.some(d=>d.url===f.url))continue;
        let u;try{u=new URL(f.url);}catch{continue;}
        if(u.origin==='https://www.kangwon.ac.kr'&&u.pathname==='/ko/cmmn/download.do')queue.push({id:n.id,f,u});}}
    if(!queue.length){gdAdd('bot','현재 목록에서 새로 판독할 수 있는 학교 PDF·이미지 첨부가 없어요. “판독한 첨부 보여줘”라고 하면 이미 읽은 공고를 찾아드려요.');return;}
    reading=true;const box=gdAdd('bot','학교 첨부를 읽고 있어요. 다른 질문을 하셔도 돼요.').querySelector('.gd-msg');
    let read=0,failed=0;
    (async()=>{try{for(const {id,f,u} of queue){box.textContent='첨부 판독 중 '+(read+failed+1)+' / '+queue.length+' · '+f.name;
      try{const query=new URLSearchParams({dn:u.searchParams.get('dn'),path:u.searchParams.get('path')});
        const response=await fetch(feedOrigin+'/api/school-attachment?'+query,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();
        const lines=await readDocument(new File([await response.blob()],f.name));const n=gdFind(id);if(!lines.length||!n)throw Error();
        (n.scan??=[]).push({name:f.name,url:f.url,lines,method:'이 기기에서 판독'});read++;
      }catch{failed++;}}
      box.textContent='첨부 '+read+'개를 읽었어요.'+(failed?' '+failed+'개는 원문 확인이 필요해요.':'')+' “판독한 첨부 보여줘”로 결과를 찾아보세요.';
    }finally{await release();}})();
  };
})();
