'use strict';

/* ================= 設定 ================= */
const CONFIG = {
  owner: 'jordanliu1225',
  repo: 'albion-roster',
  branch: 'main',
  file: 'roster.json',
  pollMs: 15000,      // 平常每 15 秒檢查一次
  fastPollMs: 5000,   // 剛儲存、等待發布時每 5 秒檢查
};
const LS_TOKEN = 'albionRoster.token';
const LS_ME = 'albionRoster.me';
const LS_PENDING = 'albionRoster.pending';
const PENDING_TTL = 10 * 60 * 1000;

const ROLES = {
  tank: { zh: '坦克', en: 'TANK', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5l-8-3z"/></svg>' },
  dps: { zh: '輸出', en: 'DPS', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg>' },
  support: { zh: '輔助', en: 'SUPPORT', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>' },
  healer: { zh: '治療', en: 'HEALER', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"/></svg>' },
};

// 武器/裝備名稱 → Albion 道具 ID(圖示來自 render.albiononline.com)
const ITEMS = [
  [['heavy mace'], 'T8_2H_MACE', 'Heavy Mace', '重型錘矛'],
  [['incubus', 'incubus mace'], 'T8_MAIN_MACE_HELL', 'Incubus Mace', '夢魘錘矛'],
  [['hammer'], 'T8_MAIN_HAMMER', 'Hammer', '鎚子'],
  [['earthrune', 'earthrune staff'], 'T8_2H_SHAPESHIFTER_KEEPER', 'Earthrune Staff', '大地符文法杖'],
  [['forge hammer', 'forge hammers'], 'T8_2H_DUALHAMMER_HELL', 'Forge Hammers', '鍛造鎚'],
  [['melee'], null, 'Melee', '近戰(自選)'],
  [['lightcaller'], 'T8_2H_SHAPESHIFTER_AVALON', 'Lightcaller', '光之召喚者'],
  [['dawnsong'], 'T8_2H_FIRE_RINGPAIR_AVALON', 'Dawnsong', '暮歌之戒'],
  [['gloves'], 'T8_2H_KNUCKLES_SET1', 'Gloves', '拳套(自選)'],
  [['shadowcaller'], 'T8_MAIN_CURSEDSTAFF_AVALON', 'Shadowcaller', '喚影者'],
  [['rootbound', 'rootbound staff'], 'T8_2H_SHAPESHIFTER_SET2', 'Rootbound Staff', '林語者法杖'],
  [['oath', 'oathkeeper', 'oathkeepers'], 'T8_2H_DUALMACE_AVALON', 'Oathkeepers', '守誓者'],
  [['evensong'], 'T8_2H_ARCANE_RINGPAIR_AVALON', 'Evensong', '夜禱之戒'],
  [['ga', 'great arcane', 'great arcane staff'], 'T8_2H_ARCANESTAFF', 'Great Arcane Staff', '祕術長杖'],
  [['occu', 'occult', 'occult staff'], 'T8_2H_ARCANESTAFF_HELL', 'Occult Staff', '奧祕法杖'],
  [['redemption', 'redemption staff'], 'T8_2H_HOLYSTAFF_UNDEAD', 'Redemption Staff', '贖罪法杖'],
  [['fallen', 'fallen staff'], 'T8_2H_HOLYSTAFF_HELL', 'Fallen Staff', '墮落法杖'],
  [['blight', 'blight staff'], 'T8_2H_NATURESTAFF_HELL', 'Blight Staff', '瘟疫法杖'],
  [['royal armor'], 'T8_ARMOR_PLATE_ROYAL', 'Royal Armor', '皇家護甲'],
  [['royal jacket'], 'T8_ARMOR_LEATHER_ROYAL', 'Royal Jacket', '皇家外套'],
  [['royal robe'], 'T8_ARMOR_CLOTH_ROYAL', 'Royal Robe', '皇家長袍'],
  [['pve weapon', 'pve'], null, 'PvE Weapon', 'PvE 武器'],
];

/* ================= 小工具 ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕模式等 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const ITEM_INDEX = new Map();
for (const [aliases, id, en, zh] of ITEMS) for (const a of aliases) ITEM_INDEX.set(a, { id, en, zh });

function lookup(name) {
  const n = norm(name);
  if (!n) return null;
  return ITEM_INDEX.get(n) || ITEM_INDEX.get(n.replace(/s$/, '')) || null;
}

// "Royal Armor bring occu" → [穿 Royal Armor] [帶 Occult Staff]
function parseNote(note) {
  const text = String(note || '').trim();
  if (!text) return [];
  const [wear, ...rest] = text.split(/\bbring\b/i);
  const chips = [];
  const w = wear.trim();
  if (w) {
    const item = lookup(w);
    chips.push({ kind: item ? 'wear' : 'info', text: w, item });
  }
  const b = rest.join(' bring ').trim();
  if (b) {
    for (const part of b.split(/\s*(?:,|\+|&|\/|\band\b)\s*/i).filter(Boolean)) {
      chips.push({ kind: 'bring', text: part, item: lookup(part) });
    }
  }
  return chips;
}

