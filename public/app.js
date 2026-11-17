const STORE_KEY = "cartwise_v1";
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
let state = loadState();
let editingListId = null;
let activeListId = null;
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      lists: Array.isArray(saved.lists) ? saved.lists : [],
      purchases: Array.isArray(saved.purchases) ? saved.purchases : [],
      savings: Number(saved.savings) || 0
    };
  } catch { return { lists: [], purchases: [], savings: 0 }; }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  renderAll();
}
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function monthPurchases() {
  const month = today().slice(0, 7);
  return state.purchases.filter(p => String(p.date).slice(0, 7) === month);
}
function totalItems() { return state.lists.reduce((n, list) => n + list.items.filter(i => !i.done).length, 0); }
function listTotal(list) { return list.items.reduce((n, item) => n + (Number(item.price) || 0) * (Number(item.qty) || 1), 0); }

function renderAll() {
  $("stat-lists").textContent = state.lists.length;
  $("stat-items").textContent = totalItems();
  $("stat-spend").textContent = money(monthPurchases().reduce((n, p) => n + Number(p.amount), 0));
  $("stat-savings").textContent = money(state.savings);
  renderOverviewLists();
  renderLists();
  renderSpending();
  renderActivity();
}
function renderOverviewLists() {
  const host = $("overview-lists");
  if (!state.lists.length) {
    host.className = "list-preview empty-state";
    host.innerHTML = '<div class="empty-illustration">🧺</div><strong>Your next great shop starts with a list.</strong><p>Create a list to organize everything you need.</p><button class="button button-green" id="create-first">Create a shopping list</button>';
    $("create-first").addEventListener("click", () => openListDialog());
    return;
  }
  host.className = "list-preview";
  host.innerHTML = state.lists.slice(0, 3).map(list => {
    const remaining = list.items.filter(i => !i.done).length;
    return '<button class="list-preview-row" data-open-list="' + list.id + '"><span class="list-emoji">🛒</span><span class="preview-info"><strong>' + escapeHtml(list.name) + '</strong><small>' + remaining + ' items left · ' + list.items.length + ' total</small></span><strong class="preview-total">' + money(listTotal(list)) + '</strong><span class="arrow">→</span></button>';
  }).join("");
  host.querySelectorAll("[data-open-list]").forEach(b => b.addEventListener("click", () => openItems(b.dataset.openList)));
}
function renderLists() {
  const host = $("lists-container");
  if (!state.lists.length) {
    host.innerHTML = '<div class="panel empty-state full-empty"><div class="empty-illustration">📝</div><strong>No lists yet</strong><p>Create your first list and start planning a smarter grocery trip.</p><button class="button button-green" id="empty-new-list">＋ Create your first list</button></div>';
    $("empty-new-list").addEventListener("click", () => openListDialog());
    return;
  }
  host.innerHTML = state.lists.map(list => {
    const remaining = list.items.filter(i => !i.done).length;
    const done = list.items.length - remaining;
    const progress = list.items.length ? Math.round(done / list.items.length * 100) : 0;
    return '<article class="shopping-card"><div class="shopping-card-top"><span class="list-emoji large">🛒</span><button class="more-button" data-delete-list="' + list.id + '" aria-label="Delete list">•••</button></div><h3>' + escapeHtml(list.name) + '</h3><p>' + escapeHtml(list.note || "Your grocery essentials") + '</p><div class="progress-track"><span style="width:' + progress + '%"></span></div><div class="card-meta"><span>' + remaining + ' left · ' + done + ' checked</span><strong>' + money(listTotal(list)) + '</strong></div><div class="card-actions"><button class="button button-green" data-open-list="' + list.id + '">Open list →</button><button class="icon-button" data-edit-list="' + list.id + '" aria-label="Edit list">✎</button></div></article>';
  }).join("");
  host.querySelectorAll("[data-open-list]").forEach(b => b.addEventListener("click", () => openItems(b.dataset.openList)));
  host.querySelectorAll("[data-edit-list]").forEach(b => b.addEventListener("click", () => openListDialog(b.dataset.editList)));
  host.querySelectorAll("[data-delete-list]").forEach(b => b.addEventListener("click", () => {
    const list = state.lists.find(x => x.id === b.dataset.deleteList);
    if (list && confirm('Delete "' + list.name + '" and its items?')) {
      state.lists = state.lists.filter(x => x.id !== list.id);
      saveState(); toast("Shopping list deleted.");
    }
  }));
}
function renderSpending() {
  const purchases = [...state.purchases].sort((a, b) => b.date.localeCompare(a.date));
  const monthTotal = monthPurchases().reduce((n, p) => n + Number(p.amount), 0);
  $("month-total").textContent = money(monthTotal);
  $("purchase-count").textContent = state.purchases.length;
  $("average-trip").textContent = money(state.purchases.length ? state.purchases.reduce((n, p) => n + Number(p.amount), 0) / state.purchases.length : 0);
  const host = $("purchase-list");
  if (!purchases.length) {
    host.className = "purchase-list empty-state";
    host.innerHTML = '<div class="empty-illustration">🧾</div><strong>No purchases logged yet</strong><p>Add a grocery trip to start tracking your household spending.</p>';
    return;
  }
  host.className = "purchase-list";
  host.innerHTML = purchases.map(p => '<div class="purchase-row"><div class="purchase-store-icon">🛍️</div><div class="purchase-info"><strong>' + escapeHtml(p.store) + '</strong><span>' + new Date(p.date + "T12:00:00").toLocaleDateString() + (p.note ? " · " + escapeHtml(p.note) : "") + '</span></div><strong class="purchase-amount">' + money(p.amount) + '</strong><button class="remove-purchase" data-remove-purchase="' + p.id + '" aria-label="Remove purchase">×</button></div>').join("");
  host.querySelectorAll("[data-remove-purchase]").forEach(b => b.addEventListener("click", () => {
    state.purchases = state.purchases.filter(p => p.id !== b.dataset.removePurchase);
    saveState(); toast("Purchase removed.");
  }));
}
function renderActivity() {
  const host = $("recent-activity");
  const latest = [...state.purchases].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  host.className = latest.length ? "activity-list" : "activity-empty";
  host.innerHTML = latest.length ? latest.map(p => '<div class="activity-row"><span class="activity-icon">🧾</span><span><strong>' + escapeHtml(p.store) + '</strong><small>' + new Date(p.date + "T12:00:00").toLocaleDateString() + '</small></span><strong>' + money(p.amount) + '</strong></div>').join("") : "Your purchase log will show up here when you start tracking spending.";
}

