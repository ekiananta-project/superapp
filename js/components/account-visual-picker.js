(() => {
  "use strict";

  const root = document.querySelector("[data-account-visual-picker]");
  if (!root) return;

  const form = root.closest("form");
  const nameInput = form?.elements?.nama || null;
  const kindSelect = form?.elements?.jenis || null;
  const iconInput = form?.elements?.ikon || null;
  const colorInput = form?.elements?.warna || null;

  const previewCard = root.querySelector("[data-account-preview]");
  const previewIcon = root.querySelector("[data-icon-preview]");
  const previewName = root.querySelector("[data-account-name-preview]");
  const previewKind = root.querySelector("[data-account-kind-preview]");
  const previewIconWrap = root.querySelector("[data-account-preview-icon-wrap]");
  const iconPreviewLabel = root.querySelector("[data-icon-preview-label]");
  const colorNameEl = root.querySelector("[data-color-name]");
  const iconCountEl = root.querySelector("[data-icon-count]");
  const iconGrid = root.querySelector("[data-icon-grid]");
  const iconEmpty = root.querySelector("[data-icon-empty]");
  const searchInput = root.querySelector("[data-icon-search]");
  const clearSearch = root.querySelector("[data-clear-search]");
  const categoryRoot = root.querySelector("[data-icon-categories]");
  const suggestionBox = root.querySelector("[data-smart-suggestion]");
  const suggestionText = root.querySelector("[data-suggestion-text]");
  const suggestionApply = root.querySelector("[data-apply-suggestion]");
  const colorButtons = [...root.querySelectorAll("[data-color]")];

  const CATALOG = [
    // Harian
    { icon: "fast-food-outline", label: "Makanan", category: "daily", terms: "makan makanan kuliner nasi sarapan siang malam" },
    { icon: "restaurant-outline", label: "Restoran", category: "daily", terms: "restoran resto warung kuliner makan" },
    { icon: "cafe-outline", label: "Kopi & Minuman", category: "daily", terms: "kopi coffee cafe minum minuman teh" },
    { icon: "pizza-outline", label: "Jajan", category: "daily", terms: "jajan pizza snack cemilan makanan" },
    { icon: "nutrition-outline", label: "Bahan Makanan", category: "daily", terms: "sayur buah groceries dapur bahan makanan" },
    { icon: "car-sport-outline", label: "Kendaraan", category: "daily", terms: "mobil kendaraan bensin bbm parkir tol transport" },
    { icon: "bus-outline", label: "Transport Umum", category: "daily", terms: "bus angkot transport umum" },
    { icon: "bicycle-outline", label: "Sepeda", category: "daily", terms: "sepeda gowes transport" },
    { icon: "train-outline", label: "Kereta", category: "daily", terms: "kereta kai mrt commuter transport" },
    { icon: "walk-outline", label: "Jalan", category: "daily", terms: "jalan transport aktivitas" },
    { icon: "bag-handle-outline", label: "Belanja", category: "daily", terms: "belanja shopping shopee tokopedia mall" },
    { icon: "cart-outline", label: "Belanja Harian", category: "daily", terms: "belanja harian supermarket minimarket groceries" },
    { icon: "basket-outline", label: "Kebutuhan", category: "daily", terms: "kebutuhan basket belanja" },
    { icon: "storefront-outline", label: "Toko", category: "daily", terms: "toko merchant belanja" },
    { icon: "pricetag-outline", label: "Harga & Promo", category: "daily", terms: "promo diskon harga voucher" },

    // Rumah
    { icon: "home-outline", label: "Rumah", category: "home", terms: "rumah kos kontrakan sewa tempat tinggal" },
    { icon: "bed-outline", label: "Kamar", category: "home", terms: "kamar tidur kos hotel" },
    { icon: "receipt-outline", label: "Tagihan", category: "home", terms: "tagihan bill cicilan invoice pajak" },
    { icon: "flash-outline", label: "Listrik", category: "home", terms: "listrik pln token listrik" },
    { icon: "water-outline", label: "Air", category: "home", terms: "air pdam galon" },
    { icon: "wifi-outline", label: "Internet", category: "home", terms: "wifi internet indihome provider" },
    { icon: "phone-portrait-outline", label: "Pulsa & Telepon", category: "home", terms: "pulsa telepon hp paket data" },
    { icon: "construct-outline", label: "Perbaikan", category: "home", terms: "perbaikan servis renovasi rumah" },
    { icon: "hammer-outline", label: "Perabot", category: "home", terms: "perabot furniture alat rumah" },
    { icon: "leaf-outline", label: "Lingkungan", category: "home", terms: "tanaman kebun lingkungan" },

    // Lifestyle
    { icon: "medical-outline", label: "Kesehatan", category: "life", terms: "kesehatan dokter rumah sakit klinik obat" },
    { icon: "medkit-outline", label: "Obat", category: "life", terms: "obat apotek medical kesehatan" },
    { icon: "fitness-outline", label: "Olahraga", category: "life", terms: "olahraga gym fitness lari" },
    { icon: "school-outline", label: "Pendidikan", category: "life", terms: "pendidikan sekolah kuliah kampus kursus" },
    { icon: "book-outline", label: "Buku", category: "life", terms: "buku baca belajar pendidikan" },
    { icon: "library-outline", label: "Belajar", category: "life", terms: "belajar library kursus sekolah" },
    { icon: "game-controller-outline", label: "Game", category: "life", terms: "game gaming steam hiburan" },
    { icon: "film-outline", label: "Film", category: "life", terms: "film bioskop netflix streaming hiburan" },
    { icon: "musical-notes-outline", label: "Musik", category: "life", terms: "musik spotify konser hiburan" },
    { icon: "camera-outline", label: "Foto", category: "life", terms: "foto kamera photography" },
    { icon: "color-palette-outline", label: "Hobi", category: "life", terms: "hobi seni design kreatif" },
    { icon: "airplane-outline", label: "Perjalanan", category: "life", terms: "travel perjalanan liburan pesawat" },
    { icon: "boat-outline", label: "Wisata", category: "life", terms: "wisata kapal travel liburan" },
    { icon: "football-outline", label: "Sport", category: "life", terms: "sport bola olahraga" },

    // Keluarga
    { icon: "people-outline", label: "Keluarga", category: "family", terms: "keluarga family pasangan orang tua anak saudara" },
    { icon: "heart-outline", label: "Kasih & Donasi", category: "family", terms: "donasi sedekah kasih amal sosial" },
    { icon: "happy-outline", label: "Anak", category: "family", terms: "anak keluarga happy" },
    { icon: "gift-outline", label: "Hadiah", category: "family", terms: "hadiah gift kado ulang tahun bonus" },
    { icon: "paw-outline", label: "Hewan", category: "family", terms: "hewan pet kucing anjing" },
    { icon: "accessibility-outline", label: "Personal", category: "family", terms: "personal pribadi diri" },

    // Keuangan
    { icon: "cash-outline", label: "Uang Tunai", category: "money", terms: "uang cash tunai pemasukan gaji" },
    { icon: "wallet-outline", label: "Tabungan", category: "money", terms: "tabungan simpan uang wallet" },
    { icon: "card-outline", label: "Kartu", category: "money", terms: "kartu debit kredit bank" },
    { icon: "briefcase-outline", label: "Gaji & Kerja", category: "money", terms: "gaji salary kerja pekerjaan kantor" },
    { icon: "laptop-outline", label: "Freelance", category: "money", terms: "freelance proyek project laptop kerja" },
    { icon: "business-outline", label: "Bisnis", category: "money", terms: "bisnis usaha toko pemasukan" },
    { icon: "trending-up-outline", label: "Investasi", category: "money", terms: "investasi saham reksadana crypto naik" },
    { icon: "stats-chart-outline", label: "Keuntungan", category: "money", terms: "profit keuntungan bunga hasil investasi" },
    { icon: "calculator-outline", label: "Keuangan", category: "money", terms: "keuangan hitung anggaran budget" },
    { icon: "shield-checkmark-outline", label: "Asuransi", category: "money", terms: "asuransi perlindungan premi" },
    { icon: "key-outline", label: "Cicilan", category: "money", terms: "cicilan kredit angsuran pinjaman" },
    { icon: "swap-horizontal-outline", label: "Transfer", category: "money", terms: "transfer pindah uang bank" },
    { icon: "ellipsis-horizontal-circle-outline", label: "Lainnya", category: "money", terms: "lain lainnya other umum" }
  ];

  const COLORS = Object.fromEntries(
    colorButtons.map(btn => [btn.dataset.color.toUpperCase(), btn.dataset.colorName || btn.dataset.color])
  );

  const SUGGESTIONS = [
    { keys: ["makan", "makanan", "kuliner", "warung", "resto"], icon: "fast-food-outline", color: "#E58A2B", label: "Makanan" },
    { keys: ["kopi", "coffee", "cafe", "minum", "teh"], icon: "cafe-outline", color: "#9A7656", label: "Kopi & Minuman" },
    { keys: ["bensin", "bbm", "parkir", "tol", "transport", "ojek", "gojek", "grab", "taxi"], icon: "car-sport-outline", color: "#6F8FAF", label: "Transportasi" },
    { keys: ["belanja", "shopping", "shopee", "tokopedia", "supermarket"], icon: "bag-handle-outline", color: "#A27792", label: "Belanja" },
    { keys: ["listrik", "pln", "token"], icon: "flash-outline", color: "#D6A43A", label: "Listrik" },
    { keys: ["internet", "wifi", "indihome"], icon: "wifi-outline", color: "#5C9B92", label: "Internet" },
    { keys: ["pulsa", "telepon", "paket data"], icon: "phone-portrait-outline", color: "#6F8FAF", label: "Pulsa & Telepon" },
    { keys: ["rumah", "kos", "kontrakan", "sewa"], icon: "home-outline", color: "#9A7656", label: "Rumah" },
    { keys: ["dokter", "obat", "kesehatan", "klinik", "apotek"], icon: "medical-outline", color: "#B87070", label: "Kesehatan" },
    { keys: ["gym", "olahraga", "fitness"], icon: "fitness-outline", color: "#7FA06D", label: "Olahraga" },
    { keys: ["sekolah", "kuliah", "pendidikan", "kursus"], icon: "school-outline", color: "#7B78A8", label: "Pendidikan" },
    { keys: ["game", "steam", "gaming"], icon: "game-controller-outline", color: "#7B78A8", label: "Game" },
    { keys: ["film", "netflix", "bioskop"], icon: "film-outline", color: "#A27792", label: "Film" },
    { keys: ["liburan", "travel", "perjalanan"], icon: "airplane-outline", color: "#5C9B92", label: "Perjalanan" },
    { keys: ["gaji", "salary", "upah"], icon: "briefcase-outline", color: "#7FA06D", label: "Gaji" },
    { keys: ["freelance", "proyek", "project"], icon: "laptop-outline", color: "#5C9B92", label: "Freelance" },
    { keys: ["bonus", "hadiah", "kado"], icon: "gift-outline", color: "#A27792", label: "Bonus & Hadiah" },
    { keys: ["investasi", "saham", "reksadana", "crypto"], icon: "trending-up-outline", color: "#5C9B92", label: "Investasi" },
    { keys: ["tabungan", "menabung", "saving"], icon: "wallet-outline", color: "#7FA06D", label: "Tabungan" },
    { keys: ["keluarga", "orang tua", "anak", "pasangan"], icon: "people-outline", color: "#B87070", label: "Keluarga" },
    { keys: ["donasi", "sedekah", "amal"], icon: "heart-outline", color: "#B87070", label: "Donasi" },
    { keys: ["kucing", "anjing", "hewan", "pet"], icon: "paw-outline", color: "#9A7656", label: "Hewan" },
    { keys: ["tagihan", "pajak", "invoice"], icon: "receipt-outline", color: "#D6A43A", label: "Tagihan" }
  ];

  let activeCategory = "all";
  let selectedIcon = iconInput?.value || "fast-food-outline";
  let selectedColor = (colorInput?.value || "#E58A2B").toUpperCase();
  let activeSuggestion = null;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function iconMeta(icon) {
    return CATALOG.find(item => item.icon === icon) || {
      icon,
      label: "Ikon akun",
      category: "all",
      terms: ""
    };
  }

  function setColorVar(color) {
    previewCard?.style.setProperty("--akun-warna", color);
    previewIconWrap?.style.setProperty("--akun-warna", color);
    suggestionBox?.style.setProperty("--akun-warna", activeSuggestion?.color || color);
    root.querySelectorAll(".akun-icon-item").forEach(btn => {
      btn.style.setProperty("--akun-warna", color);
    });
  }

  function refreshPreview() {
    const meta = iconMeta(selectedIcon);
    const accountName = nameInput?.value.trim() || "Nama Akun";
    const kind = kindSelect?.value === "pemasukan" ? "Pemasukan" : "Pengeluaran";

    if (previewIcon) previewIcon.setAttribute("name", selectedIcon);
    if (previewName) previewName.textContent = accountName;
    if (previewKind) previewKind.textContent = kind;
    if (iconPreviewLabel) iconPreviewLabel.textContent = meta.label;
    if (colorNameEl) colorNameEl.textContent = COLORS[selectedColor] || selectedColor;

    setColorVar(selectedColor);

    colorButtons.forEach(btn => {
      const active = btn.dataset.color.toUpperCase() === selectedColor;
      btn.classList.toggle("is-aktif", active);
      btn.setAttribute("aria-checked", String(active));
    });

    root.querySelectorAll(".akun-icon-item").forEach(btn => {
      const active = btn.dataset.icon === selectedIcon;
      btn.classList.toggle("is-aktif", active);
      btn.setAttribute("aria-checked", String(active));
    });
  }

  function setSelection(icon, color, options = {}) {
    if (icon) selectedIcon = icon;
    if (color) selectedColor = String(color).toUpperCase();

    if (iconInput) {
      iconInput.value = selectedIcon;
      iconInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (colorInput) {
      colorInput.value = selectedColor;
      colorInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    refreshPreview();

    if (options.revealIcon) {
      activeCategory = "all";
      if (searchInput) searchInput.value = "";
      renderIcons();
    }
  }

  function renderIcons() {
    if (!iconGrid) return;
    const query = normalize(searchInput?.value);

    const filtered = CATALOG.filter(item => {
      const byCategory = activeCategory === "all" || item.category === activeCategory;
      const haystack = normalize(`${item.label} ${item.terms} ${item.icon}`);
      const byQuery = !query || haystack.includes(query);
      return byCategory && byQuery;
    });

    iconGrid.innerHTML = "";

    filtered.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "akun-icon-item";
      button.dataset.icon = item.icon;
      button.dataset.label = item.label;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", item.label);
      button.setAttribute("aria-checked", String(item.icon === selectedIcon));
      if (item.icon === selectedIcon) button.classList.add("is-aktif");
      button.style.setProperty("--akun-warna", selectedColor);
      button.innerHTML = `<ion-icon name="${item.icon}" aria-hidden="true"></ion-icon>`;
      button.addEventListener("click", () => setSelection(item.icon, selectedColor));
      iconGrid.appendChild(button);
    });

    if (iconCountEl) {
      iconCountEl.textContent = query
        ? `${filtered.length} hasil ditemukan`
        : `${filtered.length} ikon`;
    }

    if (iconEmpty) iconEmpty.hidden = filtered.length !== 0;
    if (clearSearch) clearSearch.hidden = !query;

    refreshPreview();
  }

  function updateSuggestion() {
    if (!suggestionBox || !suggestionText) return;
    const name = normalize(nameInput?.value);

    activeSuggestion = !name
      ? null
      : SUGGESTIONS.find(rule => rule.keys.some(key => name.includes(normalize(key)))) || null;

    if (!activeSuggestion) {
      suggestionBox.hidden = true;
      return;
    }

    const same = selectedIcon === activeSuggestion.icon && selectedColor === activeSuggestion.color.toUpperCase();
    if (same) {
      suggestionBox.hidden = true;
      return;
    }

    const colorName = COLORS[activeSuggestion.color.toUpperCase()] || "warna yang cocok";
    suggestionText.textContent = `${activeSuggestion.label} · ${colorName}`;
    suggestionBox.hidden = false;
    suggestionBox.style.setProperty("--akun-warna", activeSuggestion.color);
  }

  colorButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setSelection(selectedIcon, btn.dataset.color);
      updateSuggestion();
    });
  });

  categoryRoot?.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category || "all";
    [...categoryRoot.querySelectorAll("[data-category]")].forEach(item => {
      item.classList.toggle("is-aktif", item === button);
    });
    renderIcons();
  });

  searchInput?.addEventListener("input", renderIcons);
  clearSearch?.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    renderIcons();
  });

  nameInput?.addEventListener("input", () => {
    refreshPreview();
    updateSuggestion();
  });

  kindSelect?.addEventListener("change", () => {
    refreshPreview();
    updateSuggestion();
  });

  suggestionApply?.addEventListener("click", () => {
    if (!activeSuggestion) return;
    setSelection(activeSuggestion.icon, activeSuggestion.color, { revealIcon: true });
    updateSuggestion();
  });

  // Public API dipakai akun-form-backend.js setelah data edit selesai diambil dari Supabase.
  window.AccountVisualPicker = {
    setSelection(icon, color) {
      setSelection(icon || "ellipse-outline", color || "#E58A2B", { revealIcon: false });
      updateSuggestion();
    },
    getSelection() {
      return { icon: selectedIcon, color: selectedColor };
    },
    refresh() {
      refreshPreview();
      updateSuggestion();
    }
  };

  renderIcons();
  refreshPreview();
  updateSuggestion();
})();