const iconUrl = (id, size) => `https://render.albiononline.com/v1/item/${id}.png?size=${size}`;
function iconImg(id, alt, size) {
  const img = h('img', { src: iconUrl(id, size), alt: alt || '', loading: 'lazy', decoding: 'async', width: size, height: size });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: 'glyph' }, '⚔')), { once: true });
  return img;
}

const roleOf = g => ROLES[g.role] || { zh: '隊伍', en: '', svg: ROLES.support.svg };
const pad2 = n => String(n).padStart(2, '0');
const allSlots = d => d.groups.flatMap((g, gi) => g.slots.map((s, si) => ({ s, g, gi, si })));
const isFilled = s => !!String(s.player || '').trim();

function rel(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = (Date.now() - t) / 1000;
  if (sec < 60) return '剛剛';
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`;
  return new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

let toastTimer = null;
function toast(msg, ms = 3200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ================= 狀態 ================= */
const state = {
  data: null,        // 目前顯示的名單
  draft: null,       // 編輯中的副本
  editing: false,
  editComp: false,
  dirty: false,
  baseRev: 0,
  pending: null,     // 剛儲存、等待 GitHub Pages 發布的 rev
  error: null,
  query: '',
  login: null,
  remoteWhileEditing: null,
};
const view = () => (state.editing ? state.draft : state.data);

/* ================= 讀取 / 同步 ================= */
let pollTimer = null;
let polling = false;

async function fetchPublic() {
  const res = await fetch(`${CONFIG.file}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.groups)) throw new Error('名單格式錯誤');
  return data;
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, state.pending ? CONFIG.fastPollMs : CONFIG.pollMs);
}

async function poll() {
  clearTimeout(pollTimer);
  if (polling) return;
  if (document.hidden && state.data) return; // 分頁在背景時暫停,回來時立刻檢查
  polling = true;
  try {
    const remote = await fetchPublic();
    state.error = null;
    applyRemote(remote);
  } catch (e) {
    state.error = e;
    if (!state.data) $('#board').replaceChildren(h('div', { class: 'board-error' }, '⚠ 名單載入失敗,自動重試中…'));
  } finally {
    polling = false;
    renderLive();
    schedulePoll();
  }
}

function readPending() {
  try {
    const p = JSON.parse(store.get(LS_PENDING) || 'null');
    if (!p || !p.data || Date.now() - p.at > PENDING_TTL) { store.del(LS_PENDING); return null; }
    return p;
  } catch { store.del(LS_PENDING); return null; }
}

