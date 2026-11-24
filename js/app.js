// ========== MASTERPLAN APP ==========
// Alle data staat in de tabel `masterplan_data` (key/value, zie supabase/schema.sql).
// Drie keys: einddoel, deelplannen, acties. Simpele JSON-blobs i.p.v.
// losse tabellen per onderdeel -- makkelijk aan te passen zolang de opzet nog niet vaststaat.

// Haalt gegarandeerd de laatste versie op: een nieuwe, nog nooit gecachete
// URL (met een unieke querystring) omzeilt zowel de browsercache als een
// eventueel nog niet verlopen CDN-cache van GitHub Pages.
function verversNu() {
  location.href = location.pathname + '?r=' + Date.now();
}

let state = {
  einddoel: { tekst: '' },
  deelplannen: { items: [] },
  acties: { items: [] }
};

// SVG i.p.v. emoji: een 🗑️-emoji rendert op sommige systemen amper zichtbaar
// zonder kleur-emoji-lettertype. Dit icoon werkt overal hetzelfde.
const ICOON_PRULLENBAK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const ICOON_POTLOOD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICOON_OMHOOG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
const ICOON_OMLAAG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';

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
      if (actief && (['INPUT', 'TEXTAREA', 'SELECT'].includes(actief.tagName) || actief.isContentEditable)) return;
      ververDataStil();
    }, 60000);
  }
}
let autoVersGestart = false;
async function ververDataStil() {
  state.einddoel = await laadData('einddoel', { tekst: '' });
  state.deelplannen = await laadData('deelplannen', { items: [] });
  state.acties = await laadData('acties', { items: [] });
  state.tabnamen = await laadData('tabnamen', {});
  renderEinddoel();
  renderDeelplannen();
  renderActies();
  toepassenTabnamen();
}

// Tabnamen zijn direct aanpasbaar: klik op de AL ACTIEVE tab om te gaan
// typen (klikken op een niet-actieve tab wisselt gewoon van tabblad, zoals
// altijd). Geen potlood of knop nodig -- typen en de naam wordt automatisch
// opgeslagen, net als de rest van de site.
function navKlik(btn, view, span) {
  if (span.isContentEditable) return;
  if (btn.classList.contains('active')) {
    beginTabNaamBewerken(span);
  } else {
    gaNaar(view);
  }
}
function beginTabNaamBewerken(span) {
  span.contentEditable = 'true';
  span.spellcheck = false;
  span.focus();
  document.execCommand('selectAll');
}
function tabNaamKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  else if (e.key === 'Escape') {
    e.preventDefault();
    e.target.textContent = (state.tabnamen && state.tabnamen[e.target.dataset.tab]) || e.target.textContent;
    e.target.blur();
  }
}
function tabNaamBlur(span) {
  span.contentEditable = 'false';
  const naam = span.textContent.replace(/\s+/g, ' ').trim();
  if (!naam) { span.textContent = (state.tabnamen && state.tabnamen[span.dataset.tab]) || span.textContent; return; }
  span.textContent = naam;
  tabNaamInput(span);
}
let tabNaamAutoSaveTimer = null;
function tabNaamInput(span) {
  clearTimeout(tabNaamAutoSaveTimer);
  tabNaamAutoSaveTimer = setTimeout(async function () {
    const tab = span.dataset.tab;
    const naam = span.textContent.replace(/\s+/g, ' ').trim();
    if (!naam) return;
    state.tabnamen = state.tabnamen || {};
    state.tabnamen[tab] = naam;
    await bewaarData('tabnamen', state.tabnamen);
    const titelEl = document.querySelector('#view-' + tab + ' .card-title');
    if (titelEl) titelEl.textContent = naam;
  }, 800);
}
function toepassenTabnamen() {
  const namen = state.tabnamen || {};
  Object.keys(namen).forEach(function (tab) {
    const span = document.querySelector('.nav-label[data-tab="' + tab + '"]');
    if (span && !span.isContentEditable) span.textContent = namen[tab];
    const titelEl = document.querySelector('#view-' + tab + ' .card-title');
    if (titelEl) titelEl.textContent = namen[tab];
  });
}

