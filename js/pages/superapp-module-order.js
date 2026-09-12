(() => {
  "use strict";

  const KNOWN = ["finance", "notes", "documents", "maintenance", "fun"];
  const LABELS = {
    finance: "Keuangan",
    notes: "Catatan",
    documents: "Dokumen",
    maintenance: "Maintenance",
    fun: "Have Fun Family"
  };
  const LOCAL_PREFIX = "ruangkitha_module_order_v1:";
  const grid = document.querySelector(".module-grid");
  const openButton = document.querySelector("[data-module-order-open]");
  if (!grid || !openButton) return;

  let userId = "";
  let currentOrder = KNOWN.slice();
  let draftOrder = KNOWN.slice();
  let draggedId = "";

  function normalize(value) {
    const raw = Array.isArray(value) ? value : [];
    const valid = raw.filter((id, index) => KNOWN.includes(id) && raw.indexOf(id) === index);
    KNOWN.forEach(id => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }

  function localKey() { return `${LOCAL_PREFIX}${userId || "guest"}`; }

  function readLocal() {
    try { return normalize(JSON.parse(localStorage.getItem(localKey()) || "[]")); }
    catch { return KNOWN.slice(); }
  }

  function writeLocal(order) {
    try { localStorage.setItem(localKey(), JSON.stringify(normalize(order))); } catch {}
  }

  function applyOrder(order) {
    const normalized = normalize(order);
    const map = new Map(
      Array.from(grid.querySelectorAll("[data-module-id]")).map(card => [card.dataset.moduleId, card])
    );
    normalized.forEach(id => {
      const card = map.get(id);
      if (card) grid.appendChild(card);
    });
    currentOrder = normalized;
  }

  function createSheet() {
    let layer = document.querySelector("[data-module-order-layer]");
    if (layer) return layer;

    layer = document.createElement("div");
    layer.className = "module-order-layer";
    layer.dataset.moduleOrderLayer = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="module-order-sheet" role="dialog" aria-modal="true" aria-labelledby="module-order-title">
        <div class="module-order-handle" aria-hidden="true"></div>
        <header class="module-order-head">
          <div>
            <h2 id="module-order-title">Atur urutan</h2>
            <p>Taruh ruang yang paling sering kamu pakai di bagian atas.</p>
          </div>
          <button class="module-order-close" type="button" data-module-order-close aria-label="Tutup"><ion-icon name="close-outline"></ion-icon></button>
        </header>
        <div class="module-order-list" data-module-order-list></div>
        <div class="module-order-actions">
          <button type="button" class="module-order-cancel" data-module-order-cancel>Batal</button>
          <button type="button" class="module-order-save" data-module-order-save>Simpan Urutan</button>
        </div>
      </section>`;
    document.body.appendChild(layer);

    layer.addEventListener("click", event => {
      if (event.target === layer || event.target.closest("[data-module-order-close], [data-module-order-cancel]")) closeSheet();
      const move = event.target.closest("[data-module-move]");
      if (move) moveItem(move.dataset.moduleId, move.dataset.moduleMove);
    });
    layer.querySelector("[data-module-order-save]")?.addEventListener("click", saveDraft);
    return layer;
  }

  function renderDraft() {
    const layer = createSheet();
    const root = layer.querySelector("[data-module-order-list]");
    root.replaceChildren();

    draftOrder.forEach((id, index) => {
      const row = document.createElement("div");
      row.className = "module-order-row";
      row.draggable = true;
      row.dataset.moduleOrderId = id;
      row.innerHTML = `
        <span class="module-order-drag" aria-hidden="true"><ion-icon name="reorder-three-outline"></ion-icon></span>
        <strong>${LABELS[id] || id}</strong>
        <span class="module-order-row-actions">
          <button type="button" data-module-move="up" data-module-id="${id}" aria-label="Naikkan ${LABELS[id] || id}" ${index === 0 ? "disabled" : ""}><ion-icon name="chevron-up-outline"></ion-icon></button>
          <button type="button" data-module-move="down" data-module-id="${id}" aria-label="Turunkan ${LABELS[id] || id}" ${index === draftOrder.length - 1 ? "disabled" : ""}><ion-icon name="chevron-down-outline"></ion-icon></button>
        </span>`;

      row.addEventListener("dragstart", event => {
        draggedId = id;
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      });
      row.addEventListener("dragend", () => {
        draggedId = "";
        row.classList.remove("is-dragging");
      });
      row.addEventListener("dragover", event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", event => {
        event.preventDefault();
        const source = draggedId || event.dataTransfer.getData("text/plain");
        if (!source || source === id) return;
        const from = draftOrder.indexOf(source);
        const to = draftOrder.indexOf(id);
        if (from < 0 || to < 0) return;
        draftOrder.splice(from, 1);
        draftOrder.splice(to, 0, source);
        renderDraft();
      });
      root.appendChild(row);
    });
  }

  function moveItem(id, direction) {
    const index = draftOrder.indexOf(id);
    const next = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= draftOrder.length) return;
    [draftOrder[index], draftOrder[next]] = [draftOrder[next], draftOrder[index]];
    renderDraft();
  }

  function openSheet() {
    draftOrder = currentOrder.slice();
    const layer = createSheet();
    renderDraft();
    layer.hidden = false;
    document.documentElement.classList.add("module-order-open");
  }

  function closeSheet() {
    const layer = document.querySelector("[data-module-order-layer]");
    if (layer) layer.hidden = true;
    document.documentElement.classList.remove("module-order-open");
  }

  async function saveServer(order) {
    if (!userId || !window.supabaseClient) return;
    const { error } = await window.supabaseClient
      .from("ruangkitha_user_preferences")
      .upsert({ user_id: userId, module_order: normalize(order), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  }

  async function saveDraft() {
    const save = document.querySelector("[data-module-order-save]");
    if (save) save.disabled = true;
    const next = normalize(draftOrder);
    writeLocal(next);
    applyOrder(next);
    closeSheet();
    try {
      await saveServer(next);
    } catch (error) {
      console.warn("[RuangKitha module order sync]", error);
    } finally {
      if (save) save.disabled = false;
    }
  }

  async function hydrate() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }
    const session = await AuthService.ambilSession().catch(() => null);
    userId = session?.user?.id || "";
    if (!userId) return;

    const local = readLocal();
    applyOrder(local);

    try {
      const { data, error } = await window.supabaseClient
        .from("ruangkitha_user_preferences")
        .select("module_order")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const server = normalize(data?.module_order || local);
      writeLocal(server);
      applyOrder(server);
    } catch (error) {
      console.warn("[RuangKitha module order load]", error);
    }
  }

  openButton.addEventListener("click", openSheet);
  hydrate();
})();
