// ========== INLOGGEN / UITLOGGEN ==========
// Simpel: twee accounts (Ira & Anneke), geen rollen, allebei zien/bewerken
// dezelfde masterplan-data. Zie supabase/schema.sql voor de tabel + policies.

function toLoginEmail(input) {
  input = (input || '').trim();
  return input.includes('@') ? input : input.toLowerCase() + '@masterplan.local';
}

function showLogin(message) {
  document.getElementById('boot-loader').style.display = 'none';
  document.getElementById('login-overlay').classList.add('open');
  document.getElementById('login-error').textContent = message || '';
}

function hideLogin() {
  document.getElementById('login-overlay').classList.remove('open');
}

async function doLogin() {
  const emailInput = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  try {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: toLoginEmail(emailInput), password: password });
    if (error) throw error;
    await resolveSession();
  } catch (err) {
    showLogin(err.message === 'Invalid login credentials' ? 'E-mail of wachtwoord onjuist.' : 'Inloggen mislukt: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function doLogout() {
  try { await getSupabase().auth.signOut(); } catch (e) {}
  location.reload();
}

async function resolveSession() {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const session = data && data.session;
  if (!session) { showLogin(); return; }
  window.loggedInEmail = session.user.email || '';
  window.loggedInNaam = loggedInEmail.toLowerCase().indexOf('anneke') === 0 ? 'Anneke'
    : loggedInEmail.toLowerCase().indexOf('ira') === 0 ? 'Ira' : loggedInEmail;
  hideLogin();
  document.getElementById('app-shell').style.display = '';
  document.getElementById('boot-loader').style.display = 'none';
  if (typeof initApp === 'function') await initApp();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    doLogin();
  });
  document.getElementById('login-password-toggle').addEventListener('click', function () {
    const input = document.getElementById('login-password');
    const tonen = input.type === 'password';
    input.type = tonen ? 'text' : 'password';
    this.textContent = tonen ? '🙈' : '👁️';
  });
  resolveSession().catch(function (err) { showLogin('Er ging iets mis: ' + err.message); });
});
