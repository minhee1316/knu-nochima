const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
let authMode = 'login';
window.knuUser = null;
window.knuProfile = null;

async function accountRequest(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '요청을 완료하지 못했습니다.');
  return result;
}
window.knuAccountRequest = accountRequest;

function showAuthMessage(message) { authMessage.textContent = message || ''; }
function syncAuthUi() {
  const signedIn = !!window.knuUser;
  document.querySelector('#auth-guest').hidden = signedIn;
  document.querySelector('#auth-signed-in').hidden = !signedIn;
  document.querySelector('#open-auth').hidden = signedIn;
  document.querySelector('#account-name').hidden = !signedIn;
  document.querySelector('#logout-button').hidden = !signedIn;
  document.querySelector('#account-name').textContent = signedIn ? window.knuUser.username : '';
  document.querySelector('#auth-account-label').textContent = signedIn ? window.knuUser.username : '';
  window.dispatchEvent(new Event('profile-updated'));
}
window.openKnuAuth = () => authDialog.showModal();

function setAuthMode(mode) {
  authMode = mode;
  authForm.reset();
  showAuthMessage('');
  const signup = mode === 'signup';
  document.querySelector('#confirm-label').hidden = !signup;
  authForm.elements.confirmPassword.required = signup;
  authForm.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
  document.querySelector('#auth-submit').textContent = signup ? '계정 만들기' : '로그인';
  document.querySelectorAll('.auth-tab').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
}

document.querySelector('#open-auth').addEventListener('click', window.openKnuAuth);
document.querySelector('#close-auth').addEventListener('click', () => authDialog.close());
authDialog.addEventListener('click', (event) => { if (event.target === authDialog) authDialog.close(); });
document.querySelectorAll('.auth-tab').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;
  const { username, password, confirmPassword } = Object.fromEntries(new FormData(authForm));
  if (authMode === 'signup' && password !== confirmPassword) { showAuthMessage('비밀번호 확인이 일치하지 않습니다.'); return; }
  const submit = document.querySelector('#auth-submit');
  submit.disabled = true;
  showAuthMessage('처리하고 있어요…');
  try {
    const result = await accountRequest(`/api/auth/${authMode}`, 'POST', { username, password });
    window.knuUser = result.user;
    const profileResult = await accountRequest('/api/profile');
    window.knuProfile = profileResult.profile;
    syncAuthUi();
    authForm.reset();
    authDialog.close();
  } catch (error) { showAuthMessage(error.message); }
  finally { submit.disabled = false; }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    await accountRequest('/api/auth/logout', 'POST');
    window.knuUser = null;
    window.knuProfile = null;
    syncAuthUi();
  } catch (error) { alert(error.message); }
});
document.querySelector('#delete-account').addEventListener('click', async () => {
  if (!confirm('계정과 저장된 학사정보를 모두 삭제할까요?')) return;
  const password = prompt('계정 삭제를 확인하려면 비밀번호를 입력하세요.');
  if (password === null) return;
  try {
    await accountRequest('/api/auth/delete', 'POST', { password });
    window.knuUser = null;
    window.knuProfile = null;
    syncAuthUi();
    authDialog.close();
  } catch (error) { alert(error.message); }
});

async function restoreAccount() {
  try {
    const result = await accountRequest('/api/auth/me');
    window.knuUser = result.user;
    window.knuProfile = result.user ? (await accountRequest('/api/profile')).profile : null;
  } catch { window.knuUser = null; window.knuProfile = null; }
  syncAuthUi();
}
restoreAccount();
