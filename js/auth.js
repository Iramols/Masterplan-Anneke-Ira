// ========== INLOGGEN / UITLOGGEN ==========
// Eén gedeeld account voor Ira en Anneke samen. Zie supabase/schema.sql
// voor de tabel + policies. Om wijzigingen toch aan een naam te kunnen
// koppelen, wordt na het inloggen eenmalig (per toestel) gevraagd wie er
// nu gebruikmaakt van de site -- zie vraagNaamOpEenmalig() hieronder.

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

// Eén gedeeld account, dus de site weet zelf niet wie erachter zit --
// daarom eenmalig per toestel (localStorage) vragen, puur om wijzigingen
// een naam te kunnen geven (bijv. bij het einddoel).
function vraagNaamOpEenmalig() {
  let naam = localStorage.getItem('masterplan_naam');
  if (naam) return naam;
  const invoer = (prompt('Wie ben jij? Typ "Ira" of "Anneke"') || '').trim();
  naam = invoer ? invoer.charAt(0).toUpperCase() + invoer.slice(1).toLowerCase() : 'Onbekend';
  localStorage.setItem('masterplan_naam', naam);
  return naam;
}

async function doLogout() {
  try { await getSupabase().auth.signOut(); } catch (e) {}
  // Bij opnieuw inloggen altijd op de standaardtab starten (Tussentijdse
  // doelen 2027-2029), niet in het laatst bekeken tabblad (dat is alleen
  // voor de Ververs-knop).
  try { sessionStorage.removeItem('masterplan_tab'); } catch (e) {}
  location.reload();
}

async function resolveSession() {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const session = data && data.session;
  if (!session) { showLogin(); return; }
  window.loggedInEmail = session.user.email || '';
  window.loggedInNaam = vraagNaamOpEenmalig();
  hideLogin();
  document.getElementById('app-shell').style.display = '';
  document.getElementById('boot-loader').style.display = 'none';
  // Na de Ververs-knop (een volledige herlading) weer in hetzelfde tabblad
  // uitkomen i.p.v. steeds terug bij Einddoel -- gaNaar() bewaart het
  // actieve tabblad bij elke wissel, zie app.js.
  const opgeslagenTab = sessionStorage.getItem('masterplan_tab');
  if (opgeslagenTab && typeof gaNaar === 'function') gaNaar(opgeslagenTab);
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