function openListDialog(id) {
  editingListId = id || null;
  const list = id ? state.lists.find(x => x.id === id) : null;
  $("list-dialog-title").textContent = list ? "Edit shopping list" : "Create a shopping list";
  $("list-name").value = list?.name || "";
  $("list-note").value = list?.note || "";
  $("list-dialog").showModal();
  $("list-name").focus();
}
$("list-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("list-name").value.trim();
  if (!name) return;
  if (editingListId) {
    const list = state.lists.find(x => x.id === editingListId);
    if (list) { list.name = name; list.note = $("list-note").value.trim(); }
  } else {
    state.lists.unshift({ id: uid(), name, note: $("list-note").value.trim(), createdAt: new Date().toISOString(), items: [] });
  }
  $("list-dialog").close(); saveState(); toast(editingListId ? "List updated." : "Shopping list created.");
});
function openItems(id) {
  activeListId = id;
  const list = state.lists.find(x => x.id === id);
  if (!list) return;
  $("items-title").textContent = list.name;
  $("items-dialog").showModal();
  renderItems();
}
function renderItems() {
  const list = state.lists.find(x => x.id === activeListId);
  if (!list) return;
  const host = $("items-content");
  if (!list.items.length) {
    host.innerHTML = '<div class="items-empty">Your list is empty. Add your first grocery item above.</div>';
  } else {
    host.innerHTML = list.items.map(item => '<div class="grocery-item ' + (item.done ? "is-done" : "") + '"><input type="checkbox" data-toggle-item="' + item.id + '" ' + (item.done ? "checked" : "") + ' aria-label="Mark ' + escapeHtml(item.name) + ' as purchased"><span class="grocery-name">' + escapeHtml(item.name) + '<small>' + escapeHtml(item.qty || "1") + '</small></span><label class="item-price"><span>$</span><input type="number" min="0" step="0.01" value="' + (Number(item.price) || "") + '" placeholder="0.00" data-item-price="' + item.id + '" aria-label="Estimated unit price for ' + escapeHtml(item.name) + '"></label><button class="remove-item" data-remove-item="' + item.id + '" aria-label="Remove ' + escapeHtml(item.name) + '">×</button></div>').join("");
  }
  $("list-estimate").textContent = money(listTotal(list));
  host.querySelectorAll("[data-toggle-item]").forEach(input => input.addEventListener("change", () => {
    const item = list.items.find(x => x.id === input.dataset.toggleItem); if (item) item.done = input.checked;
    saveState(); renderItems();
  }));
  host.querySelectorAll("[data-item-price]").forEach(input => input.addEventListener("change", () => {
    const item = list.items.find(x => x.id === input.dataset.itemPrice); if (item) item.price = Math.max(0, Number(input.value) || 0);
    saveState(); renderItems();
  }));
  host.querySelectorAll("[data-remove-item]").forEach(button => button.addEventListener("click", () => {
    list.items = list.items.filter(x => x.id !== button.dataset.removeItem);
    saveState(); renderItems();
  }));
}
$("add-item").addEventListener("click", addItem);
$("item-name").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } });
function addItem() {
  const name = $("item-name").value.trim();
  if (!name || !activeListId) return;
  const list = state.lists.find(x => x.id === activeListId);
  list.items.push({ id: uid(), name, qty: $("item-qty").value.trim() || "1", price: 0, done: false });
  $("item-name").value = ""; $("item-qty").value = "1";
  saveState(); renderItems(); $("item-name").focus();
}
$("compare-list").addEventListener("click", () => {
  const list = state.lists.find(x => x.id === activeListId);
  if (!list || !list.items.length) { toast("Add items to your list first."); return; }
  const query = list.items.filter(i => !i.done).map(i => i.name).slice(0, 3).join(" ");
  $("items-dialog").close(); navigate("compare"); $("product-query").value = query || list.items[0].name; runSearch(query || list.items[0].name);
});