function gaNaar(view) {
  const viewEl = document.getElementById('view-' + view);
  const navEl = document.querySelector('.nav-btn[data-view="' + view + '"]');
  // Een opgeslagen tabblad dat niet meer bestaat (bv. na het verwijderen van
  // een tab) mag het inloggen niet blokkeren -- gewoon negeren.
  if (!viewEl || !navEl) return;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  viewEl.classList.add('active');
  navEl.classList.add('active');
  try { sessionStorage.setItem('masterplan_tab', view); } catch (e) {}
}

// ===== EINDDOEL =====
function renderEinddoel() {
  // state.einddoel.tekst bevat HTML (vet/schuin via de toolbar) -- alleen
  // Ira/Anneke schrijven dit, dus innerHTML is hier geen risico.
  document.getElementById('einddoel-tekst').innerHTML = state.einddoel.tekst || '';
  const meta = state.einddoel.updatedAt
    ? 'Laatst bijgewerkt door ' + (state.einddoel.updatedBy || '?') + ' op ' + new Date(state.einddoel.updatedAt).toLocaleString('nl-NL')
    : 'Wordt automatisch opgeslagen terwijl je typt.';
  document.getElementById('einddoel-meta').textContent = meta;
}
// Automatisch opslaan i.p.v. een knop -- een halve seconde na de laatste
// toetsaanslag, zodat niets meer verloren gaat als je wegklikt of ververst
// voordat je zelf op Opslaan zou hebben gedrukt. Vermijdt renderEinddoel()
// (zou de cursor midden in het typen resetten) en update alleen de metatekst.
let einddoelAutoSaveTimer = null;
function autoSaveEinddoel() {
  clearTimeout(einddoelAutoSaveTimer);
  const metaEl = document.getElementById('einddoel-meta');
  metaEl.textContent = 'Bezig met opslaan...';
  einddoelAutoSaveTimer = setTimeout(async function () {
    state.einddoel = {
      tekst: document.getElementById('einddoel-tekst').innerHTML,
      updatedAt: new Date().toISOString(),
      updatedBy: window.loggedInNaam || ''
    };
    await bewaarData('einddoel', state.einddoel);
    metaEl.textContent = 'Automatisch opgeslagen om ' + new Date(state.einddoel.updatedAt).toLocaleTimeString('nl-NL');
  }, 800);
}
// Generieke vet/schuin/kleur-toolbar, herbruikbaar voor elk bewerkbaar veld
// (Einddoel, Omschrijving bij Deelplannen, ...) via data-voor="<veld-id>".
function rteCmd(veldId, cmd) {
  document.execCommand(cmd);
  updateRteToolbarVoor(veldId);
}
// Toont met een kleurtje op de V/S-knoppen of de cursor nu in vette/schuine
// tekst staat, net als in bekende tekstverwerkers. Werkt ook de kleurstreep
// onder de A-knop bij, zodat die de kleur op de cursorpositie toont.
function updateRteToolbarVoor(veldId) {
  const toolbar = document.querySelector('.rte-toolbar[data-voor="' + veldId + '"]');
  if (!toolbar) return;
  toolbar.querySelectorAll('.rte-btn[data-cmd]').forEach(function (btn) {
    btn.classList.toggle('actief', document.queryCommandState(btn.dataset.cmd));
  });
  const streep = document.getElementById('rte-kleur-streep-' + veldId);
  if (streep) {
    try {
      const kleur = document.queryCommandValue('foreColor');
      if (kleur) streep.style.background = kleur;
    } catch (e) {}
  }
}
// Klapt het kleurenpalet open/dicht onder de A-knop (zoals in PowerPoint).
// Sluit eerst andere open paletten, zodat er maar één tegelijk open staat.
function rteKleurToggle(veldId) {
  const dropdown = document.getElementById('rte-kleur-dropdown-' + veldId);
  if (!dropdown) return;
  const openNu = dropdown.style.display === 'grid';
  document.querySelectorAll('.rte-kleur-dropdown').forEach(function (el) { el.style.display = 'none'; });
  dropdown.style.display = openNu ? 'none' : 'grid';
}
function rteKleurKies(veldId, kleur) {
  const veld = document.getElementById(veldId);
  if (veld) {
    veld.focus();
    document.execCommand('foreColor', false, kleur);
  }
  const dropdown = document.getElementById('rte-kleur-dropdown-' + veldId);
  if (dropdown) dropdown.style.display = 'none';
  updateRteToolbarVoor(veldId);
}
// Achtergrondkleur voor tekst, zelfde bediening als de tekstkleur hierboven.
function rteAchtergrondToggle(veldId) {
  const dropdown = document.getElementById('rte-achtergrond-dropdown-' + veldId);
  if (!dropdown) return;
  const openNu = dropdown.style.display === 'grid';
  document.querySelectorAll('.rte-kleur-dropdown').forEach(function (el) { el.style.display = 'none'; });
  dropdown.style.display = openNu ? 'none' : 'grid';
}
function rteAchtergrondKies(veldId, kleur) {
  const veld = document.getElementById(veldId);
  if (veld) {
    veld.focus();
    try {
      document.execCommand('hiliteColor', false, kleur);
    } catch (e) {
      document.execCommand('backColor', false, kleur);
    }
  }
  const dropdown = document.getElementById('rte-achtergrond-dropdown-' + veldId);
  if (dropdown) dropdown.style.display = 'none';
  const streep = document.getElementById('rte-achtergrond-streep-' + veldId);
  if (streep) {
    if (kleur === 'transparent') { streep.style.background = ''; streep.classList.add('rte-kleur-streep-leeg'); }
    else { streep.style.background = kleur; streep.classList.remove('rte-kleur-streep-leeg'); }
  }
  updateRteToolbarVoor(veldId);
}
// Klik buiten een open kleurenpalet sluit het weer.
document.addEventListener('click', function (e) {
  if (e.target.closest('.rte-kleur-wrap')) return;
  document.querySelectorAll('.rte-kleur-dropdown').forEach(function (el) { el.style.display = 'none'; });
});
// Herbruikbare HTML voor de A-knop + het kleurenpalet, voor dynamisch
// gegenereerde toolbars (bijv. bij het bewerken van een deelplan).
function rteKleurHtml(veldId) {
  const kleuren = [
    ['#2a2a2a', 'Standaard'], ['#4a7c59', 'Groen'], ['#b8860b', 'Goud'], ['#c0392b', 'Rood'],
    ['#2e6da4', 'Blauw'], ['#c8855a', 'Oranje'], ['#7d5ba6', 'Paars'], ['#6b6b6b', 'Grijs']
  ];
  const vakjes = kleuren.map(function (k) {
    return `<button type="button" class="rte-kleur-vak" style="background:${k[0]}" onmousedown="event.preventDefault()" onclick="rteKleurKies('${veldId}','${k[0]}')" title="${k[1]}"></button>`;
  }).join('');
  return `
      <div class="rte-kleur-wrap">
        <button type="button" class="rte-btn rte-btn-kleur" onmousedown="event.preventDefault()" onclick="rteKleurToggle('${veldId}')" title="Tekstkleur">
          <span style="font-weight:700">A</span>
          <span class="rte-kleur-streep" id="rte-kleur-streep-${veldId}" style="background:#2a2a2a"></span>
        </button>
        <div class="rte-kleur-dropdown" id="rte-kleur-dropdown-${veldId}" style="display:none">${vakjes}</div>
      </div>`;
}
// Herbruikbare HTML voor de achtergrondkleur-knop + palet.
function rteAchtergrondHtml(veldId) {
  const kleuren = [
    ['transparent', 'Geen'], ['#fff3b0', 'Geel'], ['#d7f0df', 'Groen'], ['#d7e8f7', 'Blauw'],
    ['#fbdde4', 'Roze'], ['#fde3cf', 'Oranje'], ['#e8def8', 'Paars'], ['#e6e6e6', 'Grijs']
  ];
  const vakjes = kleuren.map(function (k) {
    const stijl = k[0] === 'transparent'
      ? 'background:repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0/8px 8px'
      : 'background:' + k[0];
    return `<button type="button" class="rte-kleur-vak" style="${stijl}" onmousedown="event.preventDefault()" onclick="rteAchtergrondKies('${veldId}','${k[0]}')" title="${k[1]}"></button>`;
  }).join('');
  return `
      <div class="rte-kleur-wrap">
        <button type="button" class="rte-btn rte-btn-kleur rte-btn-achtergrond" onmousedown="event.preventDefault()" onclick="rteAchtergrondToggle('${veldId}')" title="Achtergrondkleur">
          <span>Abc</span>
          <span class="rte-kleur-streep rte-kleur-streep-leeg" id="rte-achtergrond-streep-${veldId}"></span>
        </button>
        <div class="rte-kleur-dropdown" id="rte-achtergrond-dropdown-${veldId}" style="display:none">${vakjes}</div>
      </div>`;
}

