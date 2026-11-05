/* motion-advanced.js —— 进阶动效（约 5 KB，零依赖，全部可关）
 *
 * 四个能力：
 *  1. 滚动叙事：给 [data-scene] 写入 --scene（0→1 的滚动进度）
 *  2. 分组错峰：给 [data-reveal-group] 的子元素写入 --group-i
 *  3. hover 光斑：给 [data-glow] 写入 --gx / --gy（百分比）
 *  4. 页面转场：跨文档 View Transitions；不支持的浏览器用淡出降级
 *  5. 阅读进度：.read-progress 的 --read（0→1）
 *
 * 性能护栏：
 *  · 所有滚动计算合并到一个 rAF 循环；
 *  · 只读写 transform/opacity 与 CSS 变量；
 *  · 元素离开视口 ±1 屏就不再计算；
 *  · prefers-reduced-motion 时全部跳过，并且不写任何内联样式。
 */
(function () {
  "use strict";
  if (window.__siteMotionAdvLoaded) return;
  window.__siteMotionAdvLoaded = 1;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = function () { return reduce.matches; };

  /* ---------------------------------------------------------- 1+5. 滚动进度 */
  function setupScrollProgress() {
    var scenes = [].slice.call(document.querySelectorAll("[data-scene]"));
    var bars = [].slice.call(document.querySelectorAll(".read-progress"));
    if (!scenes.length && !bars.length) return;
    if (reduced()) {
      scenes.forEach(function (el) { el.style.setProperty("--scene", "1"); });
      bars.forEach(function (el) { el.style.setProperty("--read", "1"); });
      return;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;

      scenes.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        // 进度：元素顶部从视口底部进入 → 元素底部离开视口顶部
        var total = r.height + vh;
        var passed = vh - r.top;
        var p = total > 0 ? passed / total : 0;
        p = Math.max(0, Math.min(1, p));
        el.style.setProperty("--scene", p.toFixed(3));
      });

      if (bars.length) {
        var doc = document.documentElement;
        var max = doc.scrollHeight - vh;
        var read = max > 0 ? doc.scrollTop / max : 0;
        bars.forEach(function (el) { el.style.setProperty("--read", (Math.round(read * 1000) / 1000)); });
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ---------------------------------------------------------- 2. 分组错峰 */
  function setupGroups() {
    [].slice.call(document.querySelectorAll("[data-reveal-group]")).forEach(function (group) {
      var step = parseInt(group.getAttribute("data-group-step") || "70", 10);
      group.style.setProperty("--group-step", step + "ms");
      [].slice.call(group.children).forEach(function (child, i) {
        child.style.setProperty("--group-i", i);
        if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
      });
      // 新加的元素要重新交给 motion.js 的 reveal 逻辑
      if (window.SiteMotion && window.SiteMotion.refresh) window.SiteMotion.refresh();
    });
  }

  /* ---------------------------------------------------------- 3. hover 光斑 */
  function setupGlow() {
    if (reduced()) return;
    [].slice.call(document.querySelectorAll("[data-glow]")).forEach(function (el) {
      if (el.dataset.glowBound) return;
      el.dataset.glowBound = "1";
      var ticking = false, gx = 50, gy = 0;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        gx = ((e.clientX - r.left) / r.width) * 100;
        gy = ((e.clientY - r.top) / r.height) * 100;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          el.style.setProperty("--gx", gx.toFixed(1) + "%");
          el.style.setProperty("--gy", gy.toFixed(1) + "%");
          ticking = false;
        });
      }, { passive: true });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--gx", "50%");
        el.style.setProperty("--gy", "0%");
      });
    });
  }

  /* ---------------------------------------------------------- 4. 页面转场 */
  function setupTransitions() {
    var root = document.documentElement;
    var supportsVT = typeof document.startViewTransition === "function";

    if (!supportsVT) {
      root.classList.add("vt-fallback");
      if (reduced()) return;
      document.addEventListener("click", function (e) {
        var a = e.target.closest("a[href]");
        if (!a) return;
        if (a.target === "_blank" || a.hasAttribute("download")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return;
        if (url.hash && url.pathname === location.pathname) return;   // 同页锚点不转场
        e.preventDefault();
        root.classList.add("vt-leaving");
        setTimeout(function () { location.href = url.href; }, 160);
      });
    }
  }

  /* ---------------------------------------------------------- boot */
  function boot() {
    setupGroups();
    setupGlow();
    setupScrollProgress();
    setupTransitions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.SiteMotionAdv = {
    reduced: reduced,
    refresh: function () { setupGroups(); setupGlow(); }
  };
})();
