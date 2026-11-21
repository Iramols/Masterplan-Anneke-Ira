// ========== MASTERPLAN APP ==========
// Alle data staat in de tabel `masterplan_data` (key/value, zie supabase/schema.sql).
// Vier keys: einddoel, masterplan, deelplannen, acties. Simpele JSON-blobs i.p.v.
// losse tabellen per onderdeel -- makkelijk aan te passen zolang de opzet nog niet vaststaat.

let state = {
  einddoel: { tekst: '' },
  masterplan: { fases: [] },
  deelplannen: { items: [] },
  acties: { items: [] }
};

// SVG i.p.v. emoji: een 🗑️-emoji rendert op sommige systemen amper zichtbaar
// zonder kleur-emoji-lettertype. Dit icoon werkt overal hetzelfde.
const ICOON_PRULLENBAK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

function nieuwId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

async function laadData(key, fallback) {
  const sb = getSupabase();
  const { data, error } = await sb.from('masterplan_data').select('value').eq('key', key).maybeSingle();
  if (error) { console.error('laadData', key, error); return fallback; }
  return (data && data.value) || fallback;
}

async function bewaarData(key, value) {
  const sb = getSupabase();
  const { error } = await sb.from('masterplan_data').upsert({
    key: key, value: value, updated_at: new Date().toISOString(), updated_by: window.loggedInNaam || ''
  });
  if (error) { alert('Opslaan mislukt: ' + error.message); }
}

async function initApp() {
  state.einddoel = await laadData('einddoel', { tekst: '' });
  state.masterplan = await laadData('masterplan', { fases: [] });
  state.deelplannen = await laadData('deelplannen', { items: [] });
  state.acties = await laadData('acties', { items: [] });
  renderEinddoel();
  renderMasterplan();
  renderDeelplannen();
  renderActies();
  vulDeelplanDropdown();
}

function gaNaar(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelector('.nav-btn[data-view="' + view + '"]').classList.add('active');
}

// ===== EINDDOEL =====
function renderEinddoel() {
  document.getElementById('einddoel-tekst').value = state.einddoel.tekst || '';
  const meta = state.einddoel.updatedAt
    ? 'Laatst bijgewerkt door ' + (state.einddoel.updatedBy || '?') + ' op ' + new Date(state.einddoel.updatedAt).toLocaleString('nl-NL')
    : '';
  document.getElementById('einddoel-meta').textContent = meta;
}
async function saveEinddoel() {
  state.einddoel = {
    tekst: document.getElementById('einddoel-tekst').value,
    updatedAt: new Date().toISOString(),
    updatedBy: window.loggedInNaam || ''
  };
  await bewaarData('einddoel', state.einddoel);
  renderEinddoel();
}

// ===== MASTERPLAN (fases) =====
function renderMasterplan() {
  const lijst = document.getElementById('fase-lijst');
  const fases = state.masterplan.fases || [];
  document.getElementById('fase-leeg').style.display = fases.length ? 'none' : '';
  lijst.innerHTML = fases.map(f => `
    <div class="fase-item">
      <div class="fase-header">
        <div>
          <div class="fase-periode">${escapeHtml(f.periode || '')}</div>
          <div class="fase-titel">${escapeHtml(f.titel || '')}</div>
        </div>
        <button class="actie-del" onclick="verwijderFase('${f.id}')" title="Verwijderen">✕</button>
      </div>
      ${f.omschrijving ? `<div class="item-tekst">${escapeHtml(f.omschrijving)}</div>` : ''}
    </div>
  `).join('');
}
async function voegFaseToe() {
  const periode = document.getElementById('fase-periode').value.trim();
  const titel = document.getElementById('fase-titel').value.trim();
  const omschrijving = document.getElementById('fase-omschrijving').value.trim();
  if (!titel) return;
  state.masterplan.fases = state.masterplan.fases || [];
  state.masterplan.fases.push({ id: nieuwId(), periode, titel, omschrijving });
  await bewaarData('masterplan', state.masterplan);
  document.getElementById('fase-periode').value = '';
  document.getElementById('fase-titel').value = '';
  document.getElementById('fase-omschrijving').value = '';
  renderMasterplan();
}
async function verwijderFase(id) {
  state.masterplan.fases = (state.masterplan.fases || []).filter(f => f.id !== id);
  await bewaarData('masterplan', state.masterplan);
  renderMasterplan();
}

