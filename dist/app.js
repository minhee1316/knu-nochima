import { evaluateNotice } from './match.mjs';
import { visibleItems } from './feed.mjs';

const state = { notices: [], events: [], campus: 'all', query: '', matchMode: 'all', sourceMode: 'all', audience: 'student' };
const grid = document.querySelector('#notice-grid');
const dialog = document.querySelector('#detail-dialog');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

function campusLabel(item) {
  if (item.kind === 'local-event') return `${item.region} 지역 행사`;
  if (item.campuses.includes('전체')) return '전체 캠퍼스';
  return item.campuses.filter((name) => ['춘천', '삼척'].includes(name)).join(' · ') || '캠퍼스';
}
function campusClass(item) {
  if (item.kind === 'local-event') return item.region === '삼척' ? 'samcheok' : '';
  if (item.campuses.includes('전체')) return 'all';
  return item.campuses.includes('삼척') && !item.campuses.includes('춘천') ? 'samcheok' : '';
}
function formatDate(value) { return value?.replaceAll('-', '.') || '날짜 확인'; }
function eventDate(item) { return item.startAt === item.endAt ? formatDate(item.startAt) : `${formatDate(item.startAt)} ~ ${formatDate(item.endAt)}`; }
function todayKst() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }
function getProfile() { return window.knuProfile || null; }
function getMatch(item) { return evaluateNotice(item, getProfile()); }

