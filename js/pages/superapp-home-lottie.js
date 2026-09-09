(() => {
  "use strict";

  const target = document.querySelector("[data-today-lottie]");
  if (!target) return;
  const wrap = target.closest(".today-lottie-wrap");

  // Lightweight vector animation owned by the app. lottie-web is only the renderer.
  const animationData = {
    v: "5.12.2", fr: 30, ip: 0, op: 180, w: 240, h: 160, nm: "Family home calm", ddd: 0, assets: [],
    layers: [
      {
        ddd: 0, ind: 1, ty: 4, nm: "House", sr: 1,
        ks: {
          o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
          p: { a: 1, k: [
            { t: 0, s: [178, 104, 0], e: [178, 100, 0], i: { x: [.42,.42,.42], y: [1,1,1] }, o: { x: [.58,.58,.58], y: [0,0,0] } },
            { t: 90, s: [178, 100, 0], e: [178, 104, 0], i: { x: [.42,.42,.42], y: [1,1,1] }, o: { x: [.58,.58,.58], y: [0,0,0] } },
            { t: 180, s: [178, 104, 0] }
          ] },
          a: { a: 0, k: [0,0,0] }, s: { a: 0, k: [100,100,100] }
        }, ao: 0,
        shapes: [
          { ty: "gr", nm: "Body", it: [
            { ty: "rc", d: 1, s: { a: 0, k: [70,55] }, p: { a: 0, k: [0,12] }, r: { a: 0, k: 8 }, nm: "Body path" },
            { ty: "fl", c: { a: 0, k: [.67,.87,.75,1] }, o: { a: 0, k: 62 }, r: 1, nm: "Body fill" },
            { ty: "tr", p: { a: 0, k: [0,0] }, a: { a: 0, k: [0,0] }, s: { a: 0, k: [100,100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
          ]},
          { ty: "gr", nm: "Roof", it: [
            { ty: "sh", d: 1, ks: { a: 0, k: { i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[-43,-5],[0,-43],[43,-5]], c: false } }, nm: "Roof path" },
            { ty: "st", c: { a: 0, k: [.23,.62,.39,1] }, o: { a: 0, k: 48 }, w: { a: 0, k: 8 }, lc: 2, lj: 2, ml: 4, nm: "Roof stroke" },
            { ty: "tr", p: { a: 0, k: [0,0] }, a: { a: 0, k: [0,0] }, s: { a: 0, k: [100,100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
          ]},
          { ty: "gr", nm: "Door", it: [
            { ty: "rc", d: 1, s: { a: 0, k: [16,30] }, p: { a: 0, k: [0,24] }, r: { a: 0, k: 5 }, nm: "Door path" },
            { ty: "fl", c: { a: 0, k: [.23,.62,.39,1] }, o: { a: 0, k: 42 }, r: 1, nm: "Door fill" },
            { ty: "tr", p: { a: 0, k: [0,0] }, a: { a: 0, k: [0,0] }, s: { a: 0, k: [100,100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
          ]}
        ], ip: 0, op: 180, st: 0, bm: 0
      },
      ...[
        { ind: 2, x: 70, y: 112, w: 28, h: 86, rot: -20, delay: 0 },
        { ind: 3, x: 105, y: 98, w: 30, h: 105, rot: 8, delay: 15 },
        { ind: 4, x: 134, y: 116, w: 27, h: 72, rot: 32, delay: 30 }
      ].map(item => ({
        ddd: 0, ind: item.ind, ty: 4, nm: `Leaf ${item.ind}`, sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 1, k: [
            { t: item.delay, s: [item.rot - 3], e: [item.rot + 3], i: { x: [.42], y: [1] }, o: { x: [.58], y: [0] } },
            { t: 90 + item.delay, s: [item.rot + 3], e: [item.rot - 3], i: { x: [.42], y: [1] }, o: { x: [.58], y: [0] } },
            { t: 180, s: [item.rot - 3] }
          ] },
          p: { a: 0, k: [item.x,item.y,0] }, a: { a: 0, k: [0,item.h/2,0] }, s: { a: 0, k: [100,100,100] }
        }, ao: 0,
        shapes: [{ ty: "gr", nm: "Leaf", it: [
          { ty: "el", d: 1, s: { a: 0, k: [item.w,item.h] }, p: { a: 0, k: [0,0] }, nm: "Leaf ellipse" },
          { ty: "fl", c: { a: 0, k: [.31,.68,.46,1] }, o: { a: 0, k: 38 }, r: 1, nm: "Leaf fill" },
          { ty: "tr", p: { a: 0, k: [0,0] }, a: { a: 0, k: [0,0] }, s: { a: 0, k: [100,100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
        ]}], ip: 0, op: 180, st: 0, bm: 0
      }))
    ]
  };

  function start() {
    if (!window.lottie?.loadAnimation) return;
    try {
      const animation = window.lottie.loadAnimation({
        container: target,
        renderer: "svg",
        loop: true,
        autoplay: !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
        animationData,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" }
      });
      animation.setSpeed?.(.55);
      animation.addEventListener?.("DOMLoaded", () => wrap?.classList.add("is-lottie-ready"));
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        animation.goToAndStop?.(80, true);
        wrap?.classList.add("is-lottie-ready");
      }
    } catch (error) {
      console.warn("[Superapp] Lottie Hari Ini gagal dimuat; fallback dipakai.", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
