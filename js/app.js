// ========== MASTERPLAN APP ==========
// Alle data staat in de tabel `masterplan_data` (key/value, zie supabase/schema.sql).
// Vier keys: einddoel, masterplan, deelplannen, acties. Simpele JSON-blobs i.p.v.
// losse tabellen per onderdeel -- makkelijk aan te passen zolang de opzet nog niet vaststaat.

// Haalt gegarandeerd de laatste versie op: een nieuwe, nog nooit gecachete
// URL (met een unieke querystring) omzeilt zowel de browsercache als een
// eventueel nog niet verlopen CDN-cache van GitHub Pages.
function verversNu() {
  location.href = location.pathname + '?r=' + Date.now();
}

let state = {
  einddoel: { tekst: '' },
  masterplan: { fases: [] },
  deelplannen: { items: [] },
  acties: { items: [] },
  excelInfo: null
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
  await ververDataStil();
  // Elke minuut automatisch de nieuwste data ophalen (bv. wat Anneke of Ira
  // zojuist op een ander toestel toevoegde) -- alleen de eerste keer de
  // timer starten, anders stapelen herhaalde initApp()-aanroepen intervals op.
  if (!autoVersGestart) {
    autoVersGestart = true;
    setInterval(function () {
      // Niet verversen terwijl iemand middenin een bewerking of invoer zit --
      // anders verdwijnt onopgeslagen tekst zomaar.
      if (bewerkActieId) return;
      const actief = document.activeElement;
      if (actief && ['INPUT', 'TEXTAREA', 'SELECT'].includes(actief.tagName)) return;
      ververDataStil();
    }, 60000);
  }
}
let autoVersGestart = false;
async function ververDataStil() {
  state.einddoel = await laadData('einddoel', { tekst: '' });
  state.masterplan = await laadData('masterplan', { fases: [] });
  state.deelplannen = await laadData('deelplannen', { items: [] });
  state.acties = await laadData('acties', { items: [] });
  state.excelInfo = await laadData('excel_info', null);
  renderEinddoel();
  renderMasterplan();
  renderDeelplannen();
  renderActies();
  renderExcelInfo();
  renderPlaatje();
}