function updateAudience() {
  const resident = state.audience === 'resident';
  document.querySelectorAll('.audience-option').forEach((button) => {
    const active = button.dataset.mode === state.audience && (!resident || button.dataset.region === state.campus);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.querySelector('.profile-banner').hidden = resident;
  document.querySelector('#open-profile').hidden = resident;
  document.querySelector('.match-controls').hidden = resident;
  document.querySelector('.source-controls').hidden = resident;
  document.querySelector('.tab[data-campus="all"]').hidden = resident;
  document.querySelector('#feed-title').textContent = resident ? `${state.campus} 지역 행사` : '지금 확인할 기회';
  document.querySelector('#feed-description').textContent = resident
    ? '가입이나 학사정보 입력 없이 지역 행사를 확인하세요. 일정과 참가 조건은 주최 기관의 원문을 확인하세요.'
    : '학교 공지와 지역 행사를 함께 봅니다. 장학·공모 추천은 명시된 일부 조건을 비교한 결과입니다.';
  document.querySelector('#search').placeholder = resident ? '지역 행사 검색' : '공지·행사 검색';
  document.querySelector('#sort-label').textContent = resident ? '가까운 행사 일정순' : '학교 공지 최신순 · 지역 행사 일정순';
  document.querySelectorAll('.tab').forEach((button) => {
    const active = button.dataset.campus === state.campus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function selectAudience(mode, region) {
  state.audience = mode;
  state.campus = mode === 'resident' ? region : (getProfile()?.campus || 'all');
  state.query = '';
  document.querySelector('#search').value = '';
  state.matchMode = 'all';
  state.sourceMode = 'all';
  document.querySelector('.match-tab[data-match="all"]').click();
  document.querySelector('.source-tab[data-source="all"]').click();
  try { localStorage.setItem('knu-esungan-audience-v1', JSON.stringify({ mode, region: state.campus })); } catch {}
  updateAudience();
  render();
}

function render() {
  const resident = state.audience === 'resident';
  const filtered = visibleItems(state.notices, state.events, { ...state, today: todayKst(), matchNotice: getMatch });
  document.querySelector('#stat-total').textContent = filtered.length;
  document.querySelector('#result-count').textContent = `${filtered.length}개의 ${resident ? '지역 행사' : '소식'}`;
  document.querySelector('#empty').hidden = filtered.length > 0;
  grid.innerHTML = filtered.map((item) => { const local = item.kind === 'local-event'; const match = local ? null : getMatch(item); return `<button class="notice-card" data-id="${escapeHtml(item.id)}">
    <div class="card-top"><span class="pill ${campusClass(item)}">${escapeHtml(campusLabel(item))}</span><span class="card-date">${escapeHtml(local ? eventDate(item) : formatDate(item.postedAt))}</span></div>
    <div class="card-tags"><span class="board-tag">${escapeHtml(item.board)}</span>${match && match.category !== 'info' ? `<span class="match-badge ${match.category}">${escapeHtml(match.label)}</span>` : ''}</div>
    <h3>${escapeHtml(item.title)}</h3><p>${local ? `${escapeHtml(item.source)} · 주최 기관 원문에서 자세히 보기` : item.contentType === 'image' ? '이미지로 작성된 공지 · 원문에서 확인' : escapeHtml(item.body?.slice(0, 110) || '원문에서 내용을 확인하세요.')}</p>
    <div class="card-bottom"><span>${local ? escapeHtml(item.source) : match.matched?.[0] ? escapeHtml(match.matched[0]) : item.contentType === 'image' ? '이미지 공지' : '자세히 보기'}</span><span>↗</span></div></button>`; }).join('');
}

function openDetail(item) {
  if (!item) return;
  const local = item.kind === 'local-event';
  const match = local ? null : getMatch(item);
  document.querySelector('#detail-campus').textContent = campusLabel(item);
  document.querySelector('#detail-campus').className = `pill ${campusClass(item)}`;
  document.querySelector('#detail-title').textContent = item.title;
  document.querySelector('#detail-date').textContent = local ? `${eventDate(item)} · ${item.source}` : `게시 ${formatDate(item.postedAt)} · 강원대학교 ${item.board}`;
  const matchBox = document.querySelector('#detail-match');
  matchBox.hidden = local || match.category === 'info';
  if (!local && match.category !== 'info') {
    const lines = [match.label];
    if (match.matched.length) lines.push(`일치: ${match.matched.join(' · ')}`);
    if (match.failed.length) lines.push(`불일치: ${match.failed.join(' · ')}`);
    if (match.missing.length) lines.push(`확인 필요: ${match.missing.join(' · ')}`);
    if (match.rules.length) lines.push(`근거: ${match.rules.slice(0, 2).map((rule) => rule.evidence).join(' / ')}`);
    lines.push('자동 비교는 일부 명시 조건만 다룹니다. 신청 자격과 마감일은 원문에서 최종 확인하세요.');
    matchBox.textContent = lines.join('\n');
    matchBox.className = `detail-match ${match.category}`;
  }
  const body = document.querySelector('#detail-body');
  body.textContent = '';
  if (item.body) body.textContent = item.body;
  else {
    const note = document.createElement('div');
    note.className = 'image-note';
    note.textContent = item.images?.length ? `이 공지는 이미지 ${item.images.length}장으로 작성됐습니다. 아래 버튼을 눌러 강원대 원문에서 이미지를 확인하세요.` : '본문 내용을 강원대 원문에서 확인하세요.';
    body.append(note);
  }
  document.querySelector('#detail-link').href = item.url;
  document.querySelector('#detail-link-label').textContent = local
    ? item.source === '한국관광공사 TourAPI' ? '한국관광공사 관광정보 열기' : `${item.source} 원문에서 확인`
    : '강원대 원문에서 확인';
  dialog.showModal();
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  state.campus = tab.dataset.campus;
  if (state.audience === 'resident') {
    try { localStorage.setItem('knu-esungan-audience-v1', JSON.stringify({ mode: 'resident', region: state.campus })); } catch {}
  }
  document.querySelectorAll('.tab').forEach((button) => { button.classList.toggle('active', button === tab); button.setAttribute('aria-pressed', button === tab ? 'true' : 'false'); });
  render();
  updateAudience();
}));
document.querySelectorAll('.audience-option').forEach((button) => button.addEventListener('click', () => selectAudience(button.dataset.mode, button.dataset.region)));
document.querySelector('#search').addEventListener('input', (event) => { state.query = event.target.value.trim().toLocaleLowerCase(); render(); });
document.querySelectorAll('.source-tab').forEach((tab) => tab.addEventListener('click', () => {
  state.sourceMode = tab.dataset.source;
  document.querySelectorAll('.source-tab').forEach((button) => { button.classList.toggle('active', button === tab); button.setAttribute('aria-pressed', button === tab ? 'true' : 'false'); });
  render();
}));
document.querySelectorAll('.match-tab').forEach((tab) => tab.addEventListener('click', () => {
  state.matchMode = tab.dataset.match;
  document.querySelectorAll('.match-tab').forEach((button) => { button.classList.toggle('active', button === tab); button.setAttribute('aria-pressed', button === tab ? 'true' : 'false'); });
  render();
}));
window.addEventListener('profile-updated', render);
grid.addEventListener('click', (event) => { const card = event.target.closest('[data-id]'); if (card) openDetail([...state.notices, ...state.events].find((item) => item.id === card.dataset.id)); });
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

try {
  const saved = JSON.parse(localStorage.getItem('knu-esungan-audience-v1') || 'null');
  if (saved?.mode === 'resident' && ['춘천', '삼척'].includes(saved.region)) { state.audience = 'resident'; state.campus = saved.region; }
  else if (getProfile()?.campus) state.campus = getProfile().campus;
} catch {}
updateAudience();

async function fetchFeed(kind) {
  try {
    const response = await fetch(`/api/${kind}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${kind} ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('자료 형식 오류');
    return data;
  } catch {
    const response = await fetch(`./${kind}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${kind} 자료를 읽지 못했습니다.`);
    return { items: await response.json(), mode: 'snapshot', updatedAt: null };
  }
}

let loading = false;
let lastChecked = 0;
async function loadFeeds() {
  if (loading) return;
  loading = true;
  try {
    const [school, local] = await Promise.all([fetchFeed('notices'), fetchFeed('events')]);
    state.notices = school.items;
    state.events = local.items;
    const schoolStatus = school.mode === 'live' ? '학교 공지 15분 간격 확인' : '학교 공지 저장본';
    const eventStatus = local.mode === 'live'
      ? `지역 행사 15분 간격 확인 · 춘천시 API ${local.sources?.includes('춘천시 문화축제 API') && local.sources?.includes('춘천시 공연행사 API') ? '연결' : '확인 대기'} · 관광공사 ${local.tourConnected ? `${local.tourCount}건` : '확인 대기'}`
      : '지역 행사 저장본';
    document.querySelector('#feed-status').textContent = `${schoolStatus} · ${eventStatus}`;
    const last = [school.updatedAt, local.updatedAt, ...state.notices.map((item) => item.collectedAt), ...state.events.map((item) => item.collectedAt)].filter(Boolean).sort().at(-1);
    document.querySelector('#last-updated').textContent = last ? `최근 확인 ${new Date(last).toLocaleString('ko-KR')}` : '';
    lastChecked = Date.now();
    render();
  } catch (error) {
    document.querySelector('#result-count').textContent = error.message;
    document.querySelector('#feed-status').textContent = '자료를 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';
  } finally { loading = false; }
}
loadFeeds();
setInterval(loadFeeds, 15 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastChecked >= 15 * 60 * 1000) loadFeeds();
});
