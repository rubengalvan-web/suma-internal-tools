/* Movimientos — traslados (cargar / entregar), salidas y ventas, and the "sin copiar" list.
   Every movement becomes one row for the "Movimientos" tab of the team's Google Sheet. */
(function () {
  "use strict";
  var S = window.SUMA, C = window.SUMA_CONFIG, items = C.inventory;
  var LOG = "mov.log", CURRENT = "mov.current", TR_DRAFT = "tr.draft", SAL_DRAFT = "sal.draft";
  var TRANSIT = "En tránsito · ";

  /* ---------- people, places, local log ---------- */
  function userObj(n) { return C.users.filter(function (u) { return u.name === n; })[0]; }
  function home(n) { var u = userObj(n); return (u && u.home) || C.locations[0]; }
  function transitOf(n) { return TRANSIT + n; }
  function log() { return S.store.get(LOG, []); }
  function saveLog(l) { if (l.length > 500) l = l.slice(-500); S.store.set(LOG, l); }
  function pending() { return log().filter(function (m) { return !m.copied; }); }
  S.movPending = function () { return pending().length; };

  // What a holder has, according to the movements recorded on THIS phone.
  function balance(holder) {
    var b = {};
    log().forEach(function (m) {
      items.forEach(function (p) {
        var q = m.items[p.sku];
        if (!q) return;
        if (m.hacia === holder) b[p.sku] = (b[p.sku] || 0) + q;
        if (m.desde === holder) b[p.sku] = (b[p.sku] || 0) - q;
      });
    });
    return b;
  }
  function hasAny(b) { return items.some(function (p) { return (b[p.sku] || 0) > 0; }); }
  S.transitBalance = function () { return balance(transitOf(S.user)); };

  function units(map) { return items.reduce(function (t, p) { return t + (Number(map[p.sku]) || 0); }, 0); }
  function filled(map) { return items.filter(function (p) { return Number(map[p.sku]) > 0; }).length; }
  function cleanItems(map) {
    var out = {};
    items.forEach(function (p) { var q = S.parseQty(map[p.sku]); if (q) out[p.sku] = q; });
    return out;
  }

  /* ---------- row for the "Movimientos" tab ---------- */
  var HEAD = ["ID", "Fecha", "Tipo", "Desde", "Hacia", "Entregado a", "Registrado por"]
    .concat(items.map(function (p) { return p.header; }),
      ["Cliente o prospecto", "Contacto", "Monto (USD)", "Método de pago", "Nota", "Registrado"]);
  function row(m) {
    return S.toTSV([m.id, m.fecha, m.tipo, m.desde, m.hacia, m.entregadoA || "", m.por]
      .concat(items.map(function (p) { return m.items[p.sku] == null ? "" : m.items[p.sku]; }),
        [m.cliente || "", m.contacto || "", m.monto == null ? "" : Number(m.monto).toFixed(2), m.metodo || "", m.nota || "", m.registrado]));
  }
  function newId() {
    var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return "M-" + S.todayISO().slice(2).replace(/-/g, "") + "-" + s;
  }
  function record(m) {
    m.id = newId(); m.por = S.user; m.registrado = S.nowStamp(); m.copied = false;
    var l = log(); l.push(m); saveLog(l);
    S.store.set(CURRENT, m.id);
    return m;
  }
  function describe(m) {
    if (m.tipo === "Carga") return m.desde + " → " + m.hacia;
    if (m.tipo === "Entrega") return m.desde + " → " + m.entregadoA + " (" + m.hacia + ")";
    if (m.tipo === "Venta") return "Venta desde " + m.desde + (m.cliente ? " · " + m.cliente : "") + " · " + S.money(m.monto || 0) + " " + (m.metodo || "");
    return "Muestra desde " + m.desde + " para " + (m.cliente || "prospecto");
  }
  S.movimientos = { HEAD: HEAD, row: row, balance: balance };

  /* ---------- shared UI pieces ---------- */
  function seg(name, options, value, cls) {
    return '<div class="segmented ' + (cls || "") + '" role="radiogroup">' + options.map(function (o) {
      var v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label;
      return '<label><input type="radio" name="' + name + '" value="' + S.esc(v) + '"' + (v === value ? " checked" : "") + "><span>" + S.esc(l) + "</span></label>";
    }).join("") + "</div>";
  }
  function productList(values, have) {
    var groups = [];
    items.forEach(function (p) {
      var g = groups.filter(function (x) { return x.name === p.group; })[0];
      if (!g) { g = { name: p.group, list: [] }; groups.push(g); }
      g.list.push(p);
    });
    return groups.map(function (g) {
      return '<section class="group"><h2 class="group-title">' + S.esc(g.name) + "</h2>" + g.list.map(function (p) {
        var h = have ? (have[p.sku] || 0) : null;
        return '<div class="item' + (Number(values[p.sku]) > 0 ? " filled" : "") + '" style="--accent:' + p.accent + '" data-sku="' + p.sku + '">' +
          '<label class="item-info" for="m-' + p.sku + '"><span class="item-name">' + S.esc(p.name) + "</span>" +
          '<span class="item-variant">' + S.esc(p.variant) + "</span>" +
          (h ? '<span class="have">Llevas ' + S.num(h) + "</span>" : "") + "</label>" +
          '<div class="item-qty">' + S.stepper("m-" + p.sku, values[p.sku], { label: p.name + " " + p.variant }) +
          '<span class="unit">' + S.esc(p.unit) + "</span></div></div>";
      }).join("") + "</section>";
    }).join("");
  }
  function balanceCard(b, title) {
    var list = items.filter(function (p) { return (b[p.sku] || 0) > 0; });
    if (!list.length) return "";
    return '<section class="card carry-card"><h2 class="group-title">' + S.esc(title) + "</h2><ul class=\"summary\">" +
      list.map(function (p) {
        return '<li style="--accent:' + p.accent + '"><span>' + S.esc(p.name) + " <small>" + S.esc(p.variant) + "</small></span><strong>" +
          S.num(b[p.sku]) + " <small>" + S.esc(p.unit) + "</small></strong></li>";
      }).join("") + "</ul></section>";
  }
  S.carryCard = function () { return balanceCard(S.transitBalance(), "Llevas contigo"); };

  function bindQty(el, values, after) {
    S.bindSteppers(el, function (input) {
      var sku = input.id.slice(2), q = S.parseQty(input.value);
      if (!q) delete values[sku]; else values[sku] = q;
      input.closest(".item").classList.toggle("filled", !!q);
      after();
    });
  }

  /* ---------- 1. Traslado: Cargar / Entregar ---------- */
  S.routes["/traslado"] = function (el) {
    var d = S.store.get(TR_DRAFT, null) || { modo: "cargar", desde: home(S.user), para: "", fecha: S.todayISO(), items: {}, nota: "" };
    var mine = transitOf(S.user), have = balance(mine);
    var others = C.users.filter(function (u) { return u.name !== S.user; });
    var cargar = d.modo === "cargar";

    el.innerHTML = S.header("Traslado", "#/inventario") +
      '<main class="screen has-footer">' +
      '<p class="eyebrow">Inventario en tránsito</p>' +
      '<h1 class="display sm">Registrar traslado</h1>' +
      seg("modo", [{ value: "cargar", label: "Cargar (salida)" }, { value: "entregar", label: "Entregar" }], d.modo, "two") +
      '<div class="card form tr-form">' +
      (cargar
        ? '<fieldset class="field"><legend>Sale de</legend>' + seg("desde", C.locations, d.desde) + "</fieldset>" +
          '<p class="muted small">Queda como <strong>' + S.esc(mine) + "</strong> hasta que lo entregues.</p>"
        : '<fieldset class="field"><legend>Entregar a</legend>' +
          seg("para", others.map(function (u) { return { value: u.name, label: u.name + " · " + u.home }; }), d.para, "wrap") + "</fieldset>" +
          '<p class="muted small">Sale de <strong>' + S.esc(mine) + "</strong> y queda en el lugar de esa persona.</p>") +
      '<label class="field"><span>Fecha</span><input type="date" data-f="fecha" value="' + S.esc(d.fecha) + '"></label>' +
      '<label class="field"><span>Nota <em>opcional</em></span><input type="text" data-f="nota" placeholder="Ej. maleta 1 de 2" value="' + S.esc(d.nota) + '"></label>' +
      "</div>" +
      (!cargar ? (hasAny(have) ? balanceCard(have, "Llevas contigo") :
        '<p class="note">Este teléfono no tiene cargas registradas. Igual puedes registrar la entrega.</p>') : "") +
      productList(d.items, cargar ? null : have) +
      "</main>" +
      '<div class="footer-bar"><div class="footer-inner">' +
      '<div class="footer-meta"><span><strong id="n-items">0</strong> productos</span><small id="n-units"></small></div>' +
      '<button type="button" class="btn btn-primary" id="save" disabled>Guardar traslado</button></div></div>';

    var saveBtn = el.querySelector("#save");
    function refresh() {
      S.store.set(TR_DRAFT, d);
      el.querySelector("#n-items").textContent = filled(d.items);
      el.querySelector("#n-units").textContent = units(d.items) ? S.num(units(d.items)) + " unidades en total" : "Deja en blanco lo que no mueves";
      saveBtn.disabled = !filled(d.items) || (!cargar && !d.para);
      if (!cargar) el.querySelectorAll(".item").forEach(function (it) {
        var sku = it.dataset.sku; it.classList.toggle("over", (Number(d.items[sku]) || 0) > (have[sku] || 0) && hasAny(have));
      });
    }
    bindQty(el, d.items, refresh);
    el.addEventListener("change", function (e) {
      var n = e.target.name;
      if (n === "modo") { d.modo = e.target.value; S.store.set(TR_DRAFT, d); S.refresh(); return; }
      if (n === "desde" || n === "para") { d[n] = e.target.value; refresh(); }
    });
    el.addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-f");
      if (f) { d[f] = e.target.value; S.store.set(TR_DRAFT, d); }
    });
    saveBtn.addEventListener("click", function () {
      var its = cleanItems(d.items);
      if (!Object.keys(its).length) return;
      var m = cargar
        ? { tipo: "Carga", desde: d.desde, hacia: mine, entregadoA: "" }
        : { tipo: "Entrega", desde: mine, hacia: home(d.para), entregadoA: d.para };
      m.fecha = d.fecha || S.todayISO(); m.items = its; m.nota = S.clean(d.nota);
      record(m);
      S.store.del(TR_DRAFT);
      S.go("#/mov/listo");
    });
    refresh();
  };

  /* ---------- 2. Salidas y ventas ---------- */
  function suggested(map) {
    var t = 0, missing = false;
    items.forEach(function (p) {
      var q = Number(map[p.sku]) || 0;
      if (!q) return;
      if (p.retail == null) missing = true; else t += q * p.retail;
    });
    return { total: S.round2(t), missing: missing };
  }

  S.routes["/salidas"] = function (el) {
    var mine = transitOf(S.user);
    var d = S.store.get(SAL_DRAFT, null) || {
      tipo: "Venta", fecha: S.todayISO(), desde: hasAny(balance(mine)) ? mine : home(S.user),
      cliente: "", contacto: "", items: {}, monto: "", manual: false, metodo: "", nota: ""
    };
    var venta = d.tipo === "Venta";
    var froms = C.locations.concat([mine]);

    el.innerHTML = S.header("Salidas y ventas") +
      '<main class="screen has-footer">' +
      '<p class="eyebrow">Salidas de inventario</p>' +
      '<h1 class="display sm">Salidas y ventas</h1>' +
      seg("tipo", [{ value: "Venta", label: "Venta" }, { value: "Muestra", label: "Muestra" }], d.tipo, "two") +
      '<div class="card form">' +
      '<label class="field"><span>Fecha</span><input type="date" data-f="fecha" value="' + S.esc(d.fecha) + '"></label>' +
      '<fieldset class="field"><legend>Sale de</legend>' + seg("desde", froms, d.desde, "wrap") + "</fieldset>" +
      '<label class="field"><span>' + (venta ? "Cliente <em>opcional</em>" : "Prospecto") + '</span><input type="text" data-f="cliente" autocapitalize="words" placeholder="' +
      (venta ? "Ej. Pop-up Chandler" : "Ej. Café Aurora") + '" value="' + S.esc(d.cliente) + '"></label>' +
      '<label class="field"><span>Contacto <em>opcional</em></span><input type="text" data-f="contacto" placeholder="Email o teléfono" value="' + S.esc(d.contacto) + '"></label>' +
      "</div>" +
      productList(d.items, d.desde === mine ? balance(mine) : null) +
      (venta
        ? '<section class="group"><h2 class="group-title">Cobro</h2><div class="card form">' +
          '<label class="field"><span>Monto cobrado (US$)</span><input type="text" inputmode="decimal" data-f="monto" placeholder="0.00" value="' + S.esc(d.monto) + '"></label>' +
          '<p class="muted small" id="sug"></p>' +
          '<fieldset class="field"><legend>Método de pago</legend>' + seg("metodo", C.paymentMethods, d.metodo) + "</fieldset>" +
          "</div></section>"
        : "") +
      '<section class="group"><div class="card form"><label class="field"><span>Nota <em>opcional</em></span><input type="text" data-f="nota" placeholder="' +
      (venta ? "Ej. ventas del pop-up del sábado" : "Ej. probar en espresso, seguir en 2 semanas") + '" value="' + S.esc(d.nota) + '"></label></div></section>' +
      '<button type="button" class="link-btn danger" data-act="reset">Borrar y empezar de nuevo</button>' +
      "</main>" +
      '<div class="footer-bar"><div class="footer-inner">' +
      '<div class="footer-meta"><small>' + (venta ? "Cobrado" : "Muestras") + '</small><strong id="f-main">—</strong></div>' +
      '<button type="button" class="btn btn-primary" id="save" disabled>' + (venta ? "Guardar venta" : "Guardar muestra") + "</button></div></div>";

    var saveBtn = el.querySelector("#save");
    function refresh() {
      if (venta) {
        var sg = suggested(d.items);
        var montoInput = el.querySelector('[data-f="monto"]');
        if (!d.manual) { d.monto = sg.total ? sg.total.toFixed(2) : ""; if (montoInput && document.activeElement !== montoInput) montoInput.value = d.monto; }
        el.querySelector("#sug").innerHTML = (sg.total ? "Precio de venta sugerido: <strong>" + S.money(sg.total) + "</strong>. " : "") +
          (sg.missing ? "El café de 1 kg no tiene precio de venta: escribe el monto. " : "") +
          (d.manual ? '<button type="button" class="link-btn" data-act="use-sug">Usar precio sugerido</button>' : "Puedes cambiar el monto si cobraste otro precio.");
        el.querySelector("#f-main").textContent = d.monto !== "" ? S.money(Number(d.monto) || 0) : "—";
        saveBtn.disabled = !filled(d.items) || !d.metodo || d.monto === "" || !(Number(d.monto) >= 0);
      } else {
        el.querySelector("#f-main").textContent = units(d.items) ? S.num(units(d.items)) + " u" : "—";
        saveBtn.disabled = !filled(d.items) || !S.clean(d.cliente);
      }
      S.store.set(SAL_DRAFT, d);
    }
    bindQty(el, d.items, refresh);
    el.addEventListener("change", function (e) {
      var n = e.target.name;
      if (n === "tipo") { d.tipo = e.target.value; S.store.set(SAL_DRAFT, d); S.refresh(); return; }
      if (n === "desde") { d.desde = e.target.value; S.store.set(SAL_DRAFT, d); S.refresh(); return; }
      if (n === "metodo") { d.metodo = e.target.value; refresh(); }
    });
    el.addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-f");
      if (!f) return;
      if (f === "monto") {
        e.target.value = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        d.manual = true;
      }
      d[f] = e.target.value;
      refresh();
    });
    el.addEventListener("click", function (e) {
      if (e.target.closest('[data-act="use-sug"]')) {
        d.manual = false; refresh();
      }
      if (e.target.closest('[data-act="reset"]')) { S.store.del(SAL_DRAFT); S.refresh(); }
    });
    saveBtn.addEventListener("click", function () {
      var its = cleanItems(d.items);
      if (!Object.keys(its).length) return;
      var m = {
        tipo: d.tipo, fecha: d.fecha || S.todayISO(), desde: d.desde, hacia: venta ? "Cliente" : "Prospecto", entregadoA: "",
        items: its, cliente: S.clean(d.cliente), contacto: S.clean(d.contacto),
        monto: venta ? S.round2(Number(d.monto) || 0) : null, metodo: venta ? d.metodo : "", nota: S.clean(d.nota)
      };
      record(m);
      S.store.del(SAL_DRAFT);
      S.go("#/mov/listo");
    });
    refresh();
  };

  /* ---------- 3. Ready to copy (any movement) ---------- */
  function sheetBtn(id) {
    return C.movementsSheetUrl ? '<a class="btn btn-primary btn-lg btn-block" id="' + id + '" href="' + S.esc(C.movementsSheetUrl) +
      '" target="_blank" rel="noopener">' + S.icon("sheet") + "Abrir hoja · Movimientos" + S.icon("external") + "</a>" : "";
  }

  S.routes["/mov/listo"] = function (el) {
    var id = S.store.get(CURRENT, null), l = log(), idx = -1;
    for (var i = l.length - 1; i >= 0; i--) if (l[i].id === id) { idx = i; break; }
    if (idx < 0) { S.go("#/"); return; }
    var m = l[idx];
    var title = { Carga: "Carga guardada", Entrega: "Entrega guardada", Venta: "Venta guardada", Muestra: "Muestra guardada" }[m.tipo];
    var back = m.tipo === "Carga" || m.tipo === "Entrega" ? "#/traslado" : "#/salidas";
    var others = pending().filter(function (x) { return x.id !== m.id; }).length;

    el.innerHTML = S.header(m.tipo, back) +
      '<main class="screen">' +
      '<div class="done-badge">' + S.icon("check") + "</div>" +
      '<h1 class="display center">' + title + "</h1>" +
      '<p class="lead center">' + S.esc(S.fmtShort(m.fecha)) + " · " + S.esc(describe(m)) + "</p>" +
      '<p class="step-label"><span>1</span>Copia la fila</p>' +
      '<button type="button" class="btn btn-accent btn-xl btn-block" id="copy">' + S.icon("copy") + "<span>Copiar</span></button>" +
      '<p class="step-label"><span>2</span>Pégala en la pestaña Movimientos</p>' + sheetBtn("open-sheet") +
      '<p class="muted center">En la pestaña <strong>Movimientos</strong>, toca <strong>una vez</strong> la primera celda vacía de la columna A (ID) y pega.</p>' +
      '<section class="card"><h2 class="group-title">Lo que se copia</h2><ul class="summary">' +
      items.filter(function (p) { return m.items[p.sku]; }).map(function (p) {
        return '<li style="--accent:' + p.accent + '"><span>' + S.esc(p.name) + " <small>" + S.esc(p.variant) + "</small></span><strong>" +
          S.num(m.items[p.sku]) + " <small>" + S.esc(p.unit) + "</small></strong></li>";
      }).join("") + "</ul>" +
      (m.tipo === "Venta" ? '<div class="totals"><div class="grand"><span>Cobrado · ' + S.esc(m.metodo) + "</span><span>" + S.money(m.monto) + "</span></div></div>" : "") +
      "</section>" +
      (others ? '<a class="callout warn pending-link" href="#/pendientes">' + S.icon("alert") + "<div>Tienes <strong>" + others +
        (others === 1 ? " movimiento más" : " movimientos más") + "</strong> sin copiar. Toca aquí para verlos.</div></a>" : "") +
      (m.tipo === "Carga" || m.tipo === "Entrega" ? S.carryCard() : "") +
      '<div class="btn-row"><a class="btn btn-ghost" href="' + back + '">Registrar otro</a><a class="btn btn-ghost" href="#/">Volver al inicio</a></div>' +
      "</main>";

    var btn = el.querySelector("#copy");
    btn.addEventListener("click", function () {
      S.copyText(row(m)).then(function (ok) {
        if (!ok) return;
        var fresh = log();
        fresh.forEach(function (x) { if (x.id === m.id) x.copied = true; });
        saveLog(fresh);
        btn.classList.add("copied"); btn.querySelector("span").textContent = "¡Copiado!";
        S.toast("Fila copiada. Ahora abre la hoja y pégala.", "ok");
        var open = el.querySelector("#open-sheet"); if (open) open.classList.add("ready");
        setTimeout(function () { btn.classList.remove("copied"); btn.querySelector("span").textContent = "Copiar"; }, 2500);
      });
    });
  };

  /* ---------- 4. Movements not yet copied ---------- */
  S.routes["/pendientes"] = function (el) {
    var list = pending().slice().reverse();
    el.innerHTML = S.header("Sin copiar") +
      '<main class="screen">' +
      '<p class="eyebrow">Movimientos</p>' +
      '<h1 class="display sm">Sin copiar a la hoja</h1>' +
      (list.length
        ? '<p class="lead">Estos movimientos se guardaron en este teléfono pero todavía no se copiaron. Cópialos y pégalos en la pestaña <strong>Movimientos</strong>.</p>' +
          '<button type="button" class="btn btn-accent btn-xl btn-block" id="copy-all">' + S.icon("copy") + "<span>Copiar todos (" + list.length + ")</span></button>" +
          sheetBtn("open-sheet") +
          '<ul class="mov-list">' + list.map(function (m) {
            return '<li><div><strong>' + S.esc(m.tipo) + "</strong> · " + S.esc(S.fmtShort(m.fecha)) + "<br><small>" + S.esc(describe(m)) +
              " · " + S.num(units(m.items)) + " u</small></div>" +
              '<button type="button" class="btn btn-ghost" data-copy="' + S.esc(m.id) + '">' + S.icon("copy") + "</button></li>";
          }).join("") + "</ul>"
        : '<p class="lead">Todo está copiado. No hay movimientos pendientes.</p><a class="btn btn-primary btn-lg btn-block" href="#/">Volver al inicio</a>') +
      "</main>";

    function mark(ids) {
      var l = log();
      l.forEach(function (x) { if (ids.indexOf(x.id) >= 0) x.copied = true; });
      saveLog(l);
    }
    var all = el.querySelector("#copy-all");
    if (all) all.addEventListener("click", function () {
      var rows = list.slice().reverse();          // oldest first, like the sheet
      S.copyText(rows.map(row).join("\n")).then(function (ok) {
        if (!ok) return;
        mark(rows.map(function (m) { return m.id; }));
        S.toast(rows.length + " filas copiadas. Pégalas en Movimientos.", "ok");
        all.querySelector("span").textContent = "¡Copiadas!";
        var open = el.querySelector("#open-sheet"); if (open) open.classList.add("ready");
      });
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (!b) return;
      var m = list.filter(function (x) { return x.id === b.dataset.copy; })[0];
      S.copyText(row(m)).then(function (ok) {
        if (!ok) return;
        mark([m.id]);
        b.closest("li").classList.add("done");
        S.toast("Fila copiada. Pégala en Movimientos.", "ok");
      });
    });
  };
})();
