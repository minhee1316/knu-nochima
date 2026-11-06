(() => {
  const panel = document.getElementById('faculty-tools');
  const query = panel.querySelector('#faculty-query');
  const storageKey = () => 'knu-teaching-sources:' + (SESSION?.user.email || 'guest');
  let owner, saved = [];

  function sourceUrl(value) {
    try {
      const url = new URL(value);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch {}
    return '';
  }
  function loadShelf() {
    const key = storageKey();
    if (key === owner) return;
    owner = key;
    saved = [];
    query.value = '';
    panel.querySelector('#faculty-add').reset();
    try {
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(rows)) saved = rows.filter(r => r && typeof r.title === 'string' && sourceUrl(r.url)).slice(0, 200);
    } catch {}
  }
  function storeShelf(next) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(next));
      saved = next;
      refresh();
    } catch { toast('이 브라우저에 자료를 저장할 공간이 부족해요.'); }
  }
  function add(title, value) {
    const url = sourceUrl(value);
    if (!url || !title.trim()) return toast('자료 제목과 http 또는 https 원문 주소를 입력해 주세요.');
    if (saved.some(r => r.url === url)) return toast('이미 자료함에 있는 출처예요.');
    if (saved.length >= 200) return toast('자료함이 가득 찼어요. 사용한 자료를 정리해 주세요.');
    storeShelf([...saved, { title: title.trim().slice(0, 200), url }]);
  }
  function row(title, url, action, label) {
    return '<div class="faculty-row"><a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(title)+'</a><button type="button" class="btn white sm" '+action+'>'+label+'</button></div>';
  }
  function refresh() {
    if (panel.hidden) return;
    loadShelf();
    const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const data = new URL('https://www.data.go.kr/tcs/dss/selectDataSetList.do');
    if (words.length) data.searchParams.set('keyword',query.value.trim());
    panel.querySelector('#faculty-links').innerHTML =
      '<a class="btn white sm" target="_blank" rel="noopener noreferrer" href="https://www.kmooc.kr/">K-MOOC 공개강좌 ↗</a>'+
      '<a class="btn white sm" target="_blank" rel="noopener noreferrer" href="'+esc(data.href)+'">실습용 공공데이터 찾기 ↗</a>';
    const relevant = NOTICES.filter(n => !n.kind || n.kind === 'school').filter(n => {
      if (!sourceUrl(n.url) || dleft(n.deadline) < 0) return false;
      const content = [n.title,n.org,n.summary,n.snippet,n.body].join(' ').toLowerCase();
      return words.length ? words.every(w => content.includes(w)) : /교직원|교수법|교원|워크숍|세미나|포럼|교수학습/.test(n.title+' '+n.org);
    }).sort((a,b) => String(b.posted||'').localeCompare(String(a.posted||'')));
    panel.querySelector('#faculty-hits').innerHTML = relevant.slice(0,6).map(n => row(n.title,sourceUrl(n.url),'data-source',saved.some(r => r.url===sourceUrl(n.url))?'저장됨':'자료함에 담기')).join('') ||
      '<p class="hint">이 주제에 맞는 교내 공지가 없어요. 공개강좌나 공공데이터에서 찾은 자료도 아래 자료함에 담을 수 있어요.</p>';
    panel.querySelector('#faculty-count').textContent = saved.length;
    panel.querySelector('#faculty-export').disabled = !saved.length;
    panel.querySelector('#faculty-saved').innerHTML = saved.map((r,i) => row(r.title,sourceUrl(r.url),'data-remove="'+i+'"','삭제')).join('');
  }
  panel.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-source')) {
      const link = button.parentElement.querySelector('a');
      add(link.textContent,link.href);
    } else if (button.hasAttribute('data-remove')) storeShelf(saved.filter((_,i)=>i!==Number(button.dataset.remove)));
  });
  panel.querySelector('#faculty-add').onsubmit = e => {
    e.preventDefault();
    const form=e.currentTarget, before=saved.length;
    add(form.elements.title.value,form.elements.url.value);
    if (saved.length>before) form.reset();
  };
  panel.querySelector('#faculty-export').onclick = () => {
    const blob = new Blob([saved.map(r=>r.title+'\n'+r.url).join('\n\n')],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='수업자료_출처.txt';
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  query.addEventListener('input', refresh);
  window.facultyDesk = {refresh};
  refresh();
})();
