/* Inventario SUMA — count on a phone, copy one row, paste in Google Sheets */
(function () {
  "use strict";
  var S = window.SUMA, C = window.SUMA_CONFIG;
  var DRAFT = "inv.draft", LAST = "inv.last", PREFS = "inv.prefs";
  var items = C.inventory;

  function countFilled(map) {
    return items.filter(function (p) { return map && map[p.sku] != null && map[p.sku] !== ""; }).length;
  }

  function headerRow() {
    return S.toTSV(["Fecha", "Nombre", "Lugar"].concat(items.map(function (p) { return p.header; }), ["Registrado"]));
  }
  function dataRow(rec) {
    return S.toTSV([rec.fecha, rec.nombre, rec.lugar].concat(items.map(function (p) {
      var v = rec.items[p.sku];
      return v == null ? "" : v;          // blank = not counted (never 0)
    }), [rec.registrado]));
  }

  /* ---------- 1. Landing ---------- */
  S.routes["/inventario"] = function (el) {
    var draft = S.store.get(DRAFT, {});
    var nDraft = countFilled(draft);
    var last = S.store.get(LAST, null);

    el.innerHTML = S.header("Inventario") +
      '<main class="screen">' +
      '<p class="eyebrow">Inventario SUMA</p>' +
      '<h1 class="display">Conteo de inventario</h1>' +
      '<p class="lead">Cuenta lo que hay en tu ubicación. Al terminar, tocas <strong>Copiar</strong> y pegas la fila en la hoja de Google del equipo.</p>' +
      '<a class="btn btn-primary btn-lg btn-block" href="#/inventario/conteo">Empezar conteo de inventario</a>' +
      '<a class="btn btn-ghost btn-lg btn-block second-btn" href="#/traslado">' + S.icon("truck") + "Registrar traslado</a>" +
      (S.carryCard ? S.carryCard() : "") +
      (nDraft ? '<p class="note">Tienes un conteo en curso (' + nDraft + " de " + items.length + ' productos). Se retoma donde lo dejaste. ' +
        '<button type="button" class="link-btn danger" data-act="discard">Descartar</button></p>' : "") +
      (last ? lastCard(last) : "") +
      '<ol class="howto">' +
      "<li><span>1</span><p>Cuenta cada producto. Deja en blanco lo que no contaste.</p></li>" +
      "<li><span>2</span><p>Toca <strong>Guardar inventario</strong> y pon fecha, nombre y lugar.</p></li>" +
      "<li><span>3</span><p>Toca <strong>Copiar</strong> y pega en la hoja de Google.</p></li>" +
      "</ol></main>";

    var discard = el.querySelector('[data-act="discard"]');
    if (discard) discard.addEventListener("click", function () {
      S.store.del(DRAFT);
      S.toast("Conteo descartado");
      S.refresh();
    });
    var again = el.querySelector('[data-act="copy-last"]');
    if (again) again.addEventListener("click", function () {
      S.copyText(dataRow(last)).then(function (ok) {
        if (ok) { last.copied = true; S.store.set(LAST, last); S.toast("Fila copiada. Pégala en la hoja.", "ok"); }
      });
    });
  };

  function lastCard(last) {
    return '<section class="card last-card">' +
      '<div class="last-head"><span class="eyebrow">Último conteo en este teléfono</span>' +
      (last.copied ? '<span class="pill ok">' + S.icon("check") + "Copiado</span>" : '<span class="pill warn">Sin copiar</span>') + "</div>" +
      "<p><strong>" + S.esc(S.fmtShort(last.fecha)) + "</strong> · " + S.esc(last.lugar) + " · " + S.esc(last.nombre) + "</p>" +
      '<button type="button" class="btn btn-ghost btn-block" data-act="copy-last">' + S.icon("copy") + "Copiar de nuevo</button>" +
      (C.inventorySheetUrl ? '<a class="link-btn block-link" href="' + S.esc(C.inventorySheetUrl) + '" target="_blank" rel="noopener">' + S.icon("sheet") + "Abrir hoja de inventario</a>" : "") +
      "</section>";
  }

  /* ---------- 2. Count screen ---------- */
  S.routes["/inventario/conteo"] = function (el) {
    var draft = S.store.get(DRAFT, {});
    var groups = [];
    items.forEach(function (p) {
      var g = groups.filter(function (x) { return x.name === p.group; })[0];
      if (!g) { g = { name: p.group, list: [] }; groups.push(g); }
      g.list.push(p);
    });

    el.innerHTML = S.header("Conteo", "#/inventario") +
      '<main class="screen has-footer">' +
      '<h1 class="display sm">Conteo de inventario</h1>' +
      '<p class="muted">Café en <strong>bolsas</strong>, snacks en <strong>unidades</strong>. En blanco = no contado; 0 = no hay.</p>' +
      groups.map(function (g) {
        return '<section class="group"><h2 class="group-title">' + S.esc(g.name) + "</h2>" +
          g.list.map(function (p) {
            return '<div class="item" style="--accent:' + p.accent + '">' +
              '<label class="item-info" for="q-' + p.sku + '"><span class="item-name">' + S.esc(p.name) + "</span>" +
              '<span class="item-variant">' + S.esc(p.variant) + "</span></label>" +
              '<div class="item-qty">' + S.stepper("q-" + p.sku, draft[p.sku], { label: p.name + " " + p.variant }) +
              '<span class="unit">' + S.esc(p.unit) + "</span></div></div>";
          }).join("") + "</section>";
      }).join("") +
      "</main>" +
      '<div class="footer-bar"><div class="footer-inner">' +
      '<div class="footer-meta"><span><strong id="n-count">0</strong> de ' + items.length + ' contados</span><small>Lo que dejes en blanco no se guarda</small></div>' +
      '<button type="button" class="btn btn-primary" id="save" disabled>Guardar inventario</button>' +
      "</div></div>";

    var saveBtn = el.querySelector("#save");
    function refresh() {
      var n = countFilled(draft);
      el.querySelector("#n-count").textContent = n;
      saveBtn.disabled = n === 0;
    }
    S.bindSteppers(el, function (input) {
      var sku = input.id.slice(2);
      var q = S.parseQty(input.value);
      if (q == null) delete draft[sku]; else draft[sku] = q;
      input.closest(".item").classList.toggle("filled", q != null);
      S.store.set(DRAFT, draft);
      refresh();
    });
    el.querySelectorAll(".step-input").forEach(function (i) { i.closest(".item").classList.toggle("filled", i.value !== ""); });
    refresh();
    saveBtn.addEventListener("click", function () { openMeta(draft); });
  };

  /* ---------- 3. Fecha / Nombre / Lugar (asked at save time) ---------- */
  function openMeta(draft) {
    var prefs = S.store.get(PREFS, {});
    S.openSheet({
      title: "Guardar inventario",
      body:
        '<form class="form" id="meta" novalidate>' +
        '<label class="field"><span>Fecha</span><input type="date" name="fecha" value="' + S.todayISO() + '" required></label>' +
        '<label class="field"><span>Nombre</span><input type="text" name="nombre" autocomplete="name" autocapitalize="words" placeholder="Tu nombre" value="' + S.esc(S.user || prefs.nombre || "") + '" required></label>' +
        '<fieldset class="field"><legend>Lugar</legend><div class="segmented" role="radiogroup">' +
        C.locations.map(function (l) {
          return '<label><input type="radio" name="lugar" value="' + S.esc(l) + '"' + (prefs.lugar === l ? " checked" : "") + '><span>' + S.esc(l) + "</span></label>";
        }).join("") + "</div></fieldset>" +
        '<p class="form-error" id="meta-err" hidden></p>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block">Confirmar</button></form>',
      onMount: function (sheet, close) {
        var form = sheet.querySelector("#meta");
        form.addEventListener("input", function () { sheet.querySelector("#meta-err").hidden = true; });
        form.addEventListener("change", function () { sheet.querySelector("#meta-err").hidden = true; });
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var fd = new FormData(form);
          var fecha = fd.get("fecha"), nombre = S.clean(fd.get("nombre")), lugar = fd.get("lugar");
          var err = !fecha ? "Elige la fecha." : !nombre ? "Escribe tu nombre." : !lugar ? "Elige el lugar: Lima, Arizona o Florida." : "";
          var box = sheet.querySelector("#meta-err");
          if (err) { box.textContent = err; box.hidden = false; return; }
          var rec = {
            fecha: fecha, nombre: nombre, lugar: lugar,
            items: JSON.parse(JSON.stringify(draft)),
            registrado: S.nowStamp(), copied: false
          };
          S.store.set(LAST, rec);
          S.store.set(PREFS, { nombre: nombre, lugar: lugar });
          S.store.del(DRAFT);
          close();
          S.go("#/inventario/listo");
        });
      }
    });
  }

  /* ---------- 4. Ready to copy ---------- */
  S.routes["/inventario/listo"] = function (el) {
    var rec = S.store.get(LAST, null);
    if (!rec) { S.go("#/inventario"); return; }
    var counted = items.filter(function (p) { return rec.items[p.sku] != null; });

    el.innerHTML = S.header("Inventario", "#/inventario") +
      '<main class="screen">' +
      '<div class="done-badge">' + S.icon("check") + "</div>" +
      '<h1 class="display center">Inventario guardado</h1>' +
      '<p class="lead center">' + S.esc(S.fmtShort(rec.fecha)) + " · " + S.esc(rec.lugar) + " · " + S.esc(rec.nombre) + "</p>" +
      '<p class="step-label"><span>1</span>Copia la fila</p>' +
      '<button type="button" class="btn btn-accent btn-xl btn-block" id="copy">' + S.icon("copy") + "<span>Copiar</span></button>" +
      (C.inventorySheetUrl ?
        '<p class="step-label"><span>2</span>Pégala en la hoja de Google</p>' +
        '<a class="btn btn-primary btn-lg btn-block" id="open-sheet" href="' + S.esc(C.inventorySheetUrl) + '" target="_blank" rel="noopener">' +
        S.icon("sheet") + "Abrir hoja de inventario" + S.icon("external") + "</a>" +
        '<p class="muted center">En la pestaña <strong>Inventario</strong>, toca <strong>una vez</strong> la primera celda vacía de la columna A (Fecha) y pega.</p>'
        : '<p class="muted center">Luego abre la hoja de Google, toca la primera celda vacía de la columna A y pega.</p>') +
      '<section class="card"><h2 class="group-title">Lo que se copia</h2>' +
      '<ul class="summary">' + counted.map(function (p) {
        return '<li style="--accent:' + p.accent + '"><span>' + S.esc(p.name) + " <small>" + S.esc(p.variant) + "</small></span><strong>" +
          S.num(rec.items[p.sku]) + " <small>" + S.esc(p.unit) + "</small></strong></li>";
      }).join("") + "</ul>" +
      (counted.length < items.length ? '<p class="muted small">' + (items.length - counted.length) + " productos sin contar quedan como celdas vacías.</p>" : "") +
      "</section>" +
      '<div class="btn-row"><a class="btn btn-ghost" href="#/inventario/conteo">Nuevo conteo</a><a class="btn btn-ghost" href="#/">Volver al inicio</a></div>' +
      "</main>";

    var btn = el.querySelector("#copy");
    btn.addEventListener("click", function () {
      S.copyText(dataRow(rec)).then(function (ok) {
        if (!ok) return;
        rec.copied = true;
        S.store.set(LAST, rec);
        btn.classList.add("copied");
        btn.querySelector("span").textContent = "¡Copiado!";
        S.toast("Fila copiada. Ahora abre la hoja y pégala.", "ok");
        var open = el.querySelector("#open-sheet");
        if (open) open.classList.add("ready");
        setTimeout(function () { btn.classList.remove("copied"); btn.querySelector("span").textContent = "Copiar"; }, 2500);
      });
    });
  };

  // exposed for tests
  S.inventario = { headerRow: headerRow, dataRow: dataRow };
})();
