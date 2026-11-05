/* components.js —— 组件行为（零依赖，约 7 KB）
 *
 * 提供：Toast / Modal（焦点陷阱）/ Tabs（方向键）/ Copy / 表单校验
 * 全部：键盘可达、焦点可见、尊重 prefers-reduced-motion。
 *
 * 用法：
 *   SiteUI.toast('已保存', { type:'ok' })
 *   SiteUI.modal.open('#my-modal')  /  SiteUI.modal.close()
 *   <button data-copy="要复制的文本">复制</button>
 *   <form data-validate> … <input required> … </form>
 *   标签页：<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true">…</button></div>
 */
(function () {
  "use strict";
  if (window.__siteUIComponentsLoaded) return;
  window.__siteUIComponentsLoaded = 1;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = function () { return reduce.matches; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------ Toast */
  var stack = null;
  function ensureStack() {
    if (stack && document.body.contains(stack)) return stack;
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
    return stack;
  }
  function toast(text, opts) {
    opts = opts || {};
    var box = ensureStack();
    var el = document.createElement("div");
    el.className = "toast" + (opts.type ? " toast--" + opts.type : "");
    el.textContent = text;
    box.appendChild(el);

    if (!reduced()) requestAnimationFrame(function () { el.classList.add("is-in"); });
    else el.classList.add("is-in");

    var ttl = opts.duration || 2400;
    var timer = setTimeout(close, ttl);
    function close() {
      clearTimeout(timer);
      el.classList.remove("is-in");
      setTimeout(function () { el.remove(); }, reduced() ? 0 : 220);
    }
    el.addEventListener("pointerenter", function () { clearTimeout(timer); });
    el.addEventListener("pointerleave", function () { timer = setTimeout(close, 900); });
    el.addEventListener("click", close);
    return { close: close, el: el };
  }

  /* ------------------------------------------------------------ Modal */
  var modal = (function () {
    var current = null, lastFocus = null, prevOverflow = "";

    var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function open(target) {
      var el = typeof target === "string" ? $(target) : target;
      if (!el || current) return null;
      current = el;
      lastFocus = document.activeElement;
      el.hidden = false;
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      if (!reduced()) requestAnimationFrame(function () { el.classList.add("is-in"); });
      else el.classList.add("is-in");

      var first = el.querySelector(FOCUSABLE);
      (first || el).focus({ preventScroll: true });
      return el;
    }

    function close() {
      if (!current) return;
      var el = current;
      current = null;
      el.classList.remove("is-in");
      var done = function () {
        el.hidden = true;
        document.body.style.overflow = prevOverflow;
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      };
      reduced() ? done() : setTimeout(done, 180);
    }

    function trap(e) {
      if (!current || e.key !== "Tab") return;
      var items = $$(FOCUSABLE, current).filter(function (n) {
        return n.offsetParent !== null || n === current;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", function (e) {
      if (!current) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      trap(e);
    });

    document.addEventListener("click", function (e) {
      if (!current) return;
      if (e.target === current) close();                       // 点遮罩关闭
      var closer = e.target.closest("[data-modal-close]");
      if (closer && current.contains(closer)) close();
    });

    document.addEventListener("click", function (e) {
      var opener = e.target.closest("[data-modal-open]");
      if (!opener) return;
      e.preventDefault();
      open(opener.getAttribute("data-modal-open"));
    });

    return { open: open, close: close, isOpen: function () { return !!current; } };
  })();

  /* ------------------------------------------------------------ Tabs */
  function initTabs() {
    $$("[role=tablist]").forEach(function (list) {
      if (list.dataset.bound) return;
      list.dataset.bound = "1";
      var tabs = $$("[role=tab]", list);
      var ids = tabs.map(function (t) { return t.getAttribute("aria-controls"); });

      function select(i, focus) {
        tabs.forEach(function (t, k) {
          var on = k === i;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(ids[k]);
          if (panel) panel.hidden = !on;
        });
        if (focus && tabs[i]) tabs[i].focus();
      }

      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { select(i); });
        t.addEventListener("keydown", function (e) {
          var k = e.key;
          if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); select((i + 1) % tabs.length, true); }
          else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
          else if (k === "Home") { e.preventDefault(); select(0, true); }
          else if (k === "End") { e.preventDefault(); select(tabs.length - 1, true); }
        });
      });

      var start = Math.max(0, tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; }));
      select(start);
    });
  }

  /* ------------------------------------------------------------ Copy */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy") ? res() : rej(new Error("copy failed"));
        ta.remove();
      } catch (e) { rej(e); }
    });
  }
  function initCopy() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (!b) return;
      e.preventDefault();
      copyText(b.getAttribute("data-copy")).then(function () {
        var old = b.textContent;
        b.classList.add("is-done");
        b.textContent = "已复制";
        toast("已复制到剪贴板", { type: "ok", duration: 1600 });
        setTimeout(function () { b.classList.remove("is-done"); b.textContent = old; }, 1600);
      }).catch(function () { toast("复制失败，请手动选择", { type: "err" }); });
    });
  }

  /* ------------------------------------------------------------ 表单校验 */
  function validate(form) {
    var ok = true, firstBad = null;
    $$("input,select,textarea", form).forEach(function (f) {
      if (f.type === "hidden" || f.disabled) return;
      var field = f.closest(".field");
      var bad = !f.checkValidity();
      if (bad && !firstBad) firstBad = f;
      if (bad) ok = false;
      if (field) {
        field.classList.toggle("is-invalid", bad);
        var err = $(".field__err", field);
        if (err && bad && !err.textContent) err.textContent = f.validationMessage || "请检查这一项";
        f.setAttribute("aria-invalid", bad ? "true" : "false");
      }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }
  function initForms() {
    $$("form[data-validate]").forEach(function (form) {
      if (form.dataset.bound) return;
      form.dataset.bound = "1";
      form.addEventListener("submit", function (e) {
        if (!validate(form)) {
          e.preventDefault();
          toast("还有几项需要补充", { type: "err" });
        }
      });
      $$("input,select,textarea", form).forEach(function (f) {
        f.addEventListener("blur", function () {
          var field = f.closest(".field");
          if (!field || !field.classList.contains("is-invalid")) return;
          if (f.checkValidity()) {
            field.classList.remove("is-invalid");
            f.setAttribute("aria-invalid", "false");
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------ 骨架屏↔内容切换 */
  function initSkeleton() {
    $$("[data-skeleton]").forEach(function (box) {
      var target = document.querySelector(box.getAttribute("data-skeleton"));
      if (!target) return;
      target.hidden = true;
      var delay = parseInt(box.getAttribute("data-skeleton-delay") || "900", 10);
      setTimeout(function () { box.remove(); target.hidden = false; }, reduced() ? 0 : delay);
    });
  }

  function boot() { initTabs(); initCopy(); initForms(); initSkeleton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.SiteUI = {
    toast: toast,
    modal: modal,
    copy: copyText,
    validate: validate,
    reduced: reduced
  };
})();
