(() => {
  "use strict";

  const STORAGE_KEY = "keuangan_pengaturan_v1";
  const DEFAULTS = {
    periodeAktif: "month",
    periodeMulai: "",
    periodeSelesai: ""
  };

  let mounted = false;
  let calendarMonth = null;
  let tempStart = "";
  let tempEnd = "";
  let awaitingEnd = false;

  function readPrefs() {
    try {
      return {
        ...DEFAULTS,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function writePrefs(next) {
    const old = readPrefs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...old, ...next }));
  }

  function localDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDate(value) {
    if (!value) return null;
    const [y, m, d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function rangeFor(mode, prefs = readPrefs()) {
    if (mode === "all") return { startDate: null, endDate: null };

    if (mode === "custom") {
      const startDate = prefs.periodeMulai || null;
      const endDate = prefs.periodeSelesai || startDate || null;
      return { startDate, endDate };
    }

    const now = new Date();
    let start;
    let end;

    if (mode === "week") {
      start = new Date(now);
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
    } else if (mode === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { startDate: localDate(start), endDate: localDate(end) };
  }

  function shortDate(date, includeYear = false) {
    if (!date) return "";
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      ...(includeYear ? { year: "numeric" } : {})
    });
  }

  function labelFor(mode, prefs = readPrefs()) {
    const now = new Date();
    if (mode === "all") return "Semua Waktu";
    if (mode === "year") return String(now.getFullYear());
    if (mode === "month") {
      return now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }
    if (mode === "week") {
      const { startDate, endDate } = rangeFor("week", prefs);
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      if (!start || !end) return "1 Minggu";
      const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
      if (sameMonth) {
        return `${start.getDate()}–${end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
      }
      return `${shortDate(start)} – ${shortDate(end, true)}`;
    }
    if (mode === "custom") {
      const start = parseDate(prefs.periodeMulai);
      const end = parseDate(prefs.periodeSelesai || prefs.periodeMulai);
      if (!start) return "Pilih Tanggal";
      if (!end || localDate(start) === localDate(end)) return shortDate(start, true);
      const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
      if (sameMonth) {
        return `${start.getDate()}–${end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
      }
      return `${shortDate(start)} – ${shortDate(end, true)}`;
    }
    return "Periode";
  }

  function current() {
    const prefs = readPrefs();
    const mode = prefs.periodeAktif || "month";
    return {
      mode,
      label: labelFor(mode, prefs),
      ...rangeFor(mode, prefs)
    };
  }

  function setLayerHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  }

  function closeAll() {
    setLayerHidden("finance-period-sheet", true);
    setLayerHidden("finance-date-sheet", true);
  }

  function ensureUI() {
    if (document.getElementById("finance-period-sheet")) return;

    const periodLayer = document.createElement("div");
    periodLayer.className = "lapisan finance-period-layer";
    periodLayer.id = "finance-period-sheet";
    periodLayer.hidden = true;
    periodLayer.innerHTML = `
      <section class="bottom-sheet finance-period-sheet" role="dialog" aria-modal="true" aria-labelledby="finance-period-title">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h2 id="finance-period-title">Pilih Periode</h2>
          <button class="tombol-ikon" type="button" data-finance-period-close aria-label="Tutup pilihan periode">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>
        <button class="pilihan-sheet" type="button" data-finance-mode="all"><ion-icon name="infinite-outline"></ion-icon><span>Semua</span></button>
        <button class="pilihan-sheet" type="button" data-finance-mode="year"><ion-icon name="albums-outline"></ion-icon><span>1 Tahun</span></button>
        <button class="pilihan-sheet" type="button" data-finance-mode="month"><ion-icon name="calendar-outline"></ion-icon><span>1 Bulan</span></button>
        <button class="pilihan-sheet" type="button" data-finance-mode="week"><ion-icon name="calendar-number-outline"></ion-icon><span>1 Minggu</span></button>
        <button class="pilihan-sheet" type="button" data-finance-mode="custom"><ion-icon name="calendar-clear-outline"></ion-icon><span>Pilih Tanggal</span></button>
      </section>`;

    const dateLayer = document.createElement("div");
    dateLayer.className = "lapisan finance-period-layer";
    dateLayer.id = "finance-date-sheet";
    dateLayer.hidden = true;
    dateLayer.innerHTML = `
      <section class="bottom-sheet finance-date-sheet" role="dialog" aria-modal="true" aria-labelledby="finance-date-title">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div>
            <h2 id="finance-date-title">Pilih Tanggal</h2>
            <p class="finance-date-subtitle" data-finance-date-hint>Pilih satu tanggal atau rentang tanggal.</p>
          </div>
          <button class="tombol-ikon" type="button" data-finance-date-close aria-label="Tutup pemilih tanggal">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>
        <div class="finance-calendar-nav">
          <button type="button" class="tombol-ikon" data-finance-month-prev aria-label="Bulan sebelumnya"><ion-icon name="chevron-back-outline"></ion-icon></button>
          <strong data-finance-calendar-title></strong>
          <button type="button" class="tombol-ikon" data-finance-month-next aria-label="Bulan berikutnya"><ion-icon name="chevron-forward-outline"></ion-icon></button>
        </div>
        <div class="finance-calendar-weekdays" aria-hidden="true"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div>
        <div class="finance-calendar-grid" data-finance-calendar-grid></div>
        <div class="finance-date-selection" data-finance-date-selection>Belum ada tanggal dipilih.</div>
        <button class="tombol-utama finance-date-apply" type="button" data-finance-date-apply disabled>Gunakan Tanggal</button>
      </section>`;

    document.body.append(periodLayer, dateLayer);

    periodLayer.addEventListener("click", event => {
      if (event.target === periodLayer) setLayerHidden("finance-period-sheet", true);
    });
    dateLayer.addEventListener("click", event => {
      if (event.target === dateLayer) setLayerHidden("finance-date-sheet", true);
    });

    periodLayer.querySelector("[data-finance-period-close]")?.addEventListener("click", () => setLayerHidden("finance-period-sheet", true));
    dateLayer.querySelector("[data-finance-date-close]")?.addEventListener("click", () => setLayerHidden("finance-date-sheet", true));

    periodLayer.querySelectorAll("[data-finance-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const mode = button.dataset.financeMode;
        if (mode === "custom") {
          setLayerHidden("finance-period-sheet", true);
          openCalendar();
          return;
        }
        writePrefs({ periodeAktif: mode, periodeMulai: "", periodeSelesai: "" });
        setLayerHidden("finance-period-sheet", true);
        syncTriggers();
        emitChange();
      });
    });

    dateLayer.querySelector("[data-finance-month-prev]")?.addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() - 1);
      renderCalendar();
    });
    dateLayer.querySelector("[data-finance-month-next]")?.addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() + 1);
      renderCalendar();
    });
    dateLayer.querySelector("[data-finance-date-apply]")?.addEventListener("click", applyCustomRange);
  }

  function optionState() {
    const prefs = readPrefs();
    document.querySelectorAll("[data-finance-mode]").forEach(button => {
      const active = button.dataset.financeMode === prefs.periodeAktif;
      button.classList.toggle("is-aktif", active);
      let check = button.querySelector(".cek");
      if (active && !check) {
        check = document.createElement("ion-icon");
        check.className = "cek";
        check.setAttribute("name", "checkmark-circle");
        button.appendChild(check);
      } else if (!active && check) {
        check.remove();
      }
    });
  }

  function openPeriod() {
    ensureUI();
    optionState();
    setLayerHidden("finance-period-sheet", false);
  }

  function openCalendar() {
    ensureUI();
    const prefs = readPrefs();
    tempStart = prefs.periodeAktif === "custom" ? (prefs.periodeMulai || "") : "";
    tempEnd = prefs.periodeAktif === "custom" ? (prefs.periodeSelesai || prefs.periodeMulai || "") : "";
    awaitingEnd = false;
    const initial = parseDate(tempStart) || new Date();
    calendarMonth = new Date(initial.getFullYear(), initial.getMonth(), 1);
    renderCalendar();
    setLayerHidden("finance-date-sheet", false);
  }

  function dayButton(date) {
    const value = localDate(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "finance-calendar-day";
    button.textContent = String(date.getDate());
    button.dataset.date = value;
    button.setAttribute("aria-label", date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));

    const start = tempStart || "";
    const end = tempEnd || start;
    if (start && value >= start && value <= end) button.classList.add("is-range");
    if (value === start) button.classList.add("is-start");
    if (value === end) button.classList.add("is-end");
    if (start && start === end && value === start) button.classList.add("is-single");
    if (value === localDate(new Date())) button.classList.add("is-today");

    button.addEventListener("click", () => selectDate(value));
    return button;
  }

  function selectDate(value) {
    if (!awaitingEnd) {
      tempStart = value;
      tempEnd = value;
      awaitingEnd = true;
    } else {
      if (value < tempStart) {
        tempEnd = tempStart;
        tempStart = value;
      } else {
        tempEnd = value;
      }
      awaitingEnd = false;
    }
    renderCalendar();
  }

  function renderCalendar() {
    const title = document.querySelector("[data-finance-calendar-title]");
    const grid = document.querySelector("[data-finance-calendar-grid]");
    const hint = document.querySelector("[data-finance-date-hint]");
    const selection = document.querySelector("[data-finance-date-selection]");
    const apply = document.querySelector("[data-finance-date-apply]");
    if (!calendarMonth || !grid) return;

    if (title) title.textContent = calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    grid.innerHTML = "";

    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const blankCount = (first.getDay() + 6) % 7;
    for (let i = 0; i < blankCount; i += 1) {
      const blank = document.createElement("span");
      blank.className = "finance-calendar-blank";
      grid.appendChild(blank);
    }
    for (let day = 1; day <= last.getDate(); day += 1) {
      grid.appendChild(dayButton(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)));
    }

    if (hint) {
      hint.textContent = tempStart && awaitingEnd
        ? "Pilih tanggal akhir, atau gunakan satu tanggal."
        : "Pilih satu tanggal atau rentang tanggal.";
    }

    if (selection) {
      if (!tempStart) {
        selection.textContent = "Belum ada tanggal dipilih.";
      } else {
        const start = parseDate(tempStart);
        const end = parseDate(tempEnd || tempStart);
        selection.textContent = tempStart === (tempEnd || tempStart)
          ? shortDate(start, true)
          : `${shortDate(start)} – ${shortDate(end, true)}`;
      }
    }

    if (apply) apply.disabled = !tempStart;
  }

  function applyCustomRange() {
    if (!tempStart) return;
    const end = tempEnd || tempStart;
    writePrefs({
      periodeAktif: "custom",
      periodeMulai: tempStart,
      periodeSelesai: end
    });
    setLayerHidden("finance-date-sheet", true);
    syncTriggers();
    emitChange();
  }

  function syncTriggers() {
    const value = current();
    document.querySelectorAll("[data-finance-period-label]").forEach(el => {
      el.textContent = value.label;
    });
  }

  function emitChange() {
    window.dispatchEvent(new CustomEvent("finance-period-change", { detail: current() }));
  }

  function mount() {
    ensureUI();
    syncTriggers();
    if (mounted) return;
    mounted = true;

    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-finance-period-trigger]");
      if (!trigger) return;
      openPeriod();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeAll();
    });
  }

  window.FinancePeriod = {
    mount,
    current,
    getRange: () => {
      const value = current();
      return { startDate: value.startDate, endDate: value.endDate };
    },
    getLabel: () => current().label,
    open: openPeriod,
    sync: syncTriggers
  };
})();