function applyRemote(remote) {
  const rRev = remote.rev || 0;
  const pending = readPending();
  if (pending) {
    if (rRev >= pending.rev) {
      store.del(LS_PENDING);
      if (state.pending) toast('✅ 新名單已同步給所有人');
      state.pending = null;
    } else {
      // GitHub Pages 還在發布,先顯示自己剛存的版本
      state.pending = pending.rev;
      if (!state.data) { state.data = pending.data; render(); }
      return;
    }
  }
  if (!state.data) { state.data = remote; render(); return; }
  if (rRev < (state.data.rev || 0)) return;
  if (JSON.stringify(remote) === JSON.stringify(state.data)) return;
  if (state.editing) { state.remoteWhileEditing = remote; return; }
  const changed = diffSlots(state.data, remote);
  state.data = remote;
  render(changed);
  toast(changed.size ? `🔄 名單已更新(${changed.size} 個位置有變動)` : '🔄 名單已更新');
}

function diffSlots(a, b) {
  const pa = allSlots(a), pb = allSlots(b);
  const out = new Set();
  pb.forEach(({ s }, i) => {
    const old = pa[i] && pa[i].s;
    if (!old || norm(old.player) !== norm(s.player) || old.weapon !== s.weapon || old.note !== s.note) out.add(i);
  });
  return out;
}

/* ================= 畫面 ================= */
function render(changed = new Set()) {
  const d = view();
  if (!d) return;
  renderHeader(d);
  renderOverview(d);
  renderBoard(d, changed);
  renderLive();
  applySearch();
}

function renderHeader(d) {
  const ev = d.event || {};
  const title = ev.title || '隊伍名單';
  $('#title').textContent = title;
  document.title = `${title} · Albion`;
  const meta = $('#eventMeta');
  meta.replaceChildren();
  if (!state.editing) {
    if (ev.time) meta.append(h('span', { class: 'meta-chip' }, '🕘 ', ev.time));
    if (ev.note) meta.append(h('span', { class: 'meta-chip' }, '📢 ', ev.note));
  }
  meta.hidden = !meta.children.length;
}

function renderOverview(d) {
  const slots = allSlots(d);
  const filled = slots.filter(x => isFilled(x.s)).length;
  $('#filledNum').textContent = filled;
  $('#totalNum').textContent = slots.length;
  $('.fill').classList.toggle('full', slots.length > 0 && filled === slots.length);

  const bar = $('#segbar');
  bar.replaceChildren();
  let i = 0;
  for (const g of d.groups) {
    const grp = h('div', { class: `seg-group role-${g.role || 'other'}`, style: `flex:${g.slots.length} 1 0` });
    for (const s of g.slots) {
      const w = lookup(s.weapon);
      i++;
      grp.append(h('div', { class: 'seg' + (isFilled(s) ? ' on' : ''), title: `#${pad2(i)} ${w ? w.en : s.weapon} — ${isFilled(s) ? s.player.trim() : '空缺'}` }));
    }
    bar.append(grp);
  }

  const legend = $('#legend');
  legend.replaceChildren(...d.groups.map(g => {
    const n = g.slots.filter(isFilled).length;
    return h('span', { class: `role-${g.role || 'other'}` }, h('i'), g.name || roleOf(g).zh, ' ', h('b', {}, `${n}/${g.slots.length}`));
  }));

  document.querySelectorAll('.group-count').forEach(el => {
    const g = d.groups[+el.dataset.g];
    if (!g) return;
    const n = g.slots.filter(isFilled).length;
    el.textContent = `${n}/${g.slots.length}`;
    el.classList.toggle('full', n === g.slots.length);
  });
}

function emblem(role) {
  const el = h('span', { class: 'role-emblem', 'aria-hidden': 'true' });
  el.innerHTML = role.svg; // 固定的內建 SVG 字串
  return el;
}

function renderBoard(d, changed) {
  const board = $('#board');
  board.replaceChildren();
  board.classList.toggle('auto', d.groups.length !== 4);
  let idx = 0;
  d.groups.forEach((g, gi) => {
    const role = roleOf(g);
    const n = g.slots.filter(isFilled).length;
    const head = h('header', { class: 'group-head' },
      emblem(role),
      h('div', { class: 'group-title' }, g.name || role.zh, role.en ? h('small', {}, role.en) : null),
      h('span', { class: 'group-count' + (n === g.slots.length ? ' full' : ''), 'data-g': gi }, `${n}/${g.slots.length}`));
    const list = h('div', { class: 'slots' });
    g.slots.forEach((s, si) => {
      list.append(renderSlot(s, gi, si, idx, changed.has(idx)));
      idx++;
    });
    board.append(h('section', { class: `group g${gi} role-${g.role || 'other'}` }, head, list));
  });
}