// ===== DEELPLANNEN =====
function renderDeelplannen() {
  const lijst = document.getElementById('deelplan-lijst');
  const items = state.deelplannen.items || [];
  document.getElementById('deelplan-leeg').style.display = items.length ? 'none' : '';
  lijst.innerHTML = items.map(d => `
    <div class="deelplan-item">
      <div class="deelplan-header">
        <div class="deelplan-titel">${escapeHtml(d.titel || '')}</div>
        <button class="actie-del" onclick="verwijderDeelplan('${d.id}')" title="Verwijderen">✕</button>
      </div>
      ${d.omschrijving ? `<div class="item-tekst">${escapeHtml(d.omschrijving)}</div>` : ''}
    </div>
  `).join('');
  vulDeelplanDropdown();
}
async function voegDeelplanToe() {
  const titel = document.getElementById('deelplan-titel').value.trim();
  const omschrijving = document.getElementById('deelplan-omschrijving').value.trim();
  if (!titel) return;
  state.deelplannen.items = state.deelplannen.items || [];
  state.deelplannen.items.push({ id: nieuwId(), titel, omschrijving });
  await bewaarData('deelplannen', state.deelplannen);
  document.getElementById('deelplan-titel').value = '';
  document.getElementById('deelplan-omschrijving').value = '';
  renderDeelplannen();
}
async function verwijderDeelplan(id) {
  state.deelplannen.items = (state.deelplannen.items || []).filter(d => d.id !== id);
  await bewaarData('deelplannen', state.deelplannen);
  renderDeelplannen();
}
function vulDeelplanDropdown() {
  const sel = document.getElementById('actie-deelplan');
  const huidig = sel.value;
  const items = state.deelplannen.items || [];
  sel.innerHTML = '<option value="">(geen deelplan)</option>' +
    items.map(d => `<option value="${d.id}">${escapeHtml(d.titel)}</option>`).join('');
  sel.value = huidig;
}

// ===== ACTIES =====
const STATUS_VOLGORDE = ['te-doen', 'bezig', 'klaar'];
const STATUS_LABEL = { 'te-doen': 'Te doen', 'bezig': 'Bezig', 'klaar': 'Klaar' };

function renderActies() {
  const lijst = document.getElementById('actie-lijst');
  const items = state.acties.items || [];
  document.getElementById('actie-leeg').style.display = items.length ? 'none' : '';
  const deelplanNaam = id => {
    const d = (state.deelplannen.items || []).find(x => x.id === id);
    return d ? d.titel : '';
  };
  lijst.innerHTML = items.map(a => `
    <div class="actie-row">
      <input type="checkbox" class="actie-check" ${a.status === 'klaar' ? 'checked' : ''} onchange="toggleActie('${a.id}')">
      <div>
        <div class="actie-tekst ${a.status === 'klaar' ? 'klaar' : ''}">${escapeHtml(a.tekst)}</div>
        ${a.deelplanId ? `<div class="card-sub" style="margin:2px 0 0">${escapeHtml(deelplanNaam(a.deelplanId))}</div>` : ''}
        ${a.datum ? `<div class="card-sub" style="margin:2px 0 0${isOverdue(a) ? ';color:#c0392b;font-weight:600' : ''}">${formatDatum(a.datum)}</div>` : ''}
      </div>
      <span class="actie-badge ${a.status}" style="cursor:pointer" onclick="cycleStatus('${a.id}')">${STATUS_LABEL[a.status] || 'Te doen'}</span>
      <span class="actie-wie">${escapeHtml(a.wie || 'Samen')}</span>
      <button class="actie-del" onclick="verwijderActie('${a.id}')" title="Verwijderen">${ICOON_PRULLENBAK}</button>
    </div>
  `).join('');
}
function formatDatum(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isOverdue(a) {
  if (!a.datum || a.status === 'klaar') return false;
  return a.datum < new Date().toISOString().slice(0, 10);
}
async function voegActieToe() {
  const tekst = document.getElementById('actie-tekst').value.trim();
  const status = document.getElementById('actie-status').value;
  const wie = document.getElementById('actie-wie').value;
  const deelplanId = document.getElementById('actie-deelplan').value;
  const datum = document.getElementById('actie-datum').value;
  if (!tekst) return;
  state.acties.items = state.acties.items || [];
  state.acties.items.push({ id: nieuwId(), tekst, status, wie, deelplanId: deelplanId || null, datum: datum || null });
  await bewaarData('acties', state.acties);
  document.getElementById('actie-tekst').value = '';
  document.getElementById('actie-status').value = 'te-doen';
  document.getElementById('actie-datum').value = '';
  renderActies();
}
async function toggleActie(id) {
  const a = (state.acties.items || []).find(x => x.id === id);
  if (!a) return;
  a.status = a.status === 'klaar' ? 'te-doen' : 'klaar';
  await bewaarData('acties', state.acties);
  renderActies();
}
async function cycleStatus(id) {
  const a = (state.acties.items || []).find(x => x.id === id);
  if (!a) return;
  const i = STATUS_VOLGORDE.indexOf(a.status);
  a.status = STATUS_VOLGORDE[(i + 1) % STATUS_VOLGORDE.length];
  await bewaarData('acties', state.acties);
  renderActies();
}
async function verwijderActie(id) {
  state.acties.items = (state.acties.items || []).filter(a => a.id !== id);
  await bewaarData('acties', state.acties);
  renderActies();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
