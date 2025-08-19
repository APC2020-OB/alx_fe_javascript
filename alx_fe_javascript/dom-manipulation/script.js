// Dynamic Quote Generator — Sync + Conflict Resolution
// Beginner-friendly, commented, and drop-in ready.

// ============= CONFIG =============
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts"; // read-only mock API
const AUTO_SYNC_MS = 30000; // 30s

// LocalStorage keys (namespaced)
const LS_KEYS = {
  QUOTES: "dqg:quotes",
  AUTO_SYNC: "dqg:autoSync",
  LAST_SYNC_AT: "dqg:lastSyncAt"
};

// Quote shape we use everywhere:
// { id: number|string, text: string, author: string, updatedAt: number, source: "local" | "server" }

// ============= DOM =============
const els = {
  form: document.getElementById("quoteForm"),
  text: document.getElementById("quoteText"),
  author: document.getElementById("quoteAuthor"),
  list: document.getElementById("quoteList"),
  syncNow: document.getElementById("btnSyncNow"),
  autoSync: document.getElementById("chkAutoSync"),
  syncStatus: document.getElementById("syncStatus"),
  conflictPanel: document.getElementById("conflictPanel"),
  conflictList: document.getElementById("conflictList"),
  toasts: document.getElementById("toasts")
};

let autoSyncTimer = null;
let pendingConflicts = []; // array of { id, local, server }

// ============= UTILITIES =============
const now = () => Date.now();

function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function setStatus(text) {
  els.syncStatus.textContent = text;
}

function getLocalQuotes() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.QUOTES)) || [];
  } catch {
    return [];
  }
}

function saveLocalQuotes(quotes) {
  localStorage.setItem(LS_KEYS.QUOTES, JSON.stringify(quotes));
}

function setAutoSync(enabled) {
  localStorage.setItem(LS_KEYS.AUTO_SYNC, JSON.stringify(Boolean(enabled)));
}

function getAutoSync() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.AUTO_SYNC)) || false;
  } catch {
    return false;
  }
}

function setLastSyncAt(ts) {
  localStorage.setItem(LS_KEYS.LAST_SYNC_AT, String(ts));
}

function getLastSyncAt() {
  const v = localStorage.getItem(LS_KEYS.LAST_SYNC_AT);
  return v ? Number(v) : 0;
}

