const profileDialog = document.querySelector('#profile-dialog');
const profileForm = document.querySelector('#profile-form');
const profileSummary = document.querySelector('#profile-summary');
const profileFields = ['campus', 'status', 'program', 'year', 'currentSemester', 'major', 'lastGpa', 'cumulativeGpa', 'gpaScale', 'earnedCredits', 'completedSemesters', 'lastCredits', 'lastPercentile', 'incomeBracket'];

function updateProfileSummary(profile) {
  profileSummary.textContent = profile
    ? `${profile.campus}캠퍼스 · ${profile.status} · ${profile.program} ${profile.year}학년 ${profile.currentSemester ? `${profile.currentSemester}학기` : ''} · ${profile.completedSemesters || '—'}학기 이수 · 직전 학기 ${profile.lastGpa || '미입력'} / ${profile.gpaScale} · 총 취득 ${profile.earnedCredits || '미입력'}학점`
    : window.knuUser ? '캠퍼스·학적·성적 정보를 입력하면 장학·공모 조건과 비교할 수 있어요.' : '로그인 후 학사정보를 저장하면 장학·공모 조건과 비교할 수 있어요.';
  document.querySelector('#edit-profile').innerHTML = profile ? '정보 수정하기 <span>→</span>' : window.knuUser ? '정보 입력하기 <span>→</span>' : '로그인하고 입력하기 <span>→</span>';
}

function openProfile() {
  if (!window.knuUser) { window.openKnuAuth(); return; }
  const profile = window.knuProfile;
  profileForm.reset();
  if (profile) for (const name of profileFields) {
    if (profileForm.elements[name]) profileForm.elements[name].value = profile[name] || (name === 'gpaScale' ? '4.5' : '');
  }
  profileDialog.showModal();
}

document.querySelector('#open-profile').addEventListener('click', openProfile);
document.querySelector('#edit-profile').addEventListener('click', openProfile);
document.querySelector('#close-profile').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', (event) => { if (event.target === profileDialog) profileDialog.close(); });

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!profileForm.reportValidity()) return;
  const data = Object.fromEntries(new FormData(profileForm));
  const scale = Number(data.gpaScale);
  if (['lastGpa', 'cumulativeGpa'].some((field) => data[field] && Number(data[field]) > scale)) {
    alert(`평균평점은 선택한 ${scale} 만점을 넘을 수 없습니다.`);
    return;
  }
  const profile = Object.fromEntries(profileFields.map((field) => [field, String(data[field] || '').trim()]));
  try { await window.knuAccountRequest('/api/profile', 'PUT', profile); }
  catch (error) { alert(error.message); return; }
  window.knuProfile = profile;
  updateProfileSummary(profile);
  window.dispatchEvent(new Event('profile-updated'));
  document.querySelector(`.tab[data-campus="${profile.campus}"]`)?.click();
  profileDialog.close();
});

document.querySelector('#clear-profile').addEventListener('click', async () => {
  if (!window.knuUser) return;
  try { await window.knuAccountRequest('/api/profile', 'DELETE'); }
  catch (error) { alert(error.message); return; }
  window.knuProfile = null;
  profileForm.reset();
  updateProfileSummary(null);
  window.dispatchEvent(new Event('profile-updated'));
  profileDialog.close();
});

window.addEventListener('profile-updated', () => updateProfileSummary(window.knuProfile));
updateProfileSummary(window.knuProfile);