// ===== DEELPLANNEN =====
// Titel en omschrijving staan altijd direct open om in te typen (geen aparte
// bewerk-modus meer) -- scheelt een potlood-klik en een Klaar-knop.
function renderDeelplannen() {
  const lijst = document.getElementById('deelplan-lijst');
  const items = state.deelplannen.items || [];
  document.getElementById('deelplan-leeg').style.display = items.length ? 'none' : '';
  lijst.innerHTML = items.map((d, i) => deelplanItemHtml(d, i, items.length)).join('');
}
function deelplanItemHtml(d, i, aantal) {
  const veldId = 'de-omschrijving-' + d.id;
  return `
    <div class="deelplan-item">
      <div class="deelplan-header">
        <input id="de-titel-${d.id}" value="${escapeHtml(d.titel || '')}" oninput="autoSaveDeelplan('${d.id}')" style="flex:1;margin-right:10px;padding:9px 12px;border:1.5px solid var(--sand-dark);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600">
        <span style="display:flex;gap:6px;flex-shrink:0">
          <button class="actie-del" onclick="verplaatsDeelplan('${d.id}', -1)" title="Omhoog" ${i === 0 ? 'disabled style="opacity:.25;cursor:default"' : ''}>${ICOON_OMHOOG}</button>
          <button class="actie-del" onclick="verplaatsDeelplan('${d.id}', 1)" title="Omlaag" ${i === aantal - 1 ? 'disabled style="opacity:.25;cursor:default"' : ''}>${ICOON_OMLAAG}</button>
          <button class="actie-del" onclick="verwijderDeelplan('${d.id}')" title="Verwijderen">${ICOON_PRULLENBAK}</button>
        </span>
      </div>
      <div class="rte-toolbar" data-voor="${veldId}">
        <button type="button" class="rte-btn" data-cmd="bold" onmousedown="event.preventDefault()" onclick="rteCmd('${veldId}','bold')" title="Vet"><b>V</b></button>
        <button type="button" class="rte-btn" data-cmd="italic" onmousedown="event.preventDefault()" onclick="rteCmd('${veldId}','italic')" title="Schuin"><i>S</i></button>
        ${rteKleurHtml(veldId)}
        ${rteAchtergrondHtml(veldId)}
      </div>
      <div id="${veldId}" class="rte-veld" contenteditable="true" style="min-height:70px" oninput="autoSaveDeelplan('${d.id}')" onkeyup="updateRteToolbarVoor('${veldId}')" onmouseup="updateRteToolbarVoor('${veldId}')">${d.omschrijving || ''}</div>
      <div style="margin-top:10px">
        <span id="de-status-${d.id}" style="font-size:12px;color:var(--muted)">Wordt automatisch opgeslagen terwijl je typt.</span>
      </div>
    </div>
  `;
}
// Automatisch opslaan i.p.v. Opslaan/Annuleren-knoppen -- voorkomt dat
// wijzigingen verloren gaan als je wegklikt vóór je zelf zou opslaan.
// Herrendert bewust niets (zou de cursor resetten), alleen het statustekstje.
let deelplanAutoSaveTimer = null;
function autoSaveDeelplan(id) {
  clearTimeout(deelplanAutoSaveTimer);
  const statusEl = document.getElementById('de-status-' + id);
  if (statusEl) statusEl.textContent = 'Bezig met opslaan...';
  deelplanAutoSaveTimer = setTimeout(async function () {
    const d = (state.deelplannen.items || []).find(x => x.id === id);
    const titelEl = document.getElementById('de-titel-' + id);
    const omschrijvingEl = document.getElementById('de-omschrijving-' + id);
    if (!d || !titelEl || !omschrijvingEl) return;
    const titel = titelEl.value.trim();
    if (!titel) { if (statusEl) statusEl.textContent = 'Naam mag niet leeg zijn.'; return; }
    d.titel = titel;
    d.omschrijving = omschrijvingEl.innerHTML.trim();
    await bewaarData('deelplannen', state.deelplannen);
    if (statusEl) statusEl.textContent = 'Automatisch opgeslagen om ' + new Date().toLocaleTimeString('nl-NL');
  }, 800);
}
async function verplaatsDeelplan(id, richting) {
  const items = state.deelplannen.items || [];
  const i = items.findIndex(d => d.id === id);
  const j = i + richting;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await bewaarData('deelplannen', state.deelplannen);
  renderDeelplannen();
}
async function voegDeelplanToe() {
  const titel = document.getElementById('deelplan-titel').value.trim();
  // omschrijving bevat HTML (vet/schuin via de toolbar) -- alleen Ira/Anneke
  // schrijven dit, dus innerHTML is hier geen risico.
  const omschrijving = document.getElementById('deelplan-omschrijving').innerHTML.trim();
  if (!titel) return;
  state.deelplannen.items = state.deelplannen.items || [];
  state.deelplannen.items.push({ id: nieuwId(), titel, omschrijving });
  await bewaarData('deelplannen', state.deelplannen);
  document.getElementById('deelplan-titel').value = '';
  document.getElementById('deelplan-omschrijving').innerHTML = '';
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
        <input id="ae-titel-${a.id}" class="actie-titel-input" oninput="autoSaveActie('${a.id}')" value="${escapeHtml(actieTitel(a))}">
        <textarea id="ae-details-${a.id}" class="actie-input" rows="1" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';autoSaveActie('${a.id}')">${escapeHtml(actieDetails(a))}</textarea>
      </div>
      <select id="ae-status-${a.id}" class="col-status" onchange="autoSaveActie('${a.id}')">
        <option value="te-doen" ${a.status === 'te-doen' ? 'selected' : ''}>Te doen</option>
        <option value="bezig" ${a.status === 'bezig' ? 'selected' : ''}>Bezig</option>
        <option value="klaar" ${a.status === 'klaar' ? 'selected' : ''}>Klaar</option>
      </select>
      <select id="ae-wie-${a.id}" class="col-wie" onchange="autoSaveActie('${a.id}')">
        <option value="Samen" ${a.wie === 'Samen' ? 'selected' : ''}>Samen</option>
        <option value="Ira" ${a.wie === 'Ira' ? 'selected' : ''}>Ira</option>
        <option value="Anneke" ${a.wie === 'Anneke' ? 'selected' : ''}>Anneke</option>
      </select>
      <input id="ae-datum-${a.id}" type="date" class="col-datum" value="${a.datum || ''}" onchange="autoSaveActie('${a.id}')">
      <button class="btn-sm" onclick="sluitBewerkActie()">Klaar</button>
    </div>
    <div id="ae-status-tekst-${a.id}" style="font-size:12px;color:var(--muted);margin:-8px 0 8px 36px">Wordt automatisch opgeslagen terwijl je typt.</div>
  `;
}
function bewerkActie(id) {
  bewerkActieId = id;
  renderActies();
  const veld = document.getElementById('ae-details-' + id);
  if (veld) { veld.style.height = 'auto'; veld.style.height = veld.scrollHeight + 'px'; }
}
function sluitBewerkActie() { bewerkActieId = null; renderActies(); }
// Automatisch opslaan i.p.v. Opslaan/Annuleren-knoppen -- zie autoSaveDeelplan
// hierboven voor dezelfde aanpak en reden.
let actieAutoSaveTimer = null;
function autoSaveActie(id) {
  clearTimeout(actieAutoSaveTimer);
  const statusEl = document.getElementById('ae-status-tekst-' + id);
  if (statusEl) statusEl.textContent = 'Bezig met opslaan...';
  actieAutoSaveTimer = setTimeout(async function () {
    await slaOpBewerkteActieStil(id, statusEl);
  }, 800);
}
async function slaOpBewerkteActieStil(id, statusEl) {
  const a = (state.acties.items || []).find(x => x.id === id);
  const titelEl = document.getElementById('ae-titel-' + id);
  if (!a || !titelEl) return;
  const titel = titelEl.value.trim();
  if (!titel) { if (statusEl) statusEl.textContent = 'Tekst mag niet leeg zijn.'; return; }
  a.titel = titel;
  a.details = document.getElementById('ae-details-' + id).value.trim();
  delete a.tekst;
  a.status = document.getElementById('ae-status-' + id).value;
  a.wie = document.getElementById('ae-wie-' + id).value;
  a.datum = document.getElementById('ae-datum-' + id).value || null;
  await bewaarData('acties', state.acties);
  if (statusEl) statusEl.textContent = 'Automatisch opgeslagen om ' + new Date().toLocaleTimeString('nl-NL');
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
