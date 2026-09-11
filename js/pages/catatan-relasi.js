// RuangKitha v2.0.0a43d — Relation Card Delete + Node Meta Polish
(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const relationId = String(params.get("id") || "").trim();
  const requestedScope = String(params.get("scope") || "personal").toLowerCase() === "family" ? "family" : "personal";
  const requestedFocus = String(params.get("focus") || "").trim();

  const STAGE_W = 1200;
  const STAGE_H = 860;
  const CENTER = { x: STAGE_W / 2, y: STAGE_H / 2 };

  let userId = "";
  let familyId = "";
  let graph = null;
  let scale = 0.78;
  let initializedMapScroll = false;
  let mapCanvasPadX = 0;
  let mapCanvasPadY = 0;
  let mapPanState = null;
  let pinchState = null;
  const activePointers = new Map();
  let suppressMapClickUntil = 0;
  let selectedEdge = null;
  let lastLayoutBounds = null;
  let toastTimer = null;
  let focusId = "";
  const expanded = new Set();
  const expansionLimits = new Map();
  const seedVisible = new Set();

  function clean(value, fallback = "") {
    const text = String(value ?? "").trim().replace(/\s+/g, " ");
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    const el = q("[data-relation-toast]");
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function scopeLabel(scope) {
    return scope === "family" ? "Relasi Keluarga" : "Relasi Pribadi";
  }

  function noteIcon(note) {
    if (note?.note_type === "checklist") return "checkbox-outline";
    if (note?.note_type === "reminder") return "notifications-outline";
    return "document-text-outline";
  }

  function noteMeta(note) {
    const type = note?.note_type === "checklist" ? "Checklist" : note?.note_type === "reminder" ? "Reminder" : "Catatan";
    const area = note?.scope === "family" ? "Keluarga" : "Pribadi";
    if (note?.archived_at) return `${type} · ${area} · Diarsipkan`;
    if (note?.scope === "personal") return `${type} · ${area}${note?.visibility === "family-read" ? " · Dibagikan" : " · Hanya Saya"}`;
    return `${type} · ${area}`;
  }

  function noteHref(note) {
    const page = note?.note_type === "checklist" ? "catatan-checklist.html" : "catatan-editor.html";
    const url = new URL(page, location.href);
    url.searchParams.set("scope", note?.scope === "family" ? "family" : "personal");
    url.searchParams.set("id", note.id);
    if (note?.note_type === "reminder") url.searchParams.set("type", "reminder");
    if (note?.folder_name) url.searchParams.set("folder", note.folder_name);
    if (note?.scope === "personal" && note?.created_by && note.created_by !== userId) {
      url.searchParams.set("from", "member");
      url.searchParams.set("member", note.created_by);
    }
    return `${url.pathname.split("/").pop()}${url.search}`;
  }

  function openNote(note) {
    if (!note?.id) return;
    if (note.archived_at) {
      showToast("Catatan ini sedang diarsipkan. Pulihkan dari Arsip untuk membukanya.");
      return;
    }
    location.href = noteHref(note);
  }

  function relationListHref(scope = requestedScope) {
    return `catatan-relasi.html?scope=${scope === "family" ? "family" : "personal"}`;
  }

  function fallbackBackHref() {
    const scope = graph?.relation?.scope || requestedScope;
    return scope === "family" ? "catatan-keluarga.html" : "catatan-pribadi.html";
  }

  function setupStaticInteractions() {
    q("[data-relation-back]")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = relationId ? relationListHref(graph?.relation?.scope || requestedScope) : fallbackBackHref();
    });
    q("[data-relation-menu]")?.addEventListener("click", () => {
      const layer = q("[data-relation-manage-layer]");
      if (layer) layer.hidden = false;
    });
    q("[data-relation-manage-close]")?.addEventListener("click", () => {
      q("[data-relation-manage-layer]").hidden = true;
    });
    q("[data-relation-manage-layer]")?.addEventListener("click", event => {
      if (event.target === q("[data-relation-manage-layer]")) q("[data-relation-manage-layer]").hidden = true;
    });
    q("[data-relation-rename]")?.addEventListener("click", openRenameDialog);
    q("[data-relation-delete]")?.addEventListener("click", deleteCurrentRelation);
    q("[data-relation-name-cancel]")?.addEventListener("click", closeRenameDialog);
    q("[data-relation-name-save]")?.addEventListener("click", saveRename);
    q("[data-relation-name-layer]")?.addEventListener("click", event => {
      if (event.target === q("[data-relation-name-layer]")) closeRenameDialog();
    });
    q("[data-relation-edge-cancel]")?.addEventListener("click", closeEdgeDialog);
    q("[data-relation-edge-close]")?.addEventListener("click", closeEdgeDialog);
    q("[data-relation-edge-disconnect]")?.addEventListener("click", disconnectSelectedEdge);
    q("[data-relation-edge-layer]")?.addEventListener("click", event => {
      if (event.target === q("[data-relation-edge-layer]")) closeEdgeDialog();
    });
    q("[data-zoom-in]")?.addEventListener("click", () => setScale(scale + .12));
    q("[data-zoom-out]")?.addEventListener("click", () => setScale(scale - .12));
    q("[data-zoom-reset]")?.addEventListener("click", () => {
      setScale(window.innerWidth < 520 ? .72 : .86);
      centerMapOnGraph();
    });
    document.addEventListener("click", event => {
      if (!event.target?.closest?.(".relation-card-actions")) closeRelationCardMenus();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeRelationCardMenus();
    });
    setupMapPanning();
  }

  function setupMapPanning() {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport || viewport.dataset.freeRoomReady === "true") return;
    viewport.dataset.freeRoomReady = "true";

    const interactiveTarget = target => Boolean(target?.closest?.(
      ".relation-node, .relation-branch-button, .relation-map-toolbar, .relation-edge-hit, button, a, input, textarea, select"
    ));

    const point = event => ({ x: event.clientX, y: event.clientY });
    const firstTwoPointers = () => Array.from(activePointers.entries()).slice(0, 2);

    const beginPinch = () => {
      if (activePointers.size < 2) return;
      const pair = firstTwoPointers();
      const a = pair[0][1];
      const b = pair[1][1];
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const midClientX = (a.x + b.x) / 2;
      const midClientY = (a.y + b.y) / 2;
      const rect = viewport.getBoundingClientRect();
      const localX = midClientX - rect.left;
      const localY = midClientY - rect.top;
      updateCanvasSize();
      pinchState = {
        ids: pair.map(([id]) => id),
        startDistance: distance,
        startScale: scale,
        worldX: (viewport.scrollLeft + localX - mapCanvasPadX) / scale,
        worldY: (viewport.scrollTop + localY - mapCanvasPadY) / scale
      };
      mapPanState = null;
      viewport.classList.add("is-panning", "is-pinching");
      pair.forEach(([id]) => { try { viewport.setPointerCapture?.(id); } catch {} });
    };

    const updatePinch = event => {
      if (!pinchState || activePointers.size < 2) return false;
      const pair = pinchState.ids.map(id => [id, activePointers.get(id)]).filter(([, value]) => value);
      if (pair.length < 2) return false;
      const a = pair[0][1];
      const b = pair[1][1];
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const ratio = distance / pinchState.startDistance;
      const nextScale = pinchState.startScale * ratio;
      const midClientX = (a.x + b.x) / 2;
      const midClientY = (a.y + b.y) / 2;
      setScaleAtWorld(nextScale, midClientX, midClientY, pinchState.worldX, pinchState.worldY);
      event?.preventDefault?.();
      return true;
    };

    const finishPointer = event => {
      const id = event?.pointerId;
      if (id != null) activePointers.delete(id);

      if (pinchState && (id == null || pinchState.ids.includes(id))) {
        if (activePointers.size < 2) {
          pinchState = null;
          viewport.classList.remove("is-pinching", "is-panning");
          suppressMapClickUntil = performance.now() + 260;
        } else {
          beginPinch();
        }
      }

      if (mapPanState && (id == null || id === mapPanState.pointerId)) {
        const wasDragging = mapPanState.dragging;
        try {
          if (viewport.hasPointerCapture?.(mapPanState.pointerId)) viewport.releasePointerCapture(mapPanState.pointerId);
        } catch {}
        mapPanState = null;
        viewport.classList.remove("is-panning");
        if (wasDragging) suppressMapClickUntil = performance.now() + 220;
      }
    };

    viewport.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      activePointers.set(event.pointerId, point(event));

      if (activePointers.size >= 2) {
        beginPinch();
        event.preventDefault();
        return;
      }

      // A tap on a node / +N / edge must stay a real tap. Panning begins only
      // from empty map space so mobile finger jitter no longer steals clicks.
      if (interactiveTarget(event.target)) return;

      mapPanState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: viewport.scrollLeft,
        startTop: viewport.scrollTop,
        dragging: false,
        pointerType: event.pointerType || "mouse"
      };
      try { viewport.setPointerCapture?.(event.pointerId); } catch {}
    });

    viewport.addEventListener("pointermove", event => {
      if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, point(event));
      if (pinchState && updatePinch(event)) return;
      if (!mapPanState || event.pointerId !== mapPanState.pointerId) return;
      const dx = event.clientX - mapPanState.startX;
      const dy = event.clientY - mapPanState.startY;
      const threshold = mapPanState.pointerType === "touch" ? 10 : 5;
      if (!mapPanState.dragging && Math.hypot(dx, dy) < threshold) return;
      mapPanState.dragging = true;
      viewport.classList.add("is-panning");
      event.preventDefault();
      viewport.scrollLeft = mapPanState.startLeft - dx;
      viewport.scrollTop = mapPanState.startTop - dy;
    }, { passive: false });

    viewport.addEventListener("pointerup", finishPointer);
    viewport.addEventListener("pointercancel", finishPointer);
    viewport.addEventListener("lostpointercapture", event => {
      if (activePointers.has(event.pointerId)) finishPointer(event);
    });

    // Trackpad pinch / Ctrl+wheel on desktop follows the cursor position.
    viewport.addEventListener("wheel", event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * .0022);
      setScaleAtPoint(scale * factor, event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener("click", event => {
      if (performance.now() < suppressMapClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    }, true);
  }

  function clampScale(next) {
    return Math.min(1.7, Math.max(.42, Number(next) || .78));
  }

  function setScaleAtWorld(next, clientX, clientY, worldX, worldY) {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport) return setScale(next);
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    scale = clampScale(next);
    const stage = q("[data-relation-map-stage]");
    if (stage) stage.style.transform = `scale(${scale})`;
    updateCanvasSize();
    viewport.scrollLeft = Math.max(0, mapCanvasPadX + worldX * scale - localX);
    viewport.scrollTop = Math.max(0, mapCanvasPadY + worldY * scale - localY);
  }

  function setScaleAtPoint(next, clientX, clientY) {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport) return setScale(next);
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    updateCanvasSize();
    const worldX = (viewport.scrollLeft + localX - mapCanvasPadX) / scale;
    const worldY = (viewport.scrollTop + localY - mapCanvasPadY) / scale;
    setScaleAtWorld(next, clientX, clientY, worldX, worldY);
  }

  async function openRenameDialog() {
    q("[data-relation-manage-layer]").hidden = true;
    const layer = q("[data-relation-name-layer]");
    const input = q("[data-relation-name-input]");
    if (!layer || !input || !graph?.relation?.can_admin) return;
    input.value = graph.relation.name || "";
    layer.hidden = false;
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }

  function closeRenameDialog() {
    const layer = q("[data-relation-name-layer]");
    if (layer) layer.hidden = true;
  }

  async function saveRename() {
    const input = q("[data-relation-name-input]");
    const name = clean(input?.value);
    if (!name) {
      showToast("Nama relasi tidak boleh kosong.");
      input?.focus();
      return;
    }
    try {
      const next = await NotesService.gantiNamaRelasi(graph.relation.id, name);
      graph.relation.name = next || name;
      q("[data-relation-heading]").textContent = graph.relation.name;
      document.title = `${graph.relation.name} · RuangKitha`;
      closeRenameDialog();
      showToast("Nama relasi diperbarui.");
    } catch (error) {
      console.error("[Relation Rename]", error);
      showToast(error?.message || "Nama relasi belum dapat diubah.");
    }
  }

  async function deleteCurrentRelation() {
    if (!graph?.relation?.can_admin) return;
    q("[data-relation-manage-layer]").hidden = true;
    const ok = window.confirm(`Hapus relasi “${graph.relation.name}”?\n\nCatatan tidak ikut terhapus. Semua tautan inline yang dibuat untuk relasi ini akan dilepas dan teksnya tetap dipertahankan.`);
    if (!ok) return;
    try {
      await NotesService.hapusRelasi(graph.relation.id);
      location.replace(relationListHref(graph.relation.scope));
    } catch (error) {
      console.error("[Relation Delete]", error);
      if (NotesService.relationGraphSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004N agar penghapusan relasi membersihkan tautan inline.");
      else showToast(error?.message || "Relasi belum dapat dihapus.");
    }
  }

  function closeEdgeDialog() {
    const layer = q("[data-relation-edge-layer]");
    if (layer) layer.hidden = true;
    selectedEdge = null;
  }

  function openEdgeDialog(edge, nodesById) {
    if (!edge || !graph?.relation?.can_manage) return;
    const a = nodesById.get(edge.a);
    const b = nodesById.get(edge.b);
    if (!a || !b) return;
    selectedEdge = { a: edge.a, b: edge.b };
    const layer = q("[data-relation-edge-layer]");
    if (!layer) return;
    q("[data-relation-edge-a]").textContent = clean(a.title, "Tanpa judul");
    q("[data-relation-edge-b]").textContent = clean(b.title, "Tanpa judul");
    layer.hidden = false;
  }

  async function disconnectSelectedEdge() {
    if (!selectedEdge || !graph?.relation?.can_manage) return;
    const button = q("[data-relation-edge-disconnect]");
    if (button) button.disabled = true;
    const edge = { ...selectedEdge };
    try {
      await NotesService.putuskanRelasiAntarCatatan(graph.relation.id, edge.a, edge.b);
      graph.edges = (graph.edges || []).filter(item => !(
        (item.a === edge.a && item.b === edge.b) || (item.a === edge.b && item.b === edge.a)
      ));
      closeEdgeDialog();
      prepareProgressiveGraph(graph.nodes || [], graph.edges || []);
      renderGraph();
      requestAnimationFrame(centerMapOnGraph);
      showToast("Hubungan diputus. Teks tautan dikembalikan menjadi teks biasa.");
    } catch (error) {
      console.error("[Relation Disconnect]", error);
      if (NotesService.relationGraphSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004N agar pemutusan hubungan aktif.");
      else showToast(error?.message || "Hubungan belum dapat diputus.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function closeRelationCardMenus(except = null) {
    document.querySelectorAll(".relation-card-menu:not([hidden])").forEach(menu => {
      if (menu !== except) menu.hidden = true;
    });
  }

  async function deleteRelationFromList(group, card) {
    if (!group?.id || !group?.can_admin) return;
    closeRelationCardMenus();
    const ok = window.confirm(`Hapus relasi “${group.name}”?\n\nCatatan tidak ikut terhapus. Semua tautan inline yang dibuat untuk relasi ini akan dilepas dan teksnya tetap dipertahankan.`);
    if (!ok) return;

    const moreButton = card?.querySelector?.(".relation-card-more");
    if (moreButton) moreButton.disabled = true;
    try {
      await NotesService.hapusRelasi(group.id);
      card?.remove?.();
      const list = q("[data-relation-list]");
      const empty = q("[data-relation-empty]");
      if (empty && list) empty.hidden = list.children.length > 0;
      showToast("Relasi dihapus. Teks tautan dikembalikan menjadi teks biasa.");
    } catch (error) {
      console.error("[Relation List Delete]", error);
      if (NotesService.relationGraphSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004N agar penghapusan relasi membersihkan tautan inline.");
      else showToast(error?.message || "Relasi belum dapat dihapus.");
    } finally {
      if (moreButton?.isConnected) moreButton.disabled = false;
    }
  }

  async function loadList() {
    q("[data-relation-list-view]").hidden = false;
    q("[data-relation-graph-view]").hidden = true;
    q("[data-relation-menu]").hidden = true;
    q("[data-relation-kicker]").textContent = "Peta Catatan";
    q("[data-relation-heading]").textContent = "Relasi Catatan";
    q("[data-relation-list-title]").textContent = requestedScope === "family" ? "Relasi Keluarga" : "Relasi Pribadi";
    q("[data-relation-list-copy]").textContent = requestedScope === "family"
      ? "Peta hubungan catatan yang dapat dilihat bersama keluarga."
      : "Peta hubungan antarcatatan dalam ruang pribadimu.";

    const list = q("[data-relation-list]");
    const empty = q("[data-relation-empty]");
    list.innerHTML = "";
    let groups = [];
    try {
      groups = await NotesService.ambilDaftarRelasi(requestedScope, familyId || null);
    } catch (error) {
      console.error("[Relation List]", error);
      if (NotesService.relationGraphSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004M agar Peta Relasi aktif.");
      else showToast(error?.message || "Relasi belum dapat dimuat.");
    }

    groups.forEach(group => {
      const card = document.createElement("article");
      card.className = "relation-list-card";

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "relation-card-main";
      openButton.innerHTML = `
        <span class="relation-card-icon"><ion-icon name="git-network-outline" aria-hidden="true"></ion-icon></span>
        <span class="relation-card-copy"><strong>${escapeHtml(group.name)}</strong><small>${group.node_count} catatan · ${escapeHtml(scopeLabel(group.scope))}</small></span>
        <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>`;
      openButton.addEventListener("click", () => {
        location.href = `catatan-relasi.html?id=${encodeURIComponent(group.id)}&scope=${group.scope}`;
      });
      card.appendChild(openButton);

      if (group.can_admin) {
        const actions = document.createElement("div");
        actions.className = "relation-card-actions";
        const more = document.createElement("button");
        more.type = "button";
        more.className = "relation-card-more";
        more.setAttribute("aria-label", `Kelola relasi ${group.name}`);
        more.setAttribute("aria-haspopup", "menu");
        more.setAttribute("aria-expanded", "false");
        more.innerHTML = '<ion-icon name="ellipsis-horizontal" aria-hidden="true"></ion-icon>';

        const menu = document.createElement("div");
        menu.className = "relation-card-menu";
        menu.setAttribute("role", "menu");
        menu.hidden = true;
        menu.innerHTML = `<button type="button" class="is-danger" role="menuitem"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon><span>Hapus relasi</span></button>`;

        more.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const willOpen = menu.hidden;
          closeRelationCardMenus(menu);
          menu.hidden = !willOpen;
          more.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
        menu.querySelector("button")?.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          deleteRelationFromList(group, card);
        });
        actions.append(more, menu);
        card.appendChild(actions);
      }

      list.appendChild(card);
    });
    empty.hidden = groups.length > 0;
  }

  function uniqueEdges(nodes, edges) {
    const valid = new Set(nodes.map(node => node.id));
    const seen = new Set();
    const cleanEdges = [];
    (edges || []).forEach(edge => {
      const a = clean(edge?.a);
      const b = clean(edge?.b);
      if (!a || !b || a === b || !valid.has(a) || !valid.has(b)) return;
      const key = a < b ? `${a}::${b}` : `${b}::${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      cleanEdges.push({ ...edge, a, b });
    });
    return cleanEdges;
  }

  function adjacencyMap(nodes, edges) {
    const map = new Map(nodes.map(node => [node.id, new Set()]));
    uniqueEdges(nodes, edges).forEach(edge => {
      map.get(edge.a)?.add(edge.b);
      map.get(edge.b)?.add(edge.a);
    });
    return map;
  }

  function connectedComponents(nodeIds, adjacency) {
    const remaining = new Set(nodeIds);
    const components = [];
    while (remaining.size) {
      const start = remaining.values().next().value;
      const comp = [];
      const queue = [start];
      remaining.delete(start);
      while (queue.length) {
        const id = queue.shift();
        comp.push(id);
        (adjacency.get(id) || []).forEach(next => {
          if (remaining.has(next)) {
            remaining.delete(next);
            queue.push(next);
          }
        });
      }
      components.push(comp);
    }
    return components;
  }

  function chooseFocus(nodes, adjacency) {
    if (requestedFocus && nodes.some(node => node.id === requestedFocus)) return requestedFocus;
    const nonIsolated = nodes.filter(node => (adjacency.get(node.id)?.size || 0) > 0);
    const source = nonIsolated.length ? nonIsolated : nodes;
    return source.slice().sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0))[0]?.id || "";
  }

  function prepareProgressiveGraph(nodes, edges) {
    const adjacency = adjacencyMap(nodes, edges);
    const connectedIds = nodes.filter(node => (adjacency.get(node.id)?.size || 0) > 0).map(node => node.id);
    focusId = connectedIds.length ? chooseFocus(nodes.filter(node => connectedIds.includes(node.id)), adjacency) : "";
    expanded.clear();
    expansionLimits.clear();
    seedVisible.clear();
    if (!focusId) return adjacency;
    seedVisible.add(focusId);
    expanded.add(focusId);
    expansionLimits.set(focusId, 8);

    const components = connectedComponents(connectedIds, adjacency);
    components.forEach(component => {
      if (component.includes(focusId)) return;
      const root = component.slice().sort((a, b) => (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0))[0];
      if (root) seedVisible.add(root);
    });
    return adjacency;
  }

  function visibleNodeIds(adjacency) {
    const visible = new Set(seedVisible);
    expanded.forEach(id => {
      visible.add(id);
      const neighbors = Array.from(adjacency.get(id) || []);
      const limit = Math.max(1, expansionLimits.get(id) || 8);
      neighbors.slice(0, limit).forEach(next => visible.add(next));
    });
    return visible;
  }

  function componentEdgeCount(component, adjacency) {
    const ids = new Set(component);
    let degreeTotal = 0;
    component.forEach(id => {
      (adjacency.get(id) || []).forEach(next => {
        if (ids.has(next)) degreeTotal += 1;
      });
    });
    return degreeTotal / 2;
  }

  function cycleOrder(component, adjacency) {
    if (component.length < 3) return null;
    const ids = new Set(component);
    if (componentEdgeCount(component, adjacency) !== component.length) return null;
    if (!component.every(id => Array.from(adjacency.get(id) || []).filter(next => ids.has(next)).length === 2)) return null;

    const start = component.includes(focusId) ? focusId : component[0];
    const order = [start];
    let previous = "";
    let current = start;
    while (order.length < component.length) {
      const candidates = Array.from(adjacency.get(current) || [])
        .filter(next => ids.has(next) && next !== previous)
        .sort();
      let next = candidates.find(id => id !== start && !order.includes(id));
      if (!next) next = candidates.find(id => !order.includes(id));
      if (!next) return null;
      order.push(next);
      previous = current;
      current = next;
    }
    return order;
  }

  function layoutCycle(component, adjacency, center, positions) {
    const order = cycleOrder(component, adjacency);
    if (!order) return false;
    const count = order.length;
    const radius = Math.min(350, Math.max(205, 150 + count * 24));
    order.forEach((id, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
      positions.set(id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        angle,
        depth: 0,
        layout: "cycle"
      });
    });
    return true;
  }

  function chooseComponentRoot(component, adjacency) {
    return component.slice().sort((a, b) => {
      const degreeDiff = (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0);
      if (degreeDiff) return degreeDiff;
      if (a === focusId) return -1;
      if (b === focusId) return 1;
      return String(a).localeCompare(String(b));
    })[0];
  }

  function layoutMindMap(component, adjacency, center, positions) {
    if (!component.length) return;
    if (component.length === 1) {
      positions.set(component[0], { ...center, angle: -Math.PI / 2, depth: 0, layout: "single" });
      return;
    }
    if (component.length === 2) {
      positions.set(component[0], { x: center.x, y: center.y - 125, angle: -Math.PI / 2, depth: 0, layout: "pair" });
      positions.set(component[1], { x: center.x, y: center.y + 125, angle: Math.PI / 2, depth: 1, layout: "pair" });
      return;
    }

    const root = chooseComponentRoot(component, adjacency);
    const allowed = new Set(component);
    positions.set(root, { ...center, angle: -Math.PI / 2, depth: 0, layout: "mindmap" });
    const visited = new Set([root]);
    const queue = [{ id: root, depth: 0, angle: -Math.PI / 2, sector: Math.PI * 2 }];

    while (queue.length) {
      const current = queue.shift();
      const children = Array.from(adjacency.get(current.id) || [])
        .filter(id => allowed.has(id) && !visited.has(id))
        .sort((a, b) => (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0));
      const count = children.length;
      children.forEach((child, index) => {
        visited.add(child);
        const depth = current.depth + 1;
        let angle;
        let sector;
        if (current.depth === 0) {
          angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count);
          sector = Math.min(Math.PI * .78, Math.PI * 2 / Math.max(1, count));
        } else {
          sector = Math.max(.42, current.sector * .68);
          const span = sector * Math.max(0, count - 1);
          angle = current.angle - span / 2 + index * sector;
        }
        const radius = depth === 1 ? Math.min(305, Math.max(220, count * 42)) : Math.min(405, 175 * depth);
        positions.set(child, {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          angle,
          depth,
          layout: "mindmap"
        });
        queue.push({ id: child, depth, angle, sector });
      });
    }

    // A component may contain a secondary cycle/cross-link. Any node not
    // reached above is placed around the outer ring rather than stacked.
    const leftovers = component.filter(id => !positions.has(id));
    leftovers.forEach((id, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, leftovers.length);
      positions.set(id, {
        x: center.x + Math.cos(angle) * 330,
        y: center.y + Math.sin(angle) * 330,
        angle,
        depth: 2,
        layout: "outer"
      });
    });
  }

  function relaxPositions(component, adjacency, positions, center) {
    if (component.length < 3 || component.length > 18) return;
    const ids = component.filter(id => positions.has(id));
    const idealEdge = 235;
    const minX = 105;
    const maxX = STAGE_W - 105;
    const minY = 78;
    const maxY = STAGE_H - 78;

    // A short deterministic relaxation pass improves mixed graphs without
    // turning the map into a constantly moving physics simulation.
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const force = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const a = positions.get(ids[i]);
          const b = positions.get(ids[j]);
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy) || 1;
          const target = 205;
          if (distance < target) {
            const push = (target - distance) * .055;
            dx /= distance;
            dy /= distance;
            force.get(ids[i]).x -= dx * push;
            force.get(ids[i]).y -= dy * push;
            force.get(ids[j]).x += dx * push;
            force.get(ids[j]).y += dy * push;
          }
        }
      }
      ids.forEach(id => {
        const from = positions.get(id);
        (adjacency.get(id) || []).forEach(next => {
          if (!force.has(next) || String(id) > String(next)) return;
          const to = positions.get(next);
          let dx = to.x - from.x;
          let dy = to.y - from.y;
          let distance = Math.hypot(dx, dy) || 1;
          const pull = (distance - idealEdge) * .012;
          dx /= distance;
          dy /= distance;
          force.get(id).x += dx * pull;
          force.get(id).y += dy * pull;
          force.get(next).x -= dx * pull;
          force.get(next).y -= dy * pull;
        });
      });
      ids.forEach(id => {
        const pos = positions.get(id);
        const delta = force.get(id);
        pos.x = Math.max(minX, Math.min(maxX, pos.x + delta.x));
        pos.y = Math.max(minY, Math.min(maxY, pos.y + delta.y));
      });
    }

    // Preserve the visual center of this component after relaxation.
    const xs = ids.map(id => positions.get(id).x);
    const ys = ids.map(id => positions.get(id).y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const shiftX = center.x - cx;
    const shiftY = center.y - cy;
    ids.forEach(id => {
      const pos = positions.get(id);
      pos.x = Math.max(minX, Math.min(maxX, pos.x + shiftX));
      pos.y = Math.max(minY, Math.min(maxY, pos.y + shiftY));
    });
  }

  function layoutPositions(visibleIds, adjacency) {
    const positions = new Map();
    if (!visibleIds.size) {
      lastLayoutBounds = null;
      return positions;
    }

    const components = connectedComponents(Array.from(visibleIds), adjacency)
      .sort((a, b) => {
        if (a.includes(focusId)) return -1;
        if (b.includes(focusId)) return 1;
        return b.length - a.length;
      });
    const slots = [
      CENTER,
      { x: 250, y: 220 }, { x: 950, y: 220 },
      { x: 250, y: 660 }, { x: 950, y: 660 },
      { x: 600, y: 175 }, { x: 600, y: 690 }
    ];

    components.forEach((component, index) => {
      const center = slots[index % slots.length];
      const cycle = layoutCycle(component, adjacency, center, positions);
      if (!cycle) {
        layoutMindMap(component, adjacency, center, positions);
        const edges = componentEdgeCount(component, adjacency);
        if (edges >= component.length) relaxPositions(component, adjacency, positions, center);
      }
    });

    const placed = Array.from(positions.values());
    if (placed.length) {
      lastLayoutBounds = {
        minX: Math.min(...placed.map(pos => pos.x)),
        maxX: Math.max(...placed.map(pos => pos.x)),
        minY: Math.min(...placed.map(pos => pos.y)),
        maxY: Math.max(...placed.map(pos => pos.y))
      };
    } else {
      lastLayoutBounds = null;
    }
    return positions;
  }

  function curvedPath(a, b) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.min(34, len * .1);
    const cx = mx - (dy / len) * bend;
    const cy = my + (dx / len) * bend;
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  }

  function renderGraph() {
    if (!graph) return;
    const nodes = graph.nodes || [];
    const edges = uniqueEdges(nodes, graph.edges || []);
    const nodesById = new Map(nodes.map(node => [node.id, node]));
    const adjacency = adjacencyMap(nodes, edges);
    const isolated = nodes.filter(node => (adjacency.get(node.id)?.size || 0) === 0);
    const connectedCount = nodes.length - isolated.length;
    const mapShell = q("[data-relation-map-shell]");
    if (mapShell) mapShell.hidden = connectedCount === 0;
    const visibleIds = connectedCount > 0 ? visibleNodeIds(adjacency) : new Set();
    const positions = layoutPositions(visibleIds, adjacency);
    const nodeLayer = q("[data-relation-map-nodes]");
    const lineLayer = q("[data-relation-map-lines]");
    nodeLayer.innerHTML = "";
    lineLayer.innerHTML = "";

    edges.forEach(edge => {
      if (!visibleIds.has(edge.a) || !visibleIds.has(edge.b)) return;
      const a = positions.get(edge.a);
      const b = positions.get(edge.b);
      if (!a || !b) return;
      const d = curvedPath(a, b);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "relation-map-line");
      path.setAttribute("d", d);
      lineLayer.appendChild(path);

      if (graph.relation.can_manage) {
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const aNote = nodesById.get(edge.a);
        const bNote = nodesById.get(edge.b);
        hit.setAttribute("class", "relation-edge-hit");
        hit.setAttribute("d", d);
        hit.setAttribute("tabindex", "0");
        hit.setAttribute("role", "button");
        hit.setAttribute("aria-label", `Kelola hubungan ${clean(aNote?.title, "catatan")} dan ${clean(bNote?.title, "catatan")}`);
        hit.addEventListener("click", event => {
          if (performance.now() < suppressMapClickUntil) return;
          event.stopPropagation();
          openEdgeDialog(edge, nodesById);
        });
        hit.addEventListener("keydown", event => {
          if (!["Enter", " "].includes(event.key)) return;
          event.preventDefault();
          openEdgeDialog(edge, nodesById);
        });
        lineLayer.appendChild(hit);
      }
    });

    Array.from(visibleIds).forEach(id => {
      const note = nodesById.get(id);
      const pos = positions.get(id);
      if (!note || !pos) return;
      const hiddenCount = Array.from(adjacency.get(id) || []).filter(next => !visibleIds.has(next)).length;
      const wrap = document.createElement("div");
      wrap.className = `relation-node-wrap${id === focusId ? " is-focus" : ""}${note.archived_at ? " is-archived" : ""}`;
      wrap.style.left = `${pos.x}px`;
      wrap.style.top = `${pos.y}px`;
      wrap.dataset.noteId = id;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "relation-node";
      button.innerHTML = `
        <span class="relation-node-icon"><ion-icon name="${noteIcon(note)}" aria-hidden="true"></ion-icon></span>
        <span><strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong><small>${escapeHtml(noteMeta(note))}</small></span>`;
      button.addEventListener("click", event => {
        if (performance.now() < suppressMapClickUntil) {
          event.preventDefault();
          return;
        }
        openNote(note);
      });
      wrap.appendChild(button);

      if (hiddenCount > 0) {
        const branch = document.createElement("button");
        branch.type = "button";
        branch.className = "relation-branch-button";
        branch.textContent = `+${hiddenCount}`;
        branch.setAttribute("aria-label", `Tampilkan ${hiddenCount} cabang dari ${clean(note.title, "catatan ini")}`);
        branch.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const before = hiddenCount;
          if (expanded.has(id)) expansionLimits.set(id, (expansionLimits.get(id) || 8) + 8);
          else {
            expanded.add(id);
            expansionLimits.set(id, 8);
          }
          renderGraph();
          if (before > 0) showToast(`${Math.min(before, 8)} cabang ditampilkan.`);
        });
        wrap.appendChild(branch);
      }
      nodeLayer.appendChild(wrap);
    });

    const isolatedSection = q("[data-relation-isolated]");
    const isolatedList = q("[data-relation-isolated-list]");
    const isolatedCount = q("[data-relation-isolated-count]");
    isolatedSection.hidden = isolated.length === 0;
    isolatedCount.textContent = String(isolated.length);
    isolatedList.innerHTML = "";
    isolated.forEach(note => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "relation-isolated-row";
      row.innerHTML = `
        <span class="relation-node-icon"><ion-icon name="${noteIcon(note)}"></ion-icon></span>
        <span><strong>${escapeHtml(clean(note.title, "Tanpa judul"))}</strong><small>${escapeHtml(noteMeta(note))}</small></span>
        <ion-icon name="chevron-forward-outline"></ion-icon>`;
      row.addEventListener("click", () => openNote(note));
      isolatedList.appendChild(row);
    });

    updateCanvasSize();
    if (!initializedMapScroll) {
      initializedMapScroll = true;
      requestAnimationFrame(centerMapOnGraph);
    }
  }

  function setScale(next) {
    scale = clampScale(next);
    const stage = q("[data-relation-map-stage]");
    if (stage) stage.style.transform = `scale(${scale})`;
    updateCanvasSize();
  }

  function updateCanvasSize() {
    const canvas = q("[data-relation-map-canvas]");
    const stage = q("[data-relation-map-stage]");
    const viewport = q("[data-relation-map-viewport]");
    if (!canvas || !stage || !viewport) return;

    // a43a: give the graph breathing room on every side so the map behaves
    // like a small free-room canvas instead of a tightly clipped scroll area.
    mapCanvasPadX = Math.max(280, Math.round(viewport.clientWidth * .72));
    mapCanvasPadY = Math.max(250, Math.round(viewport.clientHeight * .52));

    stage.style.left = `${mapCanvasPadX}px`;
    stage.style.top = `${mapCanvasPadY}px`;
    stage.style.transform = `scale(${scale})`;
    canvas.style.width = `${STAGE_W * scale + mapCanvasPadX * 2}px`;
    canvas.style.height = `${STAGE_H * scale + mapCanvasPadY * 2}px`;
  }

  function centerMapOnGraph() {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport) return;
    updateCanvasSize();
    const graphCenterX = lastLayoutBounds
      ? (lastLayoutBounds.minX + lastLayoutBounds.maxX) / 2
      : CENTER.x;
    const graphCenterY = lastLayoutBounds
      ? (lastLayoutBounds.minY + lastLayoutBounds.maxY) / 2
      : CENTER.y;
    const centerX = mapCanvasPadX + graphCenterX * scale;
    const centerY = mapCanvasPadY + graphCenterY * scale;
    viewport.scrollTo({
      left: Math.max(0, centerX - viewport.clientWidth / 2),
      top: Math.max(0, centerY - viewport.clientHeight / 2),
      behavior: "smooth"
    });
  }

  async function loadGraph() {
    q("[data-relation-list-view]").hidden = true;
    q("[data-relation-graph-view]").hidden = false;
    try {
      graph = await NotesService.ambilGraphRelasi(relationId);
      if (!graph?.relation?.id) throw new Error("Relasi tidak ditemukan.");
    } catch (error) {
      console.error("[Relation Graph]", error);
      if (NotesService.relationGraphSchemaBelumTerpasang?.(error)) showToast("Jalankan SQL 004M agar Peta Relasi aktif.");
      else showToast(error?.message || "Peta relasi belum dapat dimuat.");
      setTimeout(() => location.replace(relationListHref(requestedScope)), 800);
      return;
    }

    q("[data-relation-kicker]").textContent = "Peta Relasi";
    q("[data-relation-heading]").textContent = graph.relation.name;
    q("[data-relation-scope-chip]").textContent = scopeLabel(graph.relation.scope);
    q("[data-relation-node-count]").textContent = `${graph.nodes.length} catatan`;
    q("[data-relation-menu]").hidden = !graph.relation.can_admin;
    document.title = `${graph.relation.name} · RuangKitha`;

    const adjacency = prepareProgressiveGraph(graph.nodes, graph.edges);
    setScale(window.innerWidth < 520 ? .72 : .86);
    renderGraph(adjacency);
  }

  async function init() {
    setupStaticInteractions();
    if (window.AUTH_READY) {
      const allowed = await window.AUTH_READY;
      if (allowed === false) return;
    }
    try {
      const user = await AuthService.ambilUserAktif();
      if (!user) return;
      userId = clean(user.id);
      try {
        const family = await AuthRouter.ambilFamilyAktif();
        familyId = clean(family?.id);
      } catch {
        familyId = "";
      }
      if (relationId) await loadGraph();
      else await loadList();
    } catch (error) {
      console.error("[Catatan Relation Init]", error);
      showToast(error?.message || "Relasi Catatan belum dapat dibuka.");
    } finally {
      q("[data-relation-page]")?.setAttribute("aria-busy", "false");
    }
  }

  window.addEventListener("resize", () => {
    if (!relationId || !graph) return;
    updateCanvasSize();
  }, { passive: true });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
