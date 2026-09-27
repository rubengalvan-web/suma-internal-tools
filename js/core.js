/* SUMA Internal Tools — shared helpers (no dependencies) */
(function () {
  "use strict";
  var S = (window.SUMA = window.SUMA || {});
  S.routes = {};
  S.state = {};

  /* ---------- text + storage ---------- */
  S.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  S.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("suma." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem("suma." + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del: function (k) {
      try { localStorage.removeItem("suma." + k); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- SHA-256 (works without crypto.subtle, e.g. on file:// or http) ---------- */
  S.sha256 = function (ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = "", words = [], i, j;
    var bitLen = ascii.length * 8, hash = [], k = [], pc = 0, isComposite = {};
    for (var cand = 2; pc < 64; cand++) {
      if (!isComposite[cand]) {
        for (i = 0; i < 313; i += cand) isComposite[i] = cand;
        hash[pc] = (Math.pow(cand, 0.5) * maxWord) | 0;
        k[pc++] = (Math.pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (j = 0; j < words.length; ) {
      var w = words.slice(j, (j += 16)), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? "0" : "") + b.toString(16); }
    return result;
  };

  /* ---------- dates + numbers ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  S.toISO = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  S.todayISO = function () { return S.toISO(new Date()); };
  S.parseISO = function (iso) { var p = String(iso).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  S.addDays = function (iso, n) { var d = S.parseISO(iso); d.setDate(d.getDate() + n); return S.toISO(d); };
  S.nowStamp = function () { var d = new Date(); return S.toISO(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  S.fmtDate = function (iso, lang) {
    return S.parseISO(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { day: "numeric", month: "long", year: "numeric" });
  };
  S.fmtShort = function (iso) {
    return S.parseISO(iso).toLocaleDateString("es-US", { day: "numeric", month: "short", year: "numeric" });
  };
  S.money = function (n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  };
  S.num = function (n) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n); };
  S.round2 = function (n) { return Math.round(n * 100) / 100; };
  S.parseQty = function (v) {
    if (v === "" || v == null) return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) && n >= 0 ? n : null;
  };

  /* ---------- rows for Google Sheets (tab-separated = one value per cell) ---------- */
  S.clean = function (s) { return String(s == null ? "" : s).replace(/[\t\r\n]+/g, " ").trim(); };
  S.toTSV = function (cells) { return cells.map(S.clean).join("\t"); };

  /* ---------- UI: toast ---------- */
  var toastTimer;
  S.toast = function (msg, kind) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2600);
  };

  /* ---------- UI: bottom sheet ---------- */
  S.openSheet = function (opts) {
    var wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML =
      '<div class="sheet-backdrop" data-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + S.esc(opts.title) + '">' +
      '<div class="sheet-grip"></div>' +
      '<div class="sheet-head"><h2 class="sheet-title">' + S.esc(opts.title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Cerrar">' + S.icon("close") + "</button></div>" +
      '<div class="sheet-body">' + opts.body + "</div></div>";
    document.body.appendChild(wrap);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(function () { wrap.classList.add("open"); });
    function close() {
      wrap.classList.remove("open");
      document.body.classList.remove("no-scroll");
      setTimeout(function () { wrap.remove(); }, 220);
    }
    wrap.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) close(); });
    if (opts.onMount) opts.onMount(wrap.querySelector(".sheet"), close);
    return close;
  };

  /* ---------- clipboard: one tap, with fallbacks for iPhone ---------- */
  S.copyText = function (text) {
    // Must run straight from the tap handler (no awaits before this) so iOS allows it.
    function legacy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px;";
        document.body.appendChild(ta);
        var range = document.createRange();
        range.selectNodeContents(ta);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        ta.setSelectionRange(0, text.length);
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () {
        if (legacy()) return true;
        S.manualCopy(text);
        return false;
      });
    }
    if (legacy()) return Promise.resolve(true);
    S.manualCopy(text);
    return Promise.resolve(false);
  };

  S.manualCopy = function (text) {
    S.openSheet({
      title: "Copiar manualmente",
      body: '<p class="muted">Tu navegador no permitió copiar automáticamente. Mantén presionado el texto y elige <strong>Copiar</strong>.</p>' +
        '<textarea class="manual-copy" readonly rows="4">' + S.esc(text) + "</textarea>",
      onMount: function (sheet) {
        var ta = sheet.querySelector("textarea");
        setTimeout(function () { ta.focus(); ta.setSelectionRange(0, ta.value.length); }, 250);
      }
    });
  };

  /* ---------- UI: steppers (– [ ] +) for fast one-handed counting ---------- */
  S.stepper = function (id, value, opts) {
    opts = opts || {};
    return '<div class="stepper" data-step="' + (opts.step || 1) + '" data-decimals="' + (opts.decimals ? 1 : 0) + '">' +
      '<button type="button" class="step-btn" data-dir="-1" aria-label="Restar">' + S.icon("minus") + "</button>" +
      '<input class="step-input" id="' + S.esc(id) + '" name="' + S.esc(id) + '" type="text" autocomplete="off" ' +
      'inputmode="' + (opts.decimals ? "decimal" : "numeric") + '" ' + (opts.decimals ? "" : 'pattern="[0-9]*" ') +
      'placeholder="—" value="' + S.esc(value == null ? "" : value) + '" aria-label="' + S.esc(opts.label || "Cantidad") + '">' +
      '<button type="button" class="step-btn" data-dir="1" aria-label="Sumar">' + S.icon("plus") + "</button></div>";
  };

  S.bindSteppers = function (root, onChange) {
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".step-btn");
      if (!btn) return;
      var box = btn.closest(".stepper"), input = box.querySelector(".step-input");
      var step = Number(box.dataset.step) || 1, dir = Number(btn.dataset.dir);
      var cur = S.parseQty(input.value);
      var next;
      if (cur == null) next = dir > 0 ? step : 0;
      else next = Math.max(0, S.round2(cur + dir * step));
      input.value = String(next);
      onChange(input);
    });
    root.addEventListener("input", function (e) {
      var input = e.target.closest(".step-input");
      if (!input) return;
      var dec = input.closest(".stepper").dataset.decimals === "1";
      var v = input.value.replace(",", ".");
      v = dec ? v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") : v.replace(/[^0-9]/g, "");
      if (v !== input.value) input.value = v;
      onChange(input);
    });
    root.addEventListener("focusin", function (e) {
      var input = e.target.closest(".step-input");
      if (input) setTimeout(function () { input.select(); }, 0);
    });
  };

  /* ---------- UI: header ---------- */
  S.header = function (title, back) {
    return '<header class="topbar"><div class="topbar-inner">' +
      '<a class="back-link" href="' + (back || "#/") + '" aria-label="Volver">' + S.icon("back") + "<span>" + (back && back !== "#/" ? "Atrás" : "Inicio") + "</span></a>" +
      '<a href="#/" class="topbar-logo" aria-label="Inicio"><img src="assets/logo-wordmark.png" alt="SUMA"></a>' +
      '<span class="topbar-title">' + S.esc(title) + "</span>" +
      '</div><div class="andean-band" aria-hidden="true"></div></header>';
  };

  /* ---------- icons (inline SVG, stroke = currentColor) ---------- */
  var P = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    share: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    out: '<path d="M3 7.5L12 3l9 4.5v6"/><path d="M3 7.5V16.5L12 21l3-1.5"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/><path d="M16 18h6M19 15l3 3-3 3"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>'
  };
  S.icon = function (name) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + "</svg>";
  };
})();
