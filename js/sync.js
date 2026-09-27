/* Sync — sends counts, movements and quotes straight to the Google Sheet through Apps Script.
   Records wait in a queue on the phone until the sheet confirms them, so nothing is lost offline.
   Turned on by setting SUMA_CONFIG.sheetApiUrl; with it empty the app keeps the copy-and-paste flow. */
(function () {
  "use strict";
  var S = window.SUMA, C = window.SUMA_CONFIG;
  var Q = "sync.queue", SENT = "sync.sent";
  var enabled = !!C.sheetApiUrl, listeners = [], running = null;

  function queue() { return S.store.get(Q, []); }
  function saveQueue(q) { S.store.set(Q, q); }
  function sentIds() { return S.store.get(SENT, []); }
  function emit(id) { listeners.forEach(function (fn) { try { fn(id); } catch (e) { /* screen gone */ } }); }

  function post(payload) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(C.sheetApiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // simple request: no CORS preflight
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); }).finally(function () { clearTimeout(timer); });
  }

  function state(id) {
    if (sentIds().indexOf(id) >= 0) return { st: "sent" };
    var it = queue().filter(function (x) { return x.id === id; })[0];
    if (!it) return { st: "none" };
    if (running && it.sending) return { st: "sending" };
    return it.error ? { st: "error", error: it.error } : { st: "sending" };
  }

  function update(id, fn) {
    var q = queue();
    q.forEach(function (x) { if (x.id === id) fn(x); });
    saveQueue(q);
  }

  function flush() {
    if (!enabled) return Promise.resolve();
    if (running) return running;
    var pin = S.store.get("pin", "");
    var ids = queue().map(function (x) { return x.id; });
    function next(i) {
      if (i >= ids.length) return Promise.resolve();
      var item = queue().filter(function (x) { return x.id === ids[i]; })[0];
      if (!item) return next(i + 1);
      update(item.id, function (x) { x.sending = true; });
      emit(item.id);
      return post({ action: "append", pin: pin, id: item.id, tab: item.tab, head: item.head, row: item.row }).then(function (res) {
        if (res && res.ok) {
          var s = sentIds(); s.push(item.id); if (s.length > 400) s = s.slice(-400); S.store.set(SENT, s);
          saveQueue(queue().filter(function (x) { return x.id !== item.id; }));
          if (item.onSent && S.sync.hooks[item.onSent]) S.sync.hooks[item.onSent](item.id);
          emit(item.id);
          return next(i + 1);
        }
        var msg = (res && res.error) || "La hoja no respondió.";
        if (res && res.code === "pin") msg = "El PIN no es válido para la hoja. Toca Cambiar usuario y vuelve a entrar.";
        update(item.id, function (x) { x.sending = false; x.error = msg; x.tries = (x.tries || 0) + 1; });
        emit(item.id);
        if (res && (res.code === "pin" || res.code === "bloqueado")) return;   // same answer for every row: stop
        return next(i + 1);
      }, function () {
        // no internet (or Google didn't answer): keep everything queued and stop for now
        ids.slice(i).forEach(function (id) { update(id, function (x) { x.sending = false; x.error = "Sin conexión. Se enviará solo cuando haya internet."; }); emit(id); });
      });
    }
    running = next(0).then(done, done);
    function done() { running = null; queue().forEach(function (x) { if (x.sending) update(x.id, function (y) { y.sending = false; }); }); emit(null); }
    return running;
  }

  S.newId = function (prefix) {
    var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return prefix + "-" + S.todayISO().slice(2).replace(/-/g, "") + "-" + s;
  };

  S.sync = {
    enabled: enabled,
    hooks: {},
    pending: function () { return enabled ? queue().length : 0; },
    items: function () { return queue(); },
    state: state,
    flush: flush,
    on: function (fn) { listeners.push(fn); },
    reset: function () { listeners = []; },
    /* item: { id, tab, head:[...], row:[...], label, onSent? } */
    add: function (item) {
      if (!enabled) return Promise.resolve();
      if (sentIds().indexOf(item.id) < 0 && !queue().some(function (x) { return x.id === item.id; })) {
        item.createdAt = new Date().toISOString(); item.tries = 0; item.error = "";
        var q = queue(); q.push(item); saveQueue(q);
      }
      return flush();
    },
    remove: function (id) { saveQueue(queue().filter(function (x) { return x.id !== id; })); emit(id); },

    /* status block for a "listo" screen */
    box: function (id) { return '<div class="sync-box" data-sync="' + S.esc(id) + '"></div>'; },
    bind: function (root) {
      function paint() {
        root.querySelectorAll("[data-sync]").forEach(function (box) {
          var s = state(box.dataset.sync);
          box.className = "sync-box " + s.st;
          box.innerHTML =
            s.st === "sent" ? S.icon("check") + "<div><strong>Guardado en la hoja</strong><small>Ya está en Google Sheets. No hay que copiar nada.</small></div>" :
            s.st === "error" ? S.icon("alert") + "<div><strong>Todavía no está en la hoja</strong><small>" + S.esc(s.error) + '</small><button type="button" class="link-btn" data-retry>Reintentar ahora</button></div>' :
            s.st === "none" ? "" :
            '<span class="spinner" aria-hidden="true"></span><div><strong>Enviando a la hoja…</strong><small>Puedes seguir usando la app.</small></div>';
        });
      }
      root.addEventListener("click", function (e) { if (e.target.closest("[data-retry]")) flush(); });
      S.sync.on(paint);
      paint();
    }
  };

  if (enabled) {
    window.addEventListener("online", flush);
    window.addEventListener("load", function () { setTimeout(flush, 1500); });
    setInterval(function () { if (queue().length && navigator.onLine !== false) flush(); }, 60000);
  }
})();