function slotIcon(s, idx) {
  const w = lookup(s.weapon);
  return h('div', { class: 'slot-icon', title: w ? `${w.en}・${w.zh}` : (s.weapon || '') },
    h('span', { class: 'slot-no' }, pad2(idx + 1)),
    w && w.id ? iconImg(w.id, w.en, 96) : h('span', { class: 'glyph' }, '⚔'));
}

function chipEl(c) {
  const label = c.kind === 'wear' ? '穿' : c.kind === 'bring' ? '帶' : null;
  return h('span', { class: `chip k-${c.kind}`, title: c.item ? c.item.zh : null },
    label ? h('b', {}, label) : null,
    c.item && c.item.id ? iconImg(c.item.id, c.item.en, 44) : null,
    h('span', {}, c.item ? c.item.en : c.text));
}

function renderSlot(s, gi, si, idx, flash) {
  const name = String(s.player || '').trim();
  const w = lookup(s.weapon);
  const el = h('article', { class: `slot ${name ? 'is-filled' : 'is-open'}${flash ? ' flash' : ''}`, 'data-idx': idx });
  el.dataset.player = norm(name);

  const info = h('div', { class: 'slot-info' });
  let chips = null;
  if (state.editing && state.editComp) {
    info.append(compInputs(s));
  } else {
    info.append(h('div', { class: 'w-en' }, w ? w.en : (s.weapon || '—')));
    if (w && w.zh) info.append(h('div', { class: 'w-zh' }, w.zh));
    const list = parseNote(s.note);
    if (list.length) chips = h('div', { class: 'chips' }, list.map(chipEl));
  }

  const player = h('div', { class: 'slot-player' });
  if (state.editing) player.append(playerInput(s, idx));
  else if (name) player.append(h('span', { class: 'p-at' }, '@'), h('span', { class: 'p-name', title: name }, name));
  else player.append(h('span', { class: 'p-open' }, '空缺 · OPEN'));

  el.append(h('div', { class: 'slot-top' }, slotIcon(s, idx), info), chips || '', player);
  return el;
}

function playerInput(s, idx) {
  const inp = h('input', { class: 'inp', type: 'text', placeholder: '輸入玩家名字', 'data-idx': idx, autocomplete: 'off', spellcheck: 'false', maxlength: '40', 'aria-label': `第 ${idx + 1} 位玩家` });
  inp.value = s.player || '';
  inp.addEventListener('input', () => {
    s.player = inp.value;
    state.dirty = true;
    const slot = inp.closest('.slot');
    const f = !!inp.value.trim();
    slot.classList.toggle('is-filled', f);
    slot.classList.toggle('is-open', !f);
    renderOverview(state.draft);
  });
  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = document.querySelector(`.slot-player input[data-idx="${idx + 1}"]`);
    if (next) next.focus(); else inp.blur();
  });
  return inp;
}

function compInputs(s) {
  const wInp = h('input', { class: 'inp', type: 'text', placeholder: '武器(例:heavy mace)', 'aria-label': '武器', spellcheck: 'false' });
  const nInp = h('input', { class: 'inp', type: 'text', placeholder: '備註(例:bring incubus)', 'aria-label': '備註', spellcheck: 'false' });
  wInp.value = s.weapon || '';
  nInp.value = s.note || '';
  wInp.addEventListener('input', () => {
    s.weapon = wInp.value;
    state.dirty = true;
    const slot = wInp.closest('.slot');
    slot.querySelector('.slot-icon').replaceWith(slotIcon(s, +slot.dataset.idx));
  });
  nInp.addEventListener('input', () => { s.note = nInp.value; state.dirty = true; });
  return h('div', { class: 'comp-edit' }, wInp, nInp);
}

