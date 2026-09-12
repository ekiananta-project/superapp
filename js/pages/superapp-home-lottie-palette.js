(() => {
  "use strict";

  const host = document.querySelector("[data-today-lottie]");
  if (!host) return;

  const PALETTES = {
    light: {
      sage: "#6B8F7A",
      teal: "#7FB8B0",
      peach: "#F3A78F",
      beige: "#EADCC8",
      cream: "#FBF7EE",
      ink: "#465049"
    },
    dark: {
      sage: "#7FA58E",
      teal: "#6FA8A1",
      peach: "#E7A18E",
      beige: "#D8C8B4",
      cream: "#F1EADF",
      ink: "#D8C8B4"
    }
  };

  const ORIGINAL_KEYS = {
    fill: "rkOriginalFill",
    stroke: "rkOriginalStroke",
    stopColor: "rkOriginalStopColor",
    styleFill: "rkOriginalStyleFill",
    styleStroke: "rkOriginalStyleStroke"
  };

  let raf = 0;
  let lastTheme = "";

  function themeName() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function clamp(value, min = 0, max = 255) {
    return Math.max(min, Math.min(max, value));
  }

  function parseColor(value) {
    if (!value) return null;
    const raw = String(value).trim().toLowerCase();
    if (!raw || raw === "none" || raw === "transparent" || raw === "currentcolor" || raw.startsWith("url(")) return null;

    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return {
        r: parseInt(raw[1] + raw[1], 16),
        g: parseInt(raw[2] + raw[2], 16),
        b: parseInt(raw[3] + raw[3], 16)
      };
    }
    if (/^#[0-9a-f]{6}$/i.test(raw)) {
      return {
        r: parseInt(raw.slice(1, 3), 16),
        g: parseInt(raw.slice(3, 5), 16),
        b: parseInt(raw.slice(5, 7), 16)
      };
    }

    const rgb = raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (rgb) {
      return { r: clamp(Number(rgb[1])), g: clamp(Number(rgb[2])), b: clamp(Number(rgb[3])) };
    }
    return null;
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d) {
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        default: h = ((r - g) / d + 4) * 60;
      }
    }
    return { h, s, l };
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex({ r, g, b }) {
    const part = n => Math.round(clamp(n)).toString(16).padStart(2, "0");
    return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
  }

  function mix(a, b, amount) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const t = Math.max(0, Math.min(1, amount));
    return rgbToHex({
      r: ca.r + (cb.r - ca.r) * t,
      g: ca.g + (cb.g - ca.g) * t,
      b: ca.b + (cb.b - ca.b) * t
    });
  }

  function mappedColor(original, theme) {
    const rgb = parseColor(original);
    if (!rgb) return original;
    const { h, s, l } = rgbToHsl(rgb);
    const p = PALETTES[theme];

    if (s < .10) {
      if (l < .24) return p.ink;
      if (l > .88) return theme === "dark" ? mix(p.cream, p.beige, .28) : p.cream;
      return p.beige;
    }

    let base;
    if (h >= 68 && h < 168) base = p.sage;
    else if (h >= 168 && h < 285) base = p.teal;
    else if (h >= 285 || h < 42) base = p.peach;
    else base = p.beige;

    if (l < .28) return mix(base, p.ink, .42);
    if (l > .78) return mix(base, p.cream, theme === "dark" ? .34 : .46);
    if (l > .62) return mix(base, p.cream, .18);
    return base;
  }

  function originalFor(el, attr, dataKey, styleKey = null) {
    if (styleKey) {
      if (!el.dataset[dataKey] && el.style?.[styleKey]) el.dataset[dataKey] = el.style[styleKey];
      return el.dataset[dataKey] || "";
    }
    if (!el.dataset[dataKey] && el.hasAttribute(attr)) el.dataset[dataKey] = el.getAttribute(attr) || "";
    return el.dataset[dataKey] || "";
  }

  function recolorElement(el, theme) {
    if (!(el instanceof Element)) return;

    if (el.hasAttribute("fill")) {
      const original = originalFor(el, "fill", ORIGINAL_KEYS.fill);
      const mapped = mappedColor(original, theme);
      if (mapped && mapped !== original) el.setAttribute("fill", mapped);
    }
    if (el.hasAttribute("stroke")) {
      const original = originalFor(el, "stroke", ORIGINAL_KEYS.stroke);
      const mapped = mappedColor(original, theme);
      if (mapped && mapped !== original) el.setAttribute("stroke", mapped);
    }
    if (el.hasAttribute("stop-color")) {
      const original = originalFor(el, "stop-color", ORIGINAL_KEYS.stopColor);
      const mapped = mappedColor(original, theme);
      if (mapped && mapped !== original) el.setAttribute("stop-color", mapped);
    }

    if (el.style?.fill) {
      const original = originalFor(el, "", ORIGINAL_KEYS.styleFill, "fill");
      const mapped = mappedColor(original, theme);
      if (mapped && mapped !== original) el.style.fill = mapped;
    }
    if (el.style?.stroke) {
      const original = originalFor(el, "", ORIGINAL_KEYS.styleStroke, "stroke");
      const mapped = mappedColor(original, theme);
      if (mapped && mapped !== original) el.style.stroke = mapped;
    }
  }

  function applyPalette() {
    raf = 0;
    const theme = themeName();
    host.dataset.rkPalette = theme;
    host.querySelectorAll("svg, svg *").forEach(el => recolorElement(el, theme));

    host.querySelectorAll("svg image").forEach(image => {
      image.style.filter = theme === "dark"
        ? "saturate(.62) sepia(.10) brightness(.88) contrast(.96)"
        : "saturate(.72) sepia(.08) brightness(1.02) contrast(.96)";
    });

    host.closest(".today-lottie-wrap")?.classList.add("rk-brand-lottie");
    lastTheme = theme;
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(applyPalette);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, subtree: true });

  new MutationObserver(() => {
    if (lastTheme !== themeName()) schedule();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  [0, 80, 220, 600, 1400].forEach(delay => setTimeout(schedule, delay));
})();
