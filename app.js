// Cart + Receipts PWA
// Replace these with your Supabase project details.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const RECEIPT_BUCKET = "receipts";

let db = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const statusBox = $("status");

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "#8e2f2f" : "#796b5d";
}

function initSupabase() {
  if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) {
    setStatus("Supabase is not connected yet. Add your URL and anon key in app.js.");
    return;
  }
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setStatus("Supabase connected. Ready for receipts.");
  loadReceipts();
  loadItems();
}

function setupTabs() {
  document.querySelectorAll(".tab[data-section]").forEach((tab) => {
    tab.addEventListener("click", () => showSection(tab.dataset.section, tab));
  });

  $("addSectionBtn").addEventListener("click", () => {
    const name = prompt("Name this new section:");
    if (!name) return;

    const id = `custom-${Date.now()}`;
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.dataset.section = id;
    tab.textContent = name;
    tab.addEventListener("click", () => showSection(id, tab));
    $("addSectionBtn").before(tab);

    const template = $("customSectionTemplate").content.cloneNode(true);
    const section = template.querySelector("section");
    section.id = id;
    section.querySelector("h2").textContent = name;
    $("customSections").appendChild(section);
    showSection(id, tab);
  });
}

function showSection(id, activeTab) {
  document.querySelectorAll(".section").forEach((section) => section.classList.remove("active-section"));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  const section = $(id);
  if (section) section.classList.add("active-section");
  if (activeTab) activeTab.classList.add("active");
}

async function uploadReceiptFile(file) {
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await db.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

function getFormData() {
  const file = $("receiptFile").files[0];
  if (!file) throw new Error("Choose a receipt photo or PDF first.");

  return {
    file,
    store_name: $("storeName").value.trim() || null,
    receipt_date: $("receiptDate").value || null,
    total: $("receiptTotal").value ? Number($("receiptTotal").value) : null,
    payment_method: $("paymentMethod").value.trim() || null,
    notes: $("receiptNotes").value.trim() || null,
  };
}

async function saveReceipt({ tryParse = false } = {}) {
  if (!db) return setStatus("Connect Supabase in app.js before saving receipts.", true);

  try {
    setStatus("Saving receipt...");
    const data = getFormData();
    const filePath = await uploadReceiptFile(data.file);

    const { data: receipt, error } = await db
      .from("receipts")
      .insert({
        store_name: data.store_name,
        receipt_date: data.receipt_date,
        total: data.total,
        payment_method: data.payment_method,
        notes: data.notes,
        file_path: filePath,
        source_type: "upload",
        parse_status: tryParse ? "pending" : "not_parsed",
      })
      .select()
      .single();

    if (error) throw error;

    if (tryParse) {
      setStatus("Receipt saved. Asking AI parser to extract items...");
      const { error: fnError } = await db.functions.invoke("parse-receipt", {
        body: { receipt_id: receipt.id, file_path: filePath },
      });
      if (fnError) throw fnError;
      setStatus("AI parse requested. Refresh in a moment to see extracted items.");
    } else {
      setStatus("Receipt saved. You can parse it later.");
    }

    $("receiptForm").reset();
    await loadReceipts();
    await loadItems();
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong while saving.", true);
  }
}

async function loadReceipts() {
  if (!db) return;
  const list = $("receiptsList");
  const { data, error } = await db
    .from("receipts")
    .select("id, store_name, receipt_date, total, parse_status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return setStatus(error.message, true);

  list.innerHTML = data.length ? "" : "<p class='receipt-meta'>No receipts saved yet.</p>";
  data.forEach((receipt) => {
    const card = document.createElement("div");
    card.className = "receipt-card";
    card.innerHTML = `
      <strong>${receipt.store_name || "Unknown store"}</strong>
      <div class="receipt-meta">
        ${receipt.receipt_date || "No date"} · ${receipt.total ? `$${Number(receipt.total).toFixed(2)}` : "No total"} · ${receipt.parse_status || "not parsed"}
      </div>
    `;
    list.appendChild(card);
  });
}

async function loadItems() {
  if (!db) return;
  const list = $("itemsList");
  const { data, error } = await db
    .from("receipt_items")
    .select("raw_name, normalized_name, quantity, unit_price, total_price, category, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return setStatus(error.message, true);

  list.innerHTML = data.length ? "" : "<p class='item-meta'>No extracted items yet.</p>";
  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <strong>${item.normalized_name || item.raw_name || "Unnamed item"}</strong>
      <div class="item-meta">
        Original: ${item.raw_name || "—"} · Qty: ${item.quantity || 1} · ${item.total_price ? `$${Number(item.total_price).toFixed(2)}` : "No price"} · ${item.category || "Uncategorized"}
      </div>
    `;
    list.appendChild(card);
  });
}

function setupPWAInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    $("installBtn").classList.remove("hidden");
  });

  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").classList.add("hidden");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
}

$("receiptForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveReceipt({ tryParse: false });
});

$("parseBtn").addEventListener("click", () => saveReceipt({ tryParse: true }));
$("refreshBtn").addEventListener("click", async () => {
  await loadReceipts();
  await loadItems();
});

setupTabs();
setupPWAInstall();
initSupabase();
