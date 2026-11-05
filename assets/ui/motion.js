/* motion.js —— 动效原语（零依赖，约 6 KB，全部可关）
 *
 * 原则（对标 Stripe / Linear / Vercel 的做法）：
 *  1. 动效只用来「解释状态变化」，不做无意义的转圈；
 *  2. 只用 transform / opacity（GPU 合成，不触发重排）；
 *  3. 全部尊重 prefers-reduced-motion：关掉后立刻静态化；
 *  4. 滚动监听统一走一个 rAF 循环，避免每元素一个 listener；
 *  5. 元素离开视口就解绑，长页面不堆积开销。
 *
 * 用法（在页面里加 data 属性即可）：
 *   [data-reveal]            进入视口淡入上移（可加 style="--reveal-delay:120ms"）
 *   [data-reveal="mask"]     标题遮罩上浮（内部需 <span>）
 *   [data-count="1280"]      数字滚动到目标值（可加 data-count-suffix="+"）
 *   [data-parallax="0.2"]    随滚动位移（正数向下，负数向上）
 *   [data-magnetic]          鼠标靠近时轻微吸附（桌面端）
 *   [data-tilt]              3D 倾斜（卡片）
 *   <canvas id="starfield">  星空背景（自动初始化）
 *   <div id="spotlight">     光标聚光（自动创建）
 */
(function () {
  "use strict";
  if (window.__siteMotionLoaded) return;
  window.__siteMotionLoaded = 1;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var isReduced = function () { return reduce.matches; };
  var isFine = function () { return fine.matches; };

  /* ---------------------------------------------------------------- reveal */
  function setupReveal() {
    var els = [].slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length) return;

    var show = function (el) { el.classList.add("is-in"); };
    var showAll = function () { els.forEach(show); };

    if (isReduced() || !("IntersectionObserver" in window)) { showAll(); return; }

    var vh = window.innerHeight;

    /* 逐元素 opt-in：只有确实要动画的元素才加 .will-reveal（此时才隐藏）。
       首屏元素直接点亮，连 .will-reveal 都不加，永远不会闪。 */
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.9) { show(el); return; }
      el.classList.add("will-reveal");
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    els.forEach(function (el) { if (!el.classList.contains("is-in")) io.observe(el); });

    /* 兜底：2 秒后无论 IO 是否触发，全部显示（内容绝不能因为动效而消失） */
    setTimeout(showAll, 2000);
  }

  /* ---------------------------------------------------------------- count up */
  function setupCount() {
    var els = [].slice.call(document.querySelectorAll("[data-count]"));
    if (!els.length) return;

    function render(el, value) {
      var suffix = el.getAttribute("data-count-suffix") || "";
      var prefix = el.getAttribute("data-count-prefix") || "";
      var fixed = Number(el.getAttribute("data-count-fixed") || 0);
      el.textContent = prefix + value.toFixed(fixed) + suffix;
    }

    var run = function (el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      if (isReduced()) { render(el, target); return; }
      var dur = parseInt(el.getAttribute("data-count-dur") || "1100", 10);
      var t0 = performance.now();
      var tick = function (now) {
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);      // easeOutCubic
        render(el, target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        render(e.target, 0);
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) {
      var target0 = parseFloat(el.getAttribute("data-count")) || 0;
      if (isReduced()) { render(el, target0); return; }
      /* 先保留 HTML 里的真实值；真正进入视口时才归零并滚动 */
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------- parallax */
  function setupParallax() {
    var els = [].slice.call(document.querySelectorAll("[data-parallax]"));
    if (!els.length || isReduced()) return;

    var ticking = false;
    var apply = function () {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.15;
        var offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
      });
      ticking = false;
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    apply();
  }

  /* ---------------------------------------------------------------- magnetic */
  function setupMagnetic() {
    if (!isFine() || isReduced()) return;
    [].slice.call(document.querySelectorAll("[data-magnetic]")).forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.25;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * strength;
        var dy = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------------- tilt */
  function setupTilt() {
    if (!isFine() || isReduced()) return;
    [].slice.call(document.querySelectorAll("[data-tilt]")).forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 6;
      el.style.transformStyle = "preserve-3d";
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(900px) rotateY(" + (px * max).toFixed(2) +
          "deg) rotateX(" + (-py * max).toFixed(2) + "deg) translateY(-3px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------------------------------------------------------------- spotlight */
  function setupSpotlight() {
    if (!isFine() || isReduced()) return;
    var el = document.getElementById("spotlight");
    if (!el) {
      el = document.createElement("div");
      el.id = "spotlight";
      document.body.insertBefore(el, document.body.firstChild);
    }
    document.body.classList.add("has-pointer");
    var ticking = false, mx = 50, my = 40;
    document.addEventListener("pointermove", function (e) {
      mx = (e.clientX / window.innerWidth) * 100;
      my = (e.clientY / window.innerHeight) * 100;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        el.style.setProperty("--mx", mx + "%");
        el.style.setProperty("--my", my + "%");
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- starfield */
  function setupStarfield() {
    var c = document.getElementById("starfield");
    if (!c || isReduced()) return;
    var ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, stars = [];
    var layers = [
      { n: 90, r: 0.7, a: 0.5, speed: 0.008 },
      { n: 55, r: 1.1, a: 0.7, speed: 0.016 },
      { n: 26, r: 1.7, a: 0.95, speed: 0.028 }
    ];

    function resize() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      layers.forEach(function (L) {
        for (var i = 0; i < L.n; i++) {
          stars.push({
            x: Math.random() * w, y: Math.random() * h,
            r: L.r * (0.6 + Math.random() * 0.8),
            a: L.a * (0.5 + Math.random() * 0.5),
            speed: L.speed, phase: Math.random() * Math.PI * 2
          });
        }
      });
    }

    var paused = false;
    document.addEventListener("visibilitychange", function () {
      paused = document.hidden;
      if (!paused) requestAnimationFrame(frame);
    });

    var last = 0;
    function frame(t) {
      if (paused) return;
      requestAnimationFrame(frame);
      if (t - last < 40) return;              // ~25fps，省电
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += s.speed * 3;
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        var tw = 0.65 + 0.35 * Math.sin(t * 0.0012 + s.phase);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = i % 9 === 0 ? "#9fe8ff" : "#dff3ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    /* 每个能力独立 try：一个挂了不影响其它，更不能让整页内容不显示 */
    [setupReveal, setupCount, setupParallax, setupMagnetic, setupTilt, setupSpotlight, setupStarfield]
      .forEach(function (fn) {
        try { fn(); } catch (e) { if (window.console) console.warn("[motion]", e); }
      });
    /* 最后再兜一次：所有还藏着的元素直接显示 */
    setTimeout(function () {
      [].slice.call(document.querySelectorAll("[data-reveal]:not(.is-in)"))
        .forEach(function (el) { el.classList.add("is-in"); });
    }, 2200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.SiteMotion = {
    reduced: isReduced,
    refresh: boot
  };
})();