function renderLive() {
  const live = $('#live'), txt = $('#liveText');
  live.classList.remove('pending', 'error', 'editing');
  const d = state.data;
  if (state.editing) {
    live.classList.add('editing');
    txt.textContent = '編輯中 — 按「儲存並同步」後其他人才會看到';
  } else if (state.pending) {
    live.classList.add('pending');
    txt.textContent = '已儲存,發布中… 約 1 分鐘內所有人同步';
  } else if (state.error) {
    live.classList.add('error');
    txt.textContent = '連線中斷,自動重試中…';
  } else if (d) {
    txt.textContent = `即時同步中 · 最後更新 ${rel(d.updatedAt)}${d.updatedBy ? ` · ${d.updatedBy}` : ''}`;
  }
}

/* ================= 搜尋 ================= */
function applySearch() {
  const q = norm(state.query);
  const board = $('#board');
  const out = $('#searchResult');
  const d = view();
  board.querySelectorAll('.slot').forEach(el => {
    el.classList.toggle('is-match', !!q && !state.editing && el.dataset.player.includes(q));
  });
  board.classList.toggle('searching', !!q && !state.editing);
  out.replaceChildren();
  if (!q || !d || state.editing) return;
  const hits = allSlots(d).map((x, i) => ({ ...x, i })).filter(x => norm(x.s.player).includes(q));
  if (!hits.length) { out.textContent = '名單上還沒有這個名字'; return; }
  out.append('你在 ');
  for (const x of hits.slice(0, 4)) {
    const w = lookup(x.s.weapon);
    out.append(h('button', { type: 'button', onclick: () => scrollToSlot(x.i) }, `#${pad2(x.i + 1)} ${w ? w.en : x.s.weapon}(${x.g.name || roleOf(x.g).zh})`));
  }
}

