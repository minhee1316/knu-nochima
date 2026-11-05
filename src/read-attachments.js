(function attachmentReader(){
  let libs,reading=false;
  function loadScript(url,global){if(window[global])return Promise.resolve(window[global]);return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>resolve(window[global]);s.onerror=()=>reject(Error('판독 도구를 불러오려면 인터넷 연결이 필요합니다.'));document.head.append(s);});}
  function textLines(text){const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(x=>x.length>3);const picked=lines.filter(x=>/학점|지원|신청|대상|자격|모집|이수|학기|수혜|장학|학생|제출|마감|평점/.test(x.replace(/\s/g,'')));return [...new Set(picked.length?picked:lines)].slice(0,8).map(x=>x.slice(0,210));}
  const ocr=()=>libs||=(async()=>{const T=await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js','Tesseract');return T.createWorker('kor+eng');})().catch(e=>{libs=null;throw e;});
  async function readDocument(file){
    if(file.size>15*1024*1024)throw Error('15MB 이하 파일을 선택하세요.');
    if(/\.pdf$/i.test(file.name)){
      const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;let txt='';
      try{for(let i=1;i<=Math.min(4,pdf.numPages);i++){const page=await pdf.getPage(i);const parts=await page.getTextContent();
        let pageText=parts.items.map(o=>o.str+(o.hasEOL?'\n':' ')).join('');if(pageText.trim().length<18){const vp=page.getViewport({scale:1.35});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;pageText=(await (await ocr()).recognize(c)).data.text;}txt+=pageText+'\n';}}finally{await pdf.destroy();}
      return textLines(txt);
    }
    if(!/\.(?:png|jpe?g|webp)$/i.test(file.name))throw Error('PNG, JPG, WebP, PDF를 지원합니다.');
    return textLines((await (await ocr()).recognize(file)).data.text);
  }
  const button=$('#wb-read');const out=$('#wb-ores');
  button.insertAdjacentHTML('afterend','<details class="wb-details"><summary>새 포스터·PDF 추가 판독</summary><label for="wb-uploads">공고 이미지 또는 PDF · 여러 파일 선택</label><input id="wb-uploads" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" multiple><p class="wb-stamp">이 기기에서 판독합니다. 처음 실행할 때 인터넷이 필요하며 PDF는 앞 4쪽을 읽어요.</p><div id="wb-upload-result" aria-live="polite"></div></details>');
async function readUnseen(){
    if(reading)return;
    const host=location.protocol==='file:'?'https://knu-esungan-preview-20261105.hydroai4.chatgpt.site':'';
    const work=[];
    for(const n of NOTICES){
      if(!n.aiPending&&!n.imageOnly)continue;
      for(const f of n.files||[]){
        if(!/\.(?:pdf|png|jpe?g|webp)$/i.test(f.name)||window.DOC_SCAN[n.id]?.some(d=>d.url===f.url))continue;
        let u;try{u=new URL(f.url);}catch{continue;}
        if(u.origin!=='https://www.kangwon.ac.kr'||u.pathname!=='/ko/cmmn/download.do')continue;
        work.push({n,f,u});
      }
    }
    if(!work.length)return;
    reading=true;button.disabled=true;$('#wb-uploads').disabled=true;
    const status=document.createElement('p');out.prepend(status);let done=0,failed=0;
    try{for(const {n,f,u} of work){
      status.textContent=`새 첨부 판독 중 · ${done+failed+1}/${work.length} · ${f.name}`;
      try{
        const q=new URLSearchParams({dn:u.searchParams.get('dn'),path:u.searchParams.get('path')});
        const response=await fetch(host+'/api/school-attachment?'+q,{signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw Error('unavailable');
        const lines=await readDocument(new File([await response.blob()],f.name));
        if(!lines.length)throw Error('unreadable');
        (window.DOC_SCAN[n.id]??=[]).push({name:f.name,url:f.url,lines,method:'이번 실행에서 파일 판독'});
        n.scan=window.DOC_SCAN[n.id];done++;
      }catch{failed++;}
    }}finally{
      if(libs){try{await (await libs).terminate();}catch{}libs=null;}
      reading=false;button.disabled=false;$('#wb-uploads').disabled=false;button.onclick();const note=document.createElement('p');note.textContent=`새 첨부 ${done}개 판독 · ${failed}개 원문 확인 필요`;out.prepend(note);
    }
  }
  button.addEventListener('click',readUnseen);
  $('#wb-uploads').onchange=async e=>{if(reading)return;reading=true;const inp=e.target;inp.disabled=true;const results=$('#wb-upload-result');results.textContent='';
    try{for(const f of Array.from(inp.files)){const block=document.createElement('p');results.append(block);block.textContent=f.name+' 판독 중…';try{const lines=await readDocument(f);block.textContent=f.name+' · '+(lines.join(' / ')||'판독한 글자가 없습니다.');}catch(err){block.textContent=f.name+' · '+err.message;}}}
    finally{if(libs){try{await (await libs).terminate();}catch{}libs=null;}reading=false;inp.disabled=false;inp.value='';}
  };
})();