// ============= RENDER =============
function renderQuotes(quotes) {
  els.list.innerHTML = "";
  if (!quotes.length) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `<div><strong>No quotes yet.</strong><div class="meta">Add one above.</div></div>`;
    els.list.appendChild(li);
    return;
  }

  for (const q of quotes) {
    const li = document.createElement("li");
    li.className = "item";

    const textHtml = `
      <div>
        <div><strong>"${escapeHtml(q.text)}"</strong></div>
        <div class="meta">— ${escapeHtml(q.author || "Unknown")} · <em>${q.source}</em> · ${new Date(q.updatedAt).toLocaleString()}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Edit";
    btnEdit.className = "secondary";
    btnEdit.addEventListener("click", () => onEditQuote(q.id));

    const btnDel = document.createElement("button");
    btnDel.textContent = "Delete";
    btnDel.className = "warn";
    btnDel.addEventListener("click", () => onDeleteQuote(q.id));

    actions.append(btnEdit, btnDel);

    li.innerHTML = textHtml;
    li.appendChild(actions);
    els.list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

// ============= CRUD =============
function addQuote(text, author) {
  const quote = {
    id: `local-${now()}`, // unique local id (won't collide with server ids 1..100)
    text: String(text).trim(),
    author: String(author || "You"),
    updatedAt: now(),
    source: "local"
  };

  const quotes = getLocalQuotes();
  quotes.unshift(quote);
  saveLocalQuotes(quotes);
  renderQuotes(quotes);
  toast("Quote added.", "ok");
}

function onEditQuote(id) {
  const quotes = getLocalQuotes();
  const idx = quotes.findIndex(q => String(q.id) === String(id));
  if (idx === -1) return;

  const current = quotes[idx];
  const newText = prompt("Edit quote text:", current.text);
  if (newText == null) return;

  const newAuthor = prompt("Edit author:", current.author || "Unknown");
  if (newAuthor == null) return;

  quotes[idx] = {
    ...current,
    text: String(newText).trim(),
    author: String(newAuthor).trim(),
    updatedAt: now(),
    source: "local" // becomes local edit
  };
  saveLocalQuotes(quotes);
  renderQuotes(quotes);
  toast("Quote updated.", "ok");
}

function onDeleteQuote(id) {
  const quotes = getLocalQuotes();
  const next = quotes.filter(q => String(q.id) !== String(id));
  saveLocalQuotes(next);
  renderQuotes(next);
  toast("Quote deleted.", "ok");
}

// ============= SERVER SIMULATION =============
// JSONPlaceholder is read-only. We'll GET and treat it as "server state".
// Any "POST" is simulated by keeping local-only quotes with `local-*` ids.

async function fetchQuotesFromServer() {
  // In a real app you would send If-Modified-Since or ETags.
  // For our simulation, we always fetch a small set.
  const res = await fetch(SERVER_URL);
  const posts = await res.json();

  // Convert posts -> quotes (small slice so it’s fast)
  const sample = posts.slice(0, 8);

  // Mark as "server" and stamp an updatedAt so "server wins" is deterministic.
  const nowTs = now();
  return sample.map(p => ({
    id: p.id,                        // 1..100
    text: String(p.title).trim(),    // quote text
    author: `Server User ${p.userId}`,
    updatedAt: nowTs,                // server considered most recent on each fetch
    source: "server"
  }));
}

// ============= MERGE & CONFLICTS =============
function mergeQuotes({ serverQuotes, localQuotes }) {
  const serverById = new Map(serverQuotes.map(q => [String(q.id), q]));
  const localById = new Map(localQuotes.map(q => [String(q.id), q]));

  const merged = [];
  pendingConflicts = []; // reset

  // 1) include all server quotes; resolve conflicts against local
  for (const [id, sQ] of serverById) {
    if (localById.has(id)) {
      const lQ = localById.get(id);
      if (didConflict(lQ, sQ)) {
        // default: server wins
        pendingConflicts.push({ id, local: lQ, server: sQ });
        merged.push(sQ);
      } else {
        // no conflict (same text/author), keep server (or local; both fine)
        merged.push(sQ);
      }
      localById.delete(id);
    } else {
      merged.push(sQ);
    }
  }

  // 2) add remaining purely local quotes (new items, ids like local-*)
  for (const [, lQ] of localById) merged.push(lQ);

  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

function didConflict(localQ, serverQ) {
  return (localQ.text !== serverQ.text) || ((localQ.author || "") !== (serverQ.author || ""));
}

function showConflicts() {
  if (!pendingConflicts.length) {
    els.conflictPanel.classList.add("hidden");
    els.conflictList.innerHTML = "";
    return;
  }
  els.conflictPanel.classList.remove("hidden");
  els.conflictList.innerHTML = "";

  for (const c of pendingConflicts) {
    const wrap = document.createElement("div");
    wrap.className = "conflict";
    wrap.innerHTML = `
      <div><strong>Quote ID:</strong> ${escapeHtml(c.id)}</div>
      <div style="margin-top:.5rem; display:grid; gap:.5rem;">
        <div>
          <div><strong>Local version</strong></div>
          <pre>${escapeHtml(c.local.text)} — ${escapeHtml(c.local.author || "Unknown")}</pre>
        </div>
        <div>
          <div><strong>Server version</strong></div>
          <pre>${escapeHtml(c.server.text)} — ${escapeHtml(c.server.author || "Unknown")}</pre>
        </div>
      </div>
    `;

    const row = document.createElement("div");
    row.className = "row";
    const keepLocal = document.createElement("button");
    keepLocal.textContent = "Keep Local";
    keepLocal.className = "secondary";
    keepLocal.addEventListener("click", () => resolveOneConflict(c.id, "local"));

    const keepServer = document.createElement("button");
    keepServer.textContent = "Keep Server";
    keepServer.addEventListener("click", () => resolveOneConflict(c.id, "server"));

    row.append(keepLocal, keepServer);
    wrap.appendChild(row);
    els.conflictList.appendChild(wrap);
  }
}

function resolveOneConflict(id, choice) {
  const quotes = getLocalQuotes();
  const conflict = pendingConflicts.find(c => String(c.id) === String(id));
  if (!conflict) return;

  const chosen = (choice === "local") ? { ...conflict.local, updatedAt: now(), source: "local" } 
                                      : { ...conflict.server, updatedAt: now(), source: "server" };

  // Replace whichever currently exists in local store
  const idx = quotes.findIndex(q => String(q.id) === String(id));
  if (idx !== -1) {
    quotes[idx] = chosen;
  } else {
    quotes.unshift(chosen);
  }

  saveLocalQuotes(quotes);
  renderQuotes(quotes);

  // remove conflict from list and refresh UI
  pendingConflicts = pendingConflicts.filter(c => String(c.id) !== String(id));
  showConflicts();

  toast(`Conflict resolved: kept ${choice}.`, "ok");
}

// ============= SYNC LOOP =============
async function syncQuotes() {
  try {
    setStatus("Syncing…");
    const [localQuotes, serverQuotes] = [getLocalQuotes(), await fetchQuotesFromServer()];

    const merged = mergeQuotes({ serverQuotes, localQuotes });
    saveLocalQuotes(merged);
    renderQuotes(merged);
    showConflicts();

    setLastSyncAt(now());
    setStatus(`Synced at ${new Date(getLastSyncAt()).toLocaleTimeString()}. (${pendingConflicts.length} conflict${pendingConflicts.length === 1 ? "" : "s"})`);
    toast("Quotes synced with server.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Sync failed (maybe offline).");
    toast("Sync failed (check internet).", "warn");
  }
}

function startAutoSync() {
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(syncQuotes, AUTO_SYNC_MS);
}

function stopAutoSync() {
  if (!autoSyncTimer) return;
  clearInterval(autoSyncTimer);
  autoSyncTimer = null;
}

// ============= INIT & EVENTS =============
function init() {
  // boot local data if first run
  if (!localStorage.getItem(LS_KEYS.QUOTES)) {
    saveLocalQuotes([]);
  }

  renderQuotes(getLocalQuotes());

  // restore autosync pref
  const auto = getAutoSync();
  els.autoSync.checked = auto;
  if (auto) startAutoSync();

  // events
  els.form.addEventListener("submit", e => {
    e.preventDefault();
    const text = els.text.value.trim();
    const author = els.author.value.trim();
    if (!text) return;
    addQuote(text, author || "You");
    els.form.reset();
  });

  els.syncNow.addEventListener("click", () => syncQuotes());

  els.autoSync.addEventListener("change", (e) => {
    const enabled = e.currentTarget.checked;
    setAutoSync(enabled);
    if (enabled) {
      startAutoSync();
      toast("Auto sync enabled.", "info");
    } else {
      stopAutoSync();
      toast("Auto sync disabled.", "info");
    }
  });

  // first sync (optional; comment out if you prefer manual)
  syncQuotes();
}

// Kick things off when the script loads
document.addEventListener("DOMContentLoaded", init);