function scrollToSlot(i) {
  const el = document.querySelector(`.slot[data-idx="${i}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* ================= Discord 格式 ================= */
function toDiscord(d) {
  return d.groups.map(g => g.slots.map(s => {
    const name = String(s.player || '').trim();
    return `${s.weapon}${s.note ? ` (${s.note})` : ''} - @${name}`;
  }).join('\n')).join('\n\n');
}

function parsePaste(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(.*?)\s+[-–—]\s*(.*)$/);
    const right = m ? m[2] : line;
    return right.replace(/^@+/, '').trim();
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;left:-9999px;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

/* ================= GitHub API(隊長編輯用) ================= */
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

async function gh(path, opts = {}, token = store.get(LS_TOKEN)) {
  const res = await fetch(`https://api.github.com${path}`, {
    cache: 'no-store',
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status}`);
    err.status = res.status;
    try { err.detail = (await res.json()).message; } catch { /* ignore */ }
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const contentsPath = () => `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.file}`;

async function ghGetFile() {
  const j = await gh(`${contentsPath()}?ref=${CONFIG.branch}`);
  return { sha: j.sha, data: JSON.parse(b64decode(j.content)) };
}

async function ghLogin() {
  if (state.login) return state.login;
  try { state.login = (await gh('/user')).login; } catch { state.login = ''; }
  return state.login;
}

function explainError(e) {
  if (e.status === 401) return '權杖無效或已過期,請重新登入';
  if (e.status === 403 || e.status === 404) return '權杖沒有這個 repo 的寫入權限(Contents 要設 Read and write)';
  if (e.status === 409) return '剛好有人同時儲存,請再按一次儲存';
  if (e.status === 422) return `GitHub 拒絕這次寫入:${e.detail || '格式錯誤'}`;
  if (e.status) return `GitHub 錯誤 ${e.status}:${e.detail || ''}`;
  return '網路錯誤,請稍後再試';
}

/* ================= 編輯流程 ================= */
function openLogin(msg = '') {
  $('#loginMsg').textContent = msg;
  $('#loginDlg').showModal();
  $('#tokenInput').focus();
}

async function submitLogin(e) {
  e.preventDefault();
  const token = $('#tokenInput').value.trim();
  const msg = $('#loginMsg');
  if (!token) { msg.textContent = '請貼上權杖'; return; }
  const btn = $('#loginSubmit');
  btn.disabled = true;
  msg.textContent = '驗證中…';
  try {
    await gh(`/repos/${CONFIG.owner}/${CONFIG.repo}`, {}, token);
    store.set(LS_TOKEN, token);
    state.login = null;
    $('#tokenInput').value = '';
    $('#loginDlg').close();
    updateEditBtn();
    await startEdit();
  } catch (err) {
    msg.textContent = explainError(err);
  } finally {
    btn.disabled = false;
  }
}

function updateEditBtn() {
  $('#editBtn').textContent = store.get(LS_TOKEN) ? '✏️ 編輯名單' : '🔒 隊長編輯';
}

async function startEdit() {
  if (!state.data) return;
  if (!store.get(LS_TOKEN)) { openLogin(); return; }
  const btn = $('#editBtn');
  btn.disabled = true;
  let base = state.data;
  try {
    base = (await ghGetFile()).data; // 直接從 GitHub 拿最新版,不等 Pages 發布
  } catch (e) {
    if (e.status === 401) { store.del(LS_TOKEN); updateEditBtn(); btn.disabled = false; openLogin('權杖無效或已過期,請重新貼上'); return; }
  }
  btn.disabled = false;
  if ((state.data.rev || 0) > (base.rev || 0)) base = state.data;
  state.draft = structuredClone(base);
  state.baseRev = base.rev || 0;
  state.editing = true;
  state.editComp = false;
  state.dirty = false;
  state.remoteWhileEditing = null;
  $('#compToggle').checked = false;
  document.body.classList.add('editing');
  $('#editbar').hidden = false;
  $('#editBtn').hidden = true;
  const ev = state.draft.event || (state.draft.event = {});
  $('#evTitle').value = ev.title || '';
  $('#evTime').value = ev.time || '';
  $('#evNote').value = ev.note || '';
  $('#eventEdit').hidden = false;
  render();
  const first = document.querySelector('.slot-player input');
  if (first && window.matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
}

function exitEdit() {
  state.editing = false;
  state.draft = null;
  state.dirty = false;
  document.body.classList.remove('editing');
  $('#editbar').hidden = true;
  $('#eventEdit').hidden = true;
  $('#editBtn').hidden = false;
  render();
  const r = state.remoteWhileEditing;
  state.remoteWhileEditing = null;
  if (r) applyRemote(r);
}

async function save() {
  const btn = $('#saveBtn');
  btn.disabled = true;
  btn.textContent = '儲存中…';
  try {
    const latest = await ghGetFile();
    const latestRev = latest.data.rev || 0;
    if (latestRev !== state.baseRev &&
        !confirm('你編輯的這段時間,名單已經被其他人更新過。\n確定要用你的版本覆蓋嗎?')) return;
    const login = await ghLogin();
    const draft = structuredClone(state.draft);
    for (const g of draft.groups) for (const s of g.slots) {
      s.player = String(s.player || '').trim();
      s.weapon = String(s.weapon || '').trim();
      s.note = String(s.note || '').trim();
    }
    const next = { ...draft, rev: latestRev + 1, updatedAt: new Date().toISOString(), updatedBy: login || '' };
    const filled = allSlots(next).filter(x => isFilled(x.s)).length;
    await gh(contentsPath(), {
      method: 'PUT',
      body: JSON.stringify({
        message: `roster: rev ${next.rev} (${filled}/${allSlots(next).length}) by ${login || 'captain'}`,
        content: b64encode(JSON.stringify(next, null, 2) + '\n'),
        sha: latest.sha,
        branch: CONFIG.branch,
      }),
    });
    store.set(LS_PENDING, JSON.stringify({ rev: next.rev, data: next, at: Date.now() }));
    state.pending = next.rev;
    const changed = diffSlots(state.data, next);
    state.data = next;
    state.remoteWhileEditing = null;
    exitEdit();
    render(changed);
    toast('💾 已儲存!約 1 分鐘內所有人的頁面會自動更新', 4500);
    schedulePoll();
  } catch (e) {
    if (e.status === 401) { store.del(LS_TOKEN); updateEditBtn(); openLogin('權杖無效或已過期,請重新貼上(你的修改還在)'); }
    else toast('⚠ ' + explainError(e), 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 儲存並同步';
  }
}

function applyPaste(e) {
  e.preventDefault();
  const names = parsePaste($('#pasteInput').value);
  const slots = allSlots(state.draft);
  if (!names.length) { $('#pasteMsg').textContent = '沒有讀到任何內容'; return; }
  slots.forEach((x, i) => { if (i < names.length) x.s.player = names[i]; });
  state.dirty = true;
  $('#pasteDlg').close();
  render();
  const n = Math.min(names.length, slots.length);
  if (names.length !== slots.length) toast(`⚠ 貼上 ${names.length} 行,位置有 ${slots.length} 個 — 已照順序填入前 ${n} 個,請檢查`, 6000);
  else toast(`📥 已填入 ${names.filter(Boolean).length} 個名字,確認後按「儲存並同步」`, 4500);
}

/* ================= 綁定事件 ================= */
function bindUI() {
  $('.repo-name').textContent = CONFIG.repo;
  updateEditBtn();

  const search = $('#search');
  search.addEventListener('input', () => {
    state.query = search.value;
    store.set(LS_ME, search.value.trim());
    applySearch();
  });
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const b = $('#searchResult button'); if (b) b.click(); }
  });

  $('#copyBtn').addEventListener('click', async () => {
    const d = view();
    if (!d) return;
    toast(await copyText(toDiscord(d)) ? '📋 已複製,直接貼到 Discord 就好' : '⚠ 複製失敗,請手動複製');
  });

  $('#editBtn').addEventListener('click', startEdit);
  $('#saveBtn').addEventListener('click', save);
  $('#cancelBtn').addEventListener('click', () => {
    if (state.dirty && !confirm('放棄這次的修改?')) return;
    exitEdit();
  });
  $('#logoutBtn').addEventListener('click', () => {
    if (state.dirty && !confirm('登出會放棄這次的修改,確定嗎?')) return;
    store.del(LS_TOKEN);
    state.login = null;
    updateEditBtn();
    exitEdit();
    toast('已登出,這台電腦不再保存權杖');
  });
  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('清空全部名字?(還沒按儲存前,按「取消」都能復原)')) return;
    allSlots(state.draft).forEach(x => { x.s.player = ''; });
    state.dirty = true;
    render();
  });
  $('#compToggle').addEventListener('change', e => { state.editComp = e.target.checked; render(); });
  $('#pasteBtn').addEventListener('click', () => {
    $('#pasteMsg').textContent = '';
    $('#pasteInput').value = '';
    $('#pasteInput').placeholder = toDiscord(state.draft);
    $('#pasteDlg').showModal();
    $('#pasteInput').focus();
  });

  for (const [id, key] of [['#evTitle', 'title'], ['#evTime', 'time'], ['#evNote', 'note']]) {
    $(id).addEventListener('input', e => {
      state.draft.event[key] = e.target.value;
      state.dirty = true;
      if (key === 'title') $('#title').textContent = e.target.value || '隊伍名單';
    });
  }

  $('#loginForm').addEventListener('submit', submitLogin);
  $('#pasteForm').addEventListener('submit', applyPaste);
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  window.addEventListener('beforeunload', e => {
    if (state.editing && state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  setInterval(renderLive, 30000);
}

function init() {
  bindUI();
  const me = store.get(LS_ME);
  if (me) { state.query = me; $('#search').value = me; }
  poll();
}

init();
