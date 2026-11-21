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
const ICOON_POTLOOD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

// Id van de actie die nu inline bewerkt wordt (null = geen enkele).
let bewerkActieId = null;

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
  lijst.innerHTML = items.map(a => a.id === bewerkActieId ? bewerkActieRijHtml(a) : `
    <div class="actie-row">
      <input type="checkbox" class="actie-check" ${a.status === 'klaar' ? 'checked' : ''} onchange="toggleActie('${a.id}')">
      <div>
        <div class="actie-tekst ${a.status === 'klaar' ? 'klaar' : ''}">${escapeHtml(a.tekst)}</div>
        ${a.deelplanId ? `<div class="card-sub" style="margin:2px 0 0">${escapeHtml(deelplanNaam(a.deelplanId))}</div>` : ''}
        ${a.datum ? `<div class="card-sub" style="margin:2px 0 0${isOverdue(a) ? ';color:#c0392b;font-weight:600' : ''}">${formatDatum(a.datum)}</div>` : ''}
      </div>
      <span class="actie-badge ${a.status}" style="cursor:pointer" onclick="cycleStatus('${a.id}')">${STATUS_LABEL[a.status] || 'Te doen'}</span>
      <span class="actie-wie">${escapeHtml(a.wie || 'Samen')}</span>
      <button class="actie-del" onclick="bewerkActie('${a.id}')" title="Bewerken">${ICOON_POTLOOD}</button>
      <button class="actie-del" onclick="verwijderActie('${a.id}')" title="Verwijderen">${ICOON_PRULLENBAK}</button>
    </div>
  `).join('');
}
function deelplanOptiesHtml(geselecteerdId) {
  const items = state.deelplannen.items || [];
  return '<option value="">(geen deelplan)</option>' +
    items.map(d => `<option value="${d.id}" ${d.id === geselecteerdId ? 'selected' : ''}>${escapeHtml(d.titel)}</option>`).join('');
}
// Zelfde velden/volgorde als de invoerregel voor een nieuwe actie, zodat
// bewerken er vertrouwd uitziet.
function bewerkActieRijHtml(a) {
  return `
    <div class="add-row" style="flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--sand-dark)">
      <input id="ae-tekst-${a.id}" value="${escapeHtml(a.tekst)}" style="flex:1 1 220px">
      <select id="ae-status-${a.id}" style="flex:0 0 110px">
        <option value="te-doen" ${a.status === 'te-doen' ? 'selected' : ''}>Te doen</option>
        <option value="bezig" ${a.status === 'bezig' ? 'selected' : ''}>Bezig</option>
        <option value="klaar" ${a.status === 'klaar' ? 'selected' : ''}>Klaar</option>
      </select>
      <select id="ae-wie-${a.id}" style="flex:0 0 110px">
        <option value="Samen" ${a.wie === 'Samen' ? 'selected' : ''}>Samen</option>
        <option value="Ira" ${a.wie === 'Ira' ? 'selected' : ''}>Ira</option>
        <option value="Anneke" ${a.wie === 'Anneke' ? 'selected' : ''}>Anneke</option>
      </select>
      <select id="ae-deelplan-${a.id}" style="flex:0 0 160px">${deelplanOptiesHtml(a.deelplanId)}</select>
      <input id="ae-datum-${a.id}" type="date" value="${a.datum || ''}" style="flex:0 0 150px">
      <button class="btn-sm" onclick="slaOpBewerkteActie('${a.id}')">Opslaan</button>
      <button class="btn-sm" onclick="annuleerBewerkActie()">Annuleren</button>
    </div>
  `;
}
function bewerkActie(id) { bewerkActieId = id; renderActies(); }
function annuleerBewerkActie() { bewerkActieId = null; renderActies(); }
async function slaOpBewerkteActie(id) {
  const a = (state.acties.items || []).find(x => x.id === id);
  if (!a) return;
  const tekst = document.getElementById('ae-tekst-' + id).value.trim();
  if (!tekst) return;
  a.tekst = tekst;
  a.status = document.getElementById('ae-status-' + id).value;
  a.wie = document.getElementById('ae-wie-' + id).value;
  a.deelplanId = document.getElementById('ae-deelplan-' + id).value || null;
  a.datum = document.getElementById('ae-datum-' + id).value || null;
  await bewaarData('acties', state.acties);
  bewerkActieId = null;
  renderActies();
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
