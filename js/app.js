/* SUMA Internal Tools — router, PIN gate, hub */
(function () {
  "use strict";
  var S = window.SUMA, C = window.SUMA_CONFIG;
  var app = document.getElementById("app");
  var PIN_LEN = C.pinLength || 4;

  /* ---------- PIN gate: one PIN per person (soft gate, keeps casual visitors out) ---------- */
  function findUser(hash) {
    for (var i = 0; i < C.users.length; i++) if (C.users[i].pinHash === hash) return C.users[i];
    return null;
  }
  function unlocked() {
    var u = findUser(S.store.get("session", ""));
    if (u && C.sheetApiUrl && !S.store.get("pin", "")) u = null;   // direct-save mode needs the PIN once
    S.user = u ? u.name : "";
    return !!u;
  }

  function renderPin() {
    var entered = "";
    app.innerHTML =
      '<main class="pin-screen">' +
      '<img class="pin-logo" src="assets/logo-wordmark.png" alt="SUMA">' +
      '<p class="pin-sub">Herramientas internas</p>' +
      '<div class="andean-band pin-band" aria-hidden="true"></div>' +
      '<p class="pin-label" id="pin-label">Ingresa tu PIN</p>' +
      '<div class="pin-dots" aria-hidden="true">' + new Array(PIN_LEN + 1).join("<span></span>") + "</div>" +
      '<div class="keypad" role="group" aria-labelledby="pin-label">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-k="' + n + '">' + n + "</button>"; }).join("") +
      '<span></span><button type="button" data-k="0">0</button>' +
      '<button type="button" data-k="del" class="key-del" aria-label="Borrar">' + S.icon("back") + "</button>" +
      "</div></main>";

    var dots = app.querySelectorAll(".pin-dots span");
    var label = app.querySelector("#pin-label");
    function paint() { dots.forEach(function (d, i) { d.classList.toggle("on", i < entered.length); }); }
    function press(k) {
      if (k === "del") entered = entered.slice(0, -1);
      else if (entered.length < PIN_LEN) entered += k;
      paint();
      if (entered.length === PIN_LEN) {
        var hash = S.sha256("suma-tools:" + entered);
        var user = findUser(hash);
        if (user) {
          S.store.set("session", hash);
          S.store.set("pin", entered);          // sent with each save so the sheet can check it
          if (S.sync) S.sync.flush();
          label.textContent = "Hola, " + user.name;
          app.querySelector(".pin-dots").classList.add("ok");
          setTimeout(route, 350);
        } else {
          app.querySelector(".pin-dots").classList.add("shake");
          label.textContent = "PIN incorrecto. Intenta de nuevo.";
          setTimeout(function () {
            entered = ""; paint();
            var pd = app.querySelector(".pin-dots"); if (pd) pd.classList.remove("shake");
          }, 450);
        }
      }
    }
    app.querySelector(".keypad").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]");
      if (b) press(b.dataset.k);
    });
    document.onkeydown = function (e) {
      if (!app.querySelector(".keypad")) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
  }

  /* ---------- hub ---------- */
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  }

  S.routes["/"] = function (el) {
    el.innerHTML =
      '<header class="hero"><div class="hero-inner">' +
      '<img class="hero-logo" src="assets/logo-wordmark.png" alt="SUMA">' +
      '<p class="hero-sub">Herramientas internas</p>' +
      '</div><div class="andean-band" aria-hidden="true"></div></header>' +
      '<main class="screen">' +
      '<p class="eyebrow">' + greeting() + "</p>" +
      '<h1 class="display">Hola, ' + S.esc(S.user) + "</h1>" +
      '<p class="lead">¿Qué vamos a hacer hoy?</p>' +
      (S.movPending && S.movPending() ? '<a class="callout warn pending-link" href="#/pendientes">' + S.icon("alert") + "<div>Tienes <strong>" + S.movPending() +
        (S.sync.enabled ? (S.movPending() === 1 ? " registro" : " registros") + "</strong> sin enviar a la hoja. Se envían solos con internet; toca para verlos.</div></a>"
          : (S.movPending() === 1 ? " movimiento" : " movimientos") + "</strong> sin copiar a la hoja. Toca aquí para copiarlos.</div></a>") : "") +
      '<nav class="tiles" aria-label="Herramientas">' +
      C.tools.map(function (t) {
        return '<a class="tile" href="' + t.route + '" style="--accent:' + t.accent + '">' +
          '<span class="tile-icon">' + S.icon(t.icon) + "</span>" +
          '<span class="tile-text"><span class="tile-title">' + S.esc(t.title) + "</span>" +
          '<span class="tile-sub">' + S.esc(t.subtitle) + "</span></span>" +
          '<span class="tile-arrow" aria-hidden="true">→</span></a>';
      }).join("") +
      "</nav>" +
      '<footer class="app-foot"><span>Lima · Arizona · Florida</span>' +
      '<span>v' + S.esc(C.version) + ' · <button type="button" class="link-btn" data-act="lock">' + S.icon("lock") + "Cambiar usuario</button></span></footer>" +
      "</main>";
    el.querySelector('[data-act="lock"]').addEventListener("click", function () {
      S.store.del("session");
      S.store.del("pin");
      route();
    });
  };

  /* ---------- router ---------- */
  function route() {
    document.onkeydown = null;
    if (S.sync) S.sync.reset();
    if (!unlocked()) { renderPin(); return; }
    var path = location.hash.replace(/^#/, "") || "/";
    var fn = S.routes[path];
    if (!fn) { location.replace("#/"); fn = S.routes["/"]; }
    // Fresh container per screen, so event listeners never leak between screens.
    var view = document.createElement("div");
    view.className = "view";
    app.innerHTML = "";
    app.appendChild(view);
    fn(view);
    window.scrollTo(0, 0);
  }
  S.refresh = function () { route(); };
  S.go = function (hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  };
  window.addEventListener("hashchange", route);
  route();

  /* ---------- offline support (only on https / localhost) ---------- */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline cache is optional */ });
    });
  }
})();