function openPurchaseDialog() {
  $("purchase-date").value = today();
  $("purchase-store").value = ""; $("purchase-amount").value = ""; $("purchase-note").value = "";
  $("purchase-dialog").showModal();
}
$("purchase-form").addEventListener("submit", e => {
  e.preventDefault();
  const amount = Number($("purchase-amount").value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.purchases.unshift({ id: uid(), store: $("purchase-store").value.trim(), amount, date: $("purchase-date").value || today(), note: $("purchase-note").value.trim() });
  $("purchase-dialog").close(); saveState(); toast("Grocery trip logged.");
});

function navigate(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active-view", v.id === "view-" + view));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const labels = { overview: "Overview", lists: "Shopping lists", compare: "Price compare", spending: "Spending" };
  $("crumb").textContent = labels[view] || "Overview";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => navigate(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.goto)));
$("quick-add").addEventListener("click", () => openListDialog());
$("new-list").addEventListener("click", () => openListDialog());
$("log-purchase").addEventListener("click", openPurchaseDialog);
$("quick-search").addEventListener("submit", e => {
  e.preventDefault(); const q = $("quick-query").value.trim(); if (!q) return;
  navigate("compare"); $("product-query").value = q; runSearch(q);
});
document.querySelectorAll("[data-search]").forEach(b => b.addEventListener("click", () => {
  const q = b.dataset.search; navigate("compare"); $("product-query").value = q; runSearch(q);
}));
$("product-search").addEventListener("submit", e => { e.preventDefault(); runSearch($("product-query").value.trim()); });
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => $(b.dataset.close).close()));

async function runSearch(query) {
  if (!query || query.length < 2) { toast("Enter a product to search for."); return; }
  const status = $("search-status"), results = $("product-results"), summary = $("results-summary");
  status.innerHTML = '<span class="spinner"></span> Searching available shopping listings...';
  results.innerHTML = ""; summary.textContent = "";
  const location = $("location-input").value.trim();
  try {
    const params = new URLSearchParams({ q: query });
    if (location) params.set("location", location);
    const response = await fetch("/api/search?" + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search could not be completed.");
    if (!data.products?.length) {
      status.textContent = "No matching listings found. Try a broader product name or a different location.";
      return;
    }
    status.textContent = "";
    const prices = data.products.map(p => p.price).filter(p => Number.isFinite(p));
    const cheapest = prices.length ? Math.min(...prices) : null;
    summary.innerHTML = '<strong>' + data.products.length + ' listings</strong> for “' + escapeHtml(query) + '"' + (cheapest !== null ? ' <span>· Lowest listed price ' + money(cheapest) + '</span>' : "");
    results.innerHTML = data.products.map((p, i) => {
      const isCheapest = p.price !== null && p.price === cheapest;
      return '<article class="product-card"><div class="product-image">' + (p.thumbnail ? '<img src="' + escapeHtml(p.thumbnail) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span>🛍️</span>') + (isCheapest ? '<span class="best-price">LOWEST LISTED</span>' : "") + '</div><div class="product-info"><span class="merchant">' + escapeHtml(p.merchant) + '</span><h3>' + escapeHtml(p.title) + '</h3><div class="product-meta">' + (p.rating ? '★ ' + escapeHtml(p.rating) + (p.reviews ? ' (' + escapeHtml(p.reviews) + ')' : "") : "Retailer listing") + '</div><div class="product-bottom"><strong>' + (p.price !== null ? money(p.price) : escapeHtml(p.priceText || "See retailer")) + '</strong>' + (p.link ? '<a href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener noreferrer">View deal ↗</a>' : '<span class="no-link">Listing details</span>') + '</div></div></article>';
    }).join("");
  } catch (error) {
    status.innerHTML = '<span class="error-mark">!</span> ' + escapeHtml(error.message);
    if (String(error.message).includes("SERPAPI_API_KEY")) {
      status.innerHTML += '<p class="setup-hint">Once your CartWise Worker has the search secret configured, product comparisons will work here. Your lists and spending tracker are ready in the meantime.</p>';
    }
  }
}

renderAll();