function gaNaar(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelector('.nav-btn[data-view="' + view + '"]').classList.add('active');
  try { sessionStorage.setItem('masterplan_tab', view); } catch (e) {}
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

// ===== EXCEL-PLAN (upload/download) =====
// Het bestand zelf staat in Supabase Storage (bucket 'masterplan-bestanden'),
// altijd onder hetzelfde pad -- een nieuwe upload overschrijft de vorige.
// De metadata (bestandsnaam/datum/door wie) staat als gewone rij in
// masterplan_data, zodat die net als de rest meteen zichtbaar is voor beiden.
const EXCEL_BUCKET = 'masterplan-bestanden';
const EXCEL_PAD = 'masterplan.xlsx';

function renderExcelInfo() {
  const info = state.excelInfo;
  const infoEl = document.getElementById('excel-info');
  const downloadBtn = document.getElementById('excel-download-btn');
  if (info) {
    infoEl.textContent = escapeHtml(info.filename) + ' -- geupload door ' + escapeHtml(info.updatedBy || '?') + ' op ' + new Date(info.updatedAt).toLocaleString('nl-NL');
    downloadBtn.style.display = '';
  } else {
    infoEl.textContent = 'Nog geen Excel-bestand geupload.';
    downloadBtn.style.display = 'none';
  }
}

async function uploadExcel() {
  const input = document.getElementById('excel-bestand');
  const file = input.files[0];
  const statusEl = document.getElementById('excel-status');
  if (!file) { statusEl.textContent = 'Kies eerst een bestand.'; return; }
  statusEl.textContent = 'Bezig met uploaden...';
  const sb = getSupabase();
  const { error: uploadError } = await sb.storage.from(EXCEL_BUCKET).upload(EXCEL_PAD, file, { upsert: true });
  if (uploadError) { statusEl.textContent = 'Uploaden mislukt: ' + uploadError.message; return; }
  state.excelInfo = { filename: file.name, updatedAt: new Date().toISOString(), updatedBy: window.loggedInNaam || '' };
  await bewaarData('excel_info', state.excelInfo);
  input.value = '';
  statusEl.textContent = 'Geupload.';
  renderExcelInfo();
}

async function downloadExcel() {
  const statusEl = document.getElementById('excel-status');
  statusEl.textContent = 'Bezig met downloaden...';
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(EXCEL_BUCKET).download(EXCEL_PAD);
  if (error) { statusEl.textContent = 'Downloaden mislukt: ' + error.message; return; }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = (state.excelInfo && state.excelInfo.filename) || EXCEL_PAD;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusEl.textContent = '';
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
// ===== ACTIES =====
const STATUS_VOLGORDE = ['te-doen', 'bezig', 'klaar'];
const STATUS_LABEL = { 'te-doen': 'Te doen', 'bezig': 'Bezig', 'klaar': 'Klaar' };

// a.tekst is de oude, ongesplitste opslag (vóór de titel/details-splitsing)
// -- als fallback getoond als titel zodat bestaande acties niet verdwijnen.
function actieTitel(a) { return a.titel || a.tekst || ''; }
function actieDetails(a) { return a.details || ''; }

function renderActies() {
  const lijst = document.getElementById('actie-lijst');
  const items = state.acties.items || [];
  document.getElementById('actie-leeg').style.display = items.length ? 'none' : '';
  lijst.innerHTML = items.map(a => a.id === bewerkActieId ? bewerkActieRijHtml(a) : `
    <div class="actie-row">
      <input type="checkbox" class="actie-check" ${a.status === 'klaar' ? 'checked' : ''} onchange="toggleActie('${a.id}')">
      <div class="actie-tekst-kol">
        <div class="actie-tekst ${a.status === 'klaar' ? 'klaar' : ''}">${escapeHtml(actieTitel(a))}</div>
        ${actieDetails(a) ? `<div class="actie-details">${escapeHtml(actieDetails(a))}</div>` : ''}
      </div>
      <span class="actie-badge ${a.status}" style="cursor:pointer" onclick="cycleStatus('${a.id}')">${STATUS_LABEL[a.status] || 'Te doen'}</span>
      <span class="actie-wie">${escapeHtml(a.wie || 'Samen')}</span>
      <span class="actie-datum-kol"${a.datum && isOverdue(a) ? ' style="color:#c0392b;font-weight:600"' : ''}>${a.datum ? formatDatum(a.datum) : ''}</span>
      <span class="actie-iconen">
        <button class="actie-del" onclick="bewerkActie('${a.id}')" title="Bewerken">${ICOON_POTLOOD}</button>
        <button class="actie-del" onclick="verwijderActie('${a.id}')" title="Verwijderen">${ICOON_PRULLENBAK}</button>
      </span>
    </div>
  `).join('');
}
// Zelfde velden/volgorde als de invoerregel voor een nieuwe actie, zodat
// bewerken er vertrouwd uitziet.
function bewerkActieRijHtml(a) {
  return `
    <div class="add-row">
      <span class="col-check"></span>
      <div class="actie-tekst-kol">
        <input id="ae-titel-${a.id}" class="actie-titel-input" value="${escapeHtml(actieTitel(a))}">
        <textarea id="ae-details-${a.id}" class="actie-input" rows="1" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${escapeHtml(actieDetails(a))}</textarea>
      </div>
      <select id="ae-status-${a.id}" class="col-status">
        <option value="te-doen" ${a.status === 'te-doen' ? 'selected' : ''}>Te doen</option>
        <option value="bezig" ${a.status === 'bezig' ? 'selected' : ''}>Bezig</option>
        <option value="klaar" ${a.status === 'klaar' ? 'selected' : ''}>Klaar</option>
      </select>
      <select id="ae-wie-${a.id}" class="col-wie">
        <option value="Samen" ${a.wie === 'Samen' ? 'selected' : ''}>Samen</option>
        <option value="Ira" ${a.wie === 'Ira' ? 'selected' : ''}>Ira</option>
        <option value="Anneke" ${a.wie === 'Anneke' ? 'selected' : ''}>Anneke</option>
      </select>
      <input id="ae-datum-${a.id}" type="date" class="col-datum" value="${a.datum || ''}">
      <button class="btn-sm" onclick="slaOpBewerkteActie('${a.id}')">Opslaan</button>
      <button class="btn-sm" onclick="annuleerBewerkActie()">Annuleren</button>
    </div>
  `;
}
function bewerkActie(id) {
  bewerkActieId = id;
  renderActies();
  const veld = document.getElementById('ae-details-' + id);
  if (veld) { veld.style.height = 'auto'; veld.style.height = veld.scrollHeight + 'px'; }
}
function annuleerBewerkActie() { bewerkActieId = null; renderActies(); }
async function slaOpBewerkteActie(id) {
  const a = (state.acties.items || []).find(x => x.id === id);
  if (!a) return;
  const titel = document.getElementById('ae-titel-' + id).value.trim();
  if (!titel) return;
  a.titel = titel;
  a.details = document.getElementById('ae-details-' + id).value.trim();
  delete a.tekst;
  a.status = document.getElementById('ae-status-' + id).value;
  a.wie = document.getElementById('ae-wie-' + id).value;
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
  const titel = document.getElementById('actie-titel').value.trim();
  const details = document.getElementById('actie-details').value.trim();
  const status = document.getElementById('actie-status').value;
  const wie = document.getElementById('actie-wie').value;
  const datum = document.getElementById('actie-datum').value;
  if (!titel) return;
  state.acties.items = state.acties.items || [];
  state.acties.items.push({ id: nieuwId(), titel, details, status, wie, datum: datum || null });
  await bewaarData('acties', state.acties);
  document.getElementById('actie-titel').value = '';
  const detailsVeld = document.getElementById('actie-details');
  detailsVeld.value = '';
  detailsVeld.style.height = 'auto';
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

// ===== PLAATJE VAN HET PLAN =====
// Eén afbeelding (screenshot/export van het plan), zelfde opslagplek als
// het Excel-bestand. Bucket is niet-publiek, dus downloaden + als blob tonen.
const PLAATJE_PAD = 'plan-plaatje';

async function renderPlaatje() {
  const sb = getSupabase();
  const img = document.getElementById('plaatje-img');
  const leeg = document.getElementById('plaatje-leeg');
  const { data, error } = await sb.storage.from(EXCEL_BUCKET).download(PLAATJE_PAD);
  if (error || !data) {
    img.style.display = 'none';
    leeg.style.display = '';
    return;
  }
  img.src = URL.createObjectURL(data);
  img.style.display = '';
  leeg.style.display = 'none';
}

async function uploadPlaatje() {
  const input = document.getElementById('plaatje-bestand');
  const file = input.files[0];
  const statusEl = document.getElementById('plaatje-status');
  if (!file) { statusEl.textContent = 'Kies eerst een afbeelding.'; return; }
  statusEl.textContent = 'Bezig met uploaden...';
  const sb = getSupabase();
  const { error } = await sb.storage.from(EXCEL_BUCKET).upload(PLAATJE_PAD, file, { upsert: true, contentType: file.type });
  if (error) { statusEl.textContent = 'Uploaden mislukt: ' + error.message; return; }
  input.value = '';
  statusEl.textContent = 'Geupload.';
  await renderPlaatje();
}
