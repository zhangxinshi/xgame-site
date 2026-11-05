/* First-party pageview + monetization click pixel. No cookies, no third-party SDK. */
(function () {
  if (window.__msAnalytics) return;
  window.__msAnalytics = true;
  try {
    var host = location.hostname;
    var path = location.pathname;
    if (!host || /\.(?:css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|map|xml|txt)$/i.test(path)) return;
    var key = "_ms_vid_" + host;
    var vid = localStorage.getItem(key);
    if (!vid) {
      vid = (crypto && crypto.randomUUID) ? crypto.randomUUID() :
        (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
      localStorage.setItem(key, vid);
    }

    function send(event, extra) {
      var url = "https://homecalc.mengstone.com/assets/px.gif" +
        "?e=" + encodeURIComponent(event) +
        "&h=" + encodeURIComponent(host) +
        "&p=" + encodeURIComponent(path) +
        "&v=" + encodeURIComponent(vid) +
        "&ts=" + Date.now();
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          if (extra[k] !== undefined && extra[k] !== null && extra[k] !== "") {
            url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(String(extra[k]));
          }
        });
      }
      var img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = url;
    }

    send("pv");

    document.addEventListener("click", function (ev) {
      var el = ev.target;
      var a = el && el.closest ? el.closest("a[data-track]") : null;
      if (!a) return;
      var box = a.closest("[data-monetization]");
      var offer = box ? box.getAttribute("data-offer") || "" : "";
      var track = a.getAttribute("data-track") || "";
      var capKey = "_ms_click_" + (offer || track || "unknown");
      try {
        var last = Number(sessionStorage.getItem(capKey) || 0);
        if (last && Date.now() - last < 30000) return;
        sessionStorage.setItem(capKey, String(Date.now()));
      } catch (e) {}
      send("ad_click", {
        o: offer,
        t: track,
        u: a.href || ""
      });
    }, true);
  } catch (e) {}
})();
