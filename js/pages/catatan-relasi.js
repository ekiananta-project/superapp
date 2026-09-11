// RuangKitha v2.0.0a43a — Relation Map Free-Room Pan UX Hotfix
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
  let suppressMapClickUntil = 0;
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
    q("[data-zoom-in]")?.addEventListener("click", () => setScale(scale + .12));
    q("[data-zoom-out]")?.addEventListener("click", () => setScale(scale - .12));
    q("[data-zoom-reset]")?.addEventListener("click", () => {
      setScale(window.innerWidth < 520 ? .72 : .86);
      centerMapOnFocus();
    });
    setupMapPanning();
  }

  function setupMapPanning() {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport || viewport.dataset.freeRoomReady === "true") return;
    viewport.dataset.freeRoomReady = "true";

    const endPan = event => {
      if (!mapPanState || (event?.pointerId != null && event.pointerId !== mapPanState.pointerId)) return;
      const wasDragging = mapPanState.dragging;
      try {
        if (viewport.hasPointerCapture?.(mapPanState.pointerId)) viewport.releasePointerCapture(mapPanState.pointerId);
      } catch {}
      mapPanState = null;
      viewport.classList.remove("is-panning");
      if (wasDragging) suppressMapClickUntil = performance.now() + 220;
    };

    viewport.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      mapPanState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: viewport.scrollLeft,
        startTop: viewport.scrollTop,
        dragging: false
      };
      try { viewport.setPointerCapture?.(event.pointerId); } catch {}
    });

    viewport.addEventListener("pointermove", event => {
      if (!mapPanState || event.pointerId !== mapPanState.pointerId) return;
      const dx = event.clientX - mapPanState.startX;
      const dy = event.clientY - mapPanState.startY;
      if (!mapPanState.dragging && Math.hypot(dx, dy) < 6) return;
      mapPanState.dragging = true;
      viewport.classList.add("is-panning");
      event.preventDefault();
      viewport.scrollLeft = mapPanState.startLeft - dx;
      viewport.scrollTop = mapPanState.startTop - dy;
    }, { passive: false });

    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);
    viewport.addEventListener("lostpointercapture", endPan);
    viewport.addEventListener("click", event => {
      if (performance.now() < suppressMapClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    }, true);
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
    const ok = window.confirm(`Hapus relasi “${graph.relation.name}”?\n\nCatatan di dalamnya tidak akan ikut terhapus.`);
    if (!ok) return;
    try {
      await NotesService.hapusRelasi(graph.relation.id);
      location.replace(relationListHref(graph.relation.scope));
    } catch (error) {
      console.error("[Relation Delete]", error);
      showToast(error?.message || "Relasi belum dapat dihapus.");
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "relation-list-card";
      button.innerHTML = `
        <span class="relation-card-icon"><ion-icon name="git-network-outline" aria-hidden="true"></ion-icon></span>
        <span><strong>${escapeHtml(group.name)}</strong><small>${group.node_count} catatan · ${escapeHtml(scopeLabel(group.scope))}</small></span>
        <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>`;
      button.addEventListener("click", () => {
        location.href = `catatan-relasi.html?id=${encodeURIComponent(group.id)}&scope=${group.scope}`;
      });
      list.appendChild(button);
    });
    empty.hidden = groups.length > 0;
  }

  function adjacencyMap(nodes, edges) {
    const map = new Map(nodes.map(node => [node.id, new Set()]));
    edges.forEach(edge => {
      if (!map.has(edge.a) || !map.has(edge.b)) return;
      map.get(edge.a).add(edge.b);
      map.get(edge.b).add(edge.a);
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

  function layoutPositions(visibleIds, adjacency) {
    const positions = new Map();
    if (!visibleIds.size) return positions;
    positions.set(focusId, { ...CENTER, angle: -Math.PI / 2, depth: 0 });

    const visited = new Set([focusId]);
    const queue = [{ id: focusId, depth: 0, angle: -Math.PI / 2, sector: Math.PI * 2 }];
    while (queue.length) {
      const current = queue.shift();
      const children = Array.from(adjacency.get(current.id) || []).filter(id => visibleIds.has(id) && !visited.has(id));
      const count = children.length;
      children.forEach((child, index) => {
        visited.add(child);
        const depth = current.depth + 1;
        let angle;
        let sector;
        if (current.depth === 0) {
          angle = -Math.PI / 2 + (index * Math.PI * 2 / Math.max(1, count));
          sector = Math.min(Math.PI * .72, Math.PI * 2 / Math.max(1, count));
        } else {
          sector = Math.max(.38, current.sector * .72);
          const span = sector * Math.max(0, count - 1);
          angle = current.angle - span / 2 + index * sector;
        }
        const radius = current.depth === 0
          ? Math.min(320, Math.max(200, count * 30))
          : Math.min(390, 180 * depth);
        const x = CENTER.x + Math.cos(angle) * radius;
        const y = CENTER.y + Math.sin(angle) * radius;
        positions.set(child, { x, y, angle, depth });
        queue.push({ id: child, depth, angle, sector });
      });
    }

    // Disconnected components remain separate mini-branches instead of being
    // forced into the focus tree. One visible root per component acts as its
    // anchor; tapping +N progressively unfolds that component too.
    const remaining = new Set(Array.from(visibleIds).filter(id => !visited.has(id)));
    const slots = [
      { x: 190, y: 160 }, { x: 1010, y: 160 }, { x: 190, y: 700 }, { x: 1010, y: 700 },
      { x: 600, y: 120 }, { x: 600, y: 740 }
    ];
    let componentIndex = 0;
    while (remaining.size) {
      const rootId = remaining.values().next().value;
      const localCenter = slots[componentIndex % slots.length];
      componentIndex += 1;
      positions.set(rootId, { ...localCenter, angle: -Math.PI / 2, depth: 0 });
      remaining.delete(rootId);
      visited.add(rootId);

      const localQueue = [{ id: rootId, depth: 0, angle: -Math.PI / 2, sector: Math.PI * 2 }];
      while (localQueue.length) {
        const current = localQueue.shift();
        const children = Array.from(adjacency.get(current.id) || []).filter(id => remaining.has(id));
        const count = children.length;
        children.forEach((child, index) => {
          remaining.delete(child);
          visited.add(child);
          const depth = current.depth + 1;
          const sector = current.depth === 0
            ? Math.min(Math.PI * .65, Math.PI * 2 / Math.max(1, count))
            : Math.max(.42, current.sector * .7);
          const span = sector * Math.max(0, count - 1);
          const angle = current.depth === 0
            ? (-Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count))
            : (current.angle - span / 2 + index * sector);
          const radius = Math.min(235, 125 * depth);
          const x = Math.max(95, Math.min(STAGE_W - 95, localCenter.x + Math.cos(angle) * radius));
          const y = Math.max(75, Math.min(STAGE_H - 75, localCenter.y + Math.sin(angle) * radius));
          positions.set(child, { x, y, angle, depth });
          localQueue.push({ id: child, depth, angle, sector });
        });
      }
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
    const edges = graph.edges || [];
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
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "relation-map-line");
      path.setAttribute("d", curvedPath(a, b));
      lineLayer.appendChild(path);
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
      button.addEventListener("click", () => openNote(note));
      wrap.appendChild(button);

      if (hiddenCount > 0) {
        const branch = document.createElement("button");
        branch.type = "button";
        branch.className = "relation-branch-button";
        branch.textContent = `+${hiddenCount}`;
        branch.setAttribute("aria-label", `Tampilkan ${hiddenCount} cabang dari ${clean(note.title, "catatan ini")}`);
        branch.addEventListener("click", event => {
          event.stopPropagation();
          if (expanded.has(id)) expansionLimits.set(id, (expansionLimits.get(id) || 8) + 8);
          else {
            expanded.add(id);
            expansionLimits.set(id, 8);
          }
          renderGraph();
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
      requestAnimationFrame(centerMapOnFocus);
    }
  }

  function setScale(next) {
    scale = Math.min(1.3, Math.max(.5, Number(next) || .78));
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

  function centerMapOnFocus() {
    const viewport = q("[data-relation-map-viewport]");
    if (!viewport) return;
    updateCanvasSize();
    const centerX = mapCanvasPadX + CENTER.x * scale;
    const centerY = mapCanvasPadY + CENTER.y * scale;
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
