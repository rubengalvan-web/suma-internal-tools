/* B2B Pricing Calculator — live wholesale quote, branded PDF, local log, one-tap copy */
(function () {
  "use strict";
  var S = window.SUMA, C = window.SUMA_CONFIG, B = C.b2b;
  var FORM = "b2b.form", QUOTES = "b2b.quotes", CURRENT = "b2b.current";
  var LB_G = 453.592;

  /* ---------- pricing engine ---------- */
  function emptyForm() { return { cliente: "", contacto: "", destino: "", lang: S.store.get("b2b.lang", "en"), qty: {}, rate: "" }; }

  function snackTier(units) {
    for (var i = 0; i < B.snacks.tiers.length; i++) if (units >= B.snacks.tiers[i].minUnits) return B.snacks.tiers[i];
    return null;
  }

  function commercialPerLb() { return S.round2(B.commercial.coffeeBagPrice * LB_G / B.commercial.coffeeBagGrams); }
  function shippingFor(lb) {
    var sh = B.shipping;
    if (!lb) return 0;
    return lb <= sh.includedLb ? sh.flatFee : S.round2(sh.flatFee + sh.perExtraLb * (lb - sh.includedLb));
  }

  function compute(form) {
    var lines = [], coffeeLb = 0, snackU = 0, weight = 0;
    B.products.forEach(function (p) {
      var q = S.parseQty(form.qty[p.id]);
      if (!q) return;
      lines.push({ id: p.id, kind: p.kind, name: p.name, es: p.es, en: p.en, accent: p.accent, q: q });
      if (p.kind === "coffee") { coffeeLb += q; weight += q; }
      else { snackU += q; weight += q * (p.grams || 0) / LB_G; }
    });
    coffeeLb = S.round2(coffeeLb);
    var negotiable = coffeeLb >= B.coffee.negotiableFromLb;
    var agreed = S.parseQty(form.rate);
    var coffeeRate = negotiable ? (agreed > 0 ? agreed : null) : B.coffee.pricePerLb;
    var tier = snackTier(snackU);
    var snackRate = tier ? tier.pricePerUnit : null;
    var belowMin = snackU > 0 && snackU < B.snacks.minimumUnits;
    var comLb = commercialPerLb();
    var coffeeSub = 0, snackSub = 0, pending = false, commercialValue = 0;
    lines.forEach(function (l) {
      l.unit = l.kind === "coffee" ? "lb" : "u";
      l.price = l.kind === "coffee" ? coffeeRate : snackRate;
      l.commercial = l.kind === "coffee" ? comLb : B.commercial.snackUnitPrice;
      l.commercialTotal = S.round2(l.q * l.commercial);
      l.total = l.price == null ? null : S.round2(l.q * l.price);
      if (l.total == null) pending = true;
      else {
        commercialValue += l.commercialTotal;
        if (l.kind === "coffee") coffeeSub += l.total; else snackSub += l.total;
      }
    });
    var total = S.round2(coffeeSub + snackSub);
    var shipLb = weight > 0 ? Math.ceil(weight - 1e-9) : 0;       // round partial pounds up
    var shipping = shippingFor(shipLb);
    commercialValue = S.round2(commercialValue);
    var savings = S.round2(commercialValue - total);
    return {
      lines: lines, coffeeLb: coffeeLb, snackU: snackU,
      negotiable: negotiable, negotiatedRate: negotiable && agreed > 0 ? agreed : null,
      coffeeRate: coffeeRate, snackRate: snackRate, belowMin: belowMin, pending: pending,
      coffeeSub: S.round2(coffeeSub), snackSub: S.round2(snackSub), total: total,
      commercialPerLb: comLb, commercialValue: commercialValue, savings: savings,
      savingsPct: commercialValue > 0 ? savings / commercialValue : 0,
      weightLb: S.round2(weight), shipLb: shipLb, shipping: shipping, grandTotal: S.round2(total + shipping),
      hasCoffee: coffeeLb > 0, hasSnacks: snackU > 0,
      canQuote: lines.length > 0 && !belowMin
    };
  }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function perShot(rate) { return S.round2(rate / LB_G * B.coffee.doseShotG); }
  function perBev(rate) { return S.round2(rate / LB_G * B.coffee.doseBeverageG); }

  /* ---------- quote document text ---------- */
  var T = {
    es: {
      kicker: "Cotización mayorista", title: "Café de especialidad y snacks andinos",
      quoteNo: "Cotización", date: "Fecha", validUntil: "Válida hasta", preparedFor: "Preparada para", from: "De", by: "Atendido por",
      product: "Producto", qty: "Cantidad", unitPrice: "Precio unitario", lineTotal: "Total",
      retail: "Precio comercial", wholesale: "Precio mayorista", retailValue: "Valor a precio comercial",
      savings: "Ahorro mayorista", subtotal: "Subtotal mayorista", shipping: "Envío",
      saveBanner: function (a, p) { return "Ahorras " + a + " (" + p + ") frente al precio comercial"; },
      shipTerm: function (f, i, x) { return "Envío: " + f + " por las primeras " + i + " lb, más " + x + " por cada libra adicional (peso de café y snacks, redondeado a la libra siguiente)."; },
      retailTerm: "Precio comercial = precio de venta al público en sumaorganics.com.",
      coffeeSub: "Subtotal café", snackSub: "Subtotal snacks", total: "Total", tbc: "Por confirmar",
      negotiable: "Negociable — consúltanos", u: "u.", perU: "/ u.", perLb: "/ lb",
      terms: "Condiciones",
      lead: function (d) { return "Tiempo de entrega: " + d + " días hábiles."; },
      validity: function (d, until) { return "Cotización válida por " + d + " días calendario (hasta el " + until + ")."; },
      prices: "Precios en dólares (USD), puestos en Arizona, empaque incluido.",
      agreed: function (r) { return "Café: precio acordado de " + r + " por libra para pedidos de 400 lb o más."; },
      pendingNote: "Café: los pedidos de 400 lb o más tienen precio negociable. Te confirmamos el precio final.",
      shotRef: function (r, s, b) { return "Referencia para tu menú: a " + r + "/lb, ≈ " + s + " por shot (9 g) y " + b + " por bebida (18 g)."; },
      snackTerms: function (min, t) { return "Snacks: pedido mínimo de " + min + " unidades. " + t.replace(/\.$/, "") + "."; },
      tierText: function (a, b, c) { return a + " c/u de " + b + " a " + c + " u."; },
      tierTop: function (a, b) { return a + " c/u desde " + b + " u."; },
      origin: "Café arábica orgánico de origen único, proceso lavado, 85 puntos. Ayacucho, Perú. Tostado en origen.",
      none: "—"
    },
    en: {
      kicker: "Wholesale quote", title: "Specialty coffee & Andean snacks",
      quoteNo: "Quote", date: "Date", validUntil: "Valid until", preparedFor: "Prepared for", from: "From", by: "Prepared by",
      product: "Product", qty: "Quantity", unitPrice: "Unit price", lineTotal: "Total",
      retail: "Retail price", wholesale: "Wholesale price", retailValue: "Retail value",
      savings: "Wholesale savings", subtotal: "Wholesale subtotal", shipping: "Shipping",
      saveBanner: function (a, p) { return "You save " + a + " (" + p + ") vs. retail"; },
      shipTerm: function (f, i, x) { return "Shipping: " + f + " for the first " + i + " lb, plus " + x + " per additional lb (coffee and snack weight, rounded up to the next pound)."; },
      retailTerm: "Retail price = SUMA's public price at sumaorganics.com.",
      coffeeSub: "Coffee subtotal", snackSub: "Snacks subtotal", total: "Total", tbc: "To be confirmed",
      negotiable: "Negotiable — contact us", u: "units", perU: "/ unit", perLb: "/ lb",
      terms: "Terms",
      lead: function (d) { return "Lead time: " + d + " business days."; },
      validity: function (d, until) { return "Quote valid for " + d + " calendar days (until " + until + ")."; },
      prices: "Prices in US dollars, landed in Arizona, packaging included.",
      agreed: function (r) { return "Coffee: agreed price of " + r + " per lb for orders of 400 lb or more."; },
      pendingNote: "Coffee: orders of 400 lb or more are priced by agreement. We will confirm the final price.",
      shotRef: function (r, s, b) { return "Menu reference: at " + r + "/lb, ≈ " + s + " per shot (9 g) and " + b + " per beverage (18 g)."; },
      snackTerms: function (min, t) { return "Snacks: " + min + "-unit minimum order. " + t + "."; },
      tierText: function (a, b, c) { return a + " each for " + b + "–" + c + " units"; },
      tierTop: function (a, b) { return a + " each for " + b + "+ units"; },
      origin: "Organic single-origin Arabica, washed process, 85-point cup score. Ayacucho, Peru. Roasted at origin.",
      none: "—"
    }
  };

  function tiersSentence(t) {
    var tiers = B.snacks.tiers.slice().sort(function (a, b) { return a.minUnits - b.minUnits; });
    return tiers.map(function (x, i) {
      var next = tiers[i + 1];
      return next ? t.tierText(S.money(x.pricePerUnit), x.minUnits, next.minUnits - 1) : t.tierTop(S.money(x.pricePerUnit), x.minUnits);
    }).join(t === T.es ? "; " : "; ");
  }

  function termsList(q, t) {
    var c = q.calc;
    var terms = [t.lead(B.leadTimeBusinessDays), t.validity(B.validityCalendarDays, S.fmtDate(q.validUntil, q.lang)), t.prices,
      t.shipTerm(S.money(B.shipping.flatFee), B.shipping.includedLb, S.money(B.shipping.perExtraLb)), t.retailTerm];
    if (c.hasCoffee && c.negotiatedRate) terms.push(t.agreed(S.money(c.negotiatedRate)));
    if (c.hasCoffee && c.negotiable && !c.negotiatedRate) terms.push(t.pendingNote);
    if (c.hasCoffee && c.coffeeRate) terms.push(t.shotRef(S.money(c.coffeeRate), S.money(perShot(c.coffeeRate)), S.money(perBev(c.coffeeRate))));
    if (c.hasSnacks) terms.push(t.snackTerms(B.snacks.minimumUnits, tiersSentence(t)));
    return terms;
  }

  function quoteDoc(q) {
    var t = T[q.lang] || T.en, c = q.calc;
    var rows = c.lines.map(function (l) {
      var unitLabel = l.kind === "coffee" ? "lb" : t.u;
      var per = l.kind === "coffee" ? t.perLb : t.perU;
      var price = l.price == null ? '<span class="neg">' + t.negotiable + "</span>" : S.money(l.price) + " " + per;
      return "<tr><td><strong>" + S.esc(l.name) + "</strong><small>" + S.esc(l[q.lang] || l.en) + "</small></td>" +
        '<td class="num">' + S.num(l.q) + " " + unitLabel + "</td>" +
        '<td class="num"><span class="strike">' + S.money(l.commercial) + " " + per + "</span></td>" +
        '<td class="num">' + price + "</td>" +
        '<td class="num">' + (l.total == null ? '<span class="neg">' + t.tbc + "</span>" : S.money(l.total)) + "</td></tr>";
    }).join("");
    var terms = termsList(q, t);
    var party = [q.cliente ? "<strong>" + S.esc(q.cliente) + "</strong>" : "", S.esc(q.contacto), S.esc(q.destino)].filter(Boolean).join("<br>") || t.none;
    var K = B.contact;

    return '<article class="qdoc" lang="' + q.lang + '">' +
      '<div class="qdoc-head"><img src="assets/logo-wordmark.png" alt="SUMA">' +
      '<div class="qdoc-headtext"><span class="qdoc-kicker">' + t.kicker + '</span><span class="qdoc-title">' + t.title + "</span></div></div>" +
      '<div class="andean-band"></div>' +
      '<div class="qdoc-body">' +
      '<div class="qdoc-meta">' +
      '<div><span class="k">' + t.quoteNo + '</span><span class="v">' + S.esc(q.id) + "</span></div>" +
      '<div><span class="k">' + t.date + '</span><span class="v">' + S.fmtDate(q.fecha, q.lang) + "</span></div>" +
      '<div><span class="k">' + t.validUntil + '</span><span class="v">' + S.fmtDate(q.validUntil, q.lang) + "</span></div></div>" +
      '<div class="qdoc-parties">' +
      '<div><span class="k">' + t.preparedFor + "</span><p>" + party + "</p></div>" +
      '<div><span class="k">' + t.from + "</span><p><strong>" + K.company + "</strong><br>" + (q.preparedBy ? t.by + " " + S.esc(q.preparedBy) + "<br>" : "") + K.city + "<br>" + K.email + "<br>" + K.web + "</p></div></div>" +
      '<table class="qdoc-lines"><thead><tr><th>' + t.product + '</th><th class="num">' + t.qty + '</th><th class="num">' + t.retail + '</th><th class="num">' + t.wholesale + '</th><th class="num">' + t.lineTotal + "</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      '<div class="qdoc-totals">' +
      (!c.pending && c.savings > 0 ? '<div class="qdoc-save">' + S.esc(t.saveBanner(S.money(c.savings), pct(c.savingsPct))) + "</div>" +
        '<div class="muted-row"><span>' + t.retailValue + "</span><span>" + S.money(c.commercialValue) + "</span></div>" +
        '<div class="save-row"><span>' + t.savings + "</span><span>−" + S.money(c.savings) + " (" + pct(c.savingsPct) + ")</span></div>" : "") +
      "<div><span>" + t.subtotal + "</span><span>" + (c.pending ? t.tbc : S.money(c.total)) + "</span></div>" +
      "<div><span>" + t.shipping + " (" + c.shipLb + " lb)</span><span>" + S.money(c.shipping) + "</span></div>" +
      '<div class="grand"><span>' + t.total + " (USD)</span><span>" + (c.pending ? t.tbc : S.money(c.grandTotal)) + "</span></div></div>" +
      '<div class="qdoc-terms"><h3>' + t.terms + "</h3><ul>" + terms.map(function (x) { return "<li>" + S.esc(x) + "</li>"; }).join("") + "</ul></div>" +
      (c.hasCoffee ? '<p class="qdoc-origin">' + t.origin + "</p>" : "") +
      "</div>" +
      '<footer class="qdoc-foot">' + [K.company, K.legal, K.city, K.web, K.email].join(" · ") + "</footer></article>";
  }

  /* ---------- row for Google Sheets ---------- */
  var HEAD = ["Fecha", "Cotización", "Preparada por", "Cliente", "Contacto", "Destino", "Detalle", "Café (lb)", "Snacks (u)",
    "Peso envío (lb)", "Valor comercial (USD)", "Ahorro (USD)", "Subtotal mayorista (USD)", "Envío (USD)", "Total (USD)", "Válida hasta", "Estado"];
  function quoteRow(q) {
    var c = q.calc;
    var detail = c.lines.map(function (l) {
      var fmt = l.kind === "coffee" ? " " + l.es.replace(/^.*· /, "").toLowerCase() : "";
      return l.name + fmt + " " + S.num(l.q) + " " + (l.kind === "coffee" ? "lb" : "u") +
        " × " + (l.price == null ? "negociable" : S.money(l.price));
    }).join("; ");
    return S.toTSV([q.fecha, q.id, q.preparedBy || "", q.cliente, q.contacto, q.destino, detail,
      c.coffeeLb || "", c.snackU || "", c.shipLb,
      c.pending ? "" : c.commercialValue.toFixed(2), c.pending ? "" : c.savings.toFixed(2),
      c.pending ? "Por confirmar" : c.total.toFixed(2), c.shipping.toFixed(2),
      c.pending ? "Por confirmar" : c.grandTotal.toFixed(2), q.validUntil, q.estado]);
  }

  // Quotes saved before v1.3 have no retail/shipping numbers: rebuild them from their lines.
  function upgrade(q) {
    if (q && q.calc && q.calc.grandTotal == null) {
      var qty = {};
      q.calc.lines.forEach(function (l) { qty[l.id] = l.q; });
      q.calc = compute({ qty: qty, rate: q.calc.negotiatedRate || "" });
    }
    return q;
  }

  function newId() {
    var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return "Q-" + S.todayISO().slice(2).replace(/-/g, "") + "-" + s;
  }

  /* ---------- 1. Build the quote ---------- */
  S.routes["/b2b"] = function (el) {
    var form = S.store.get(FORM, null) || emptyForm();
    var coffee = B.products.filter(function (p) { return p.kind === "coffee"; });
    var snacks = B.products.filter(function (p) { return p.kind === "snack"; });
    function rowHTML(p, step, unit) {
      return '<div class="item" style="--accent:' + p.accent + '">' +
        '<label class="item-info" for="b-' + p.id + '"><span class="item-name">' + S.esc(p.name) + "</span>" +
        '<span class="item-variant">' + S.esc(p.es) + "</span></label>" +
        '<div class="item-qty">' + S.stepper("b-" + p.id, form.qty[p.id], { step: step, decimals: p.kind === "coffee", label: p.name + " " + p.es }) +
        '<span class="unit">' + unit + "</span></div></div>";
    }
    var r = B.coffee.pricePerLb;

    el.innerHTML = S.header("B2B Pricing") +
      '<main class="screen has-footer">' +
      '<p class="eyebrow">Cotización mayorista</p>' +
      '<h1 class="display">B2B Pricing</h1>' +
      '<section class="group"><h2 class="group-title">Cliente</h2><div class="card form">' +
      '<label class="field"><span>Negocio o cliente</span><input type="text" data-f="cliente" autocapitalize="words" placeholder="Ej. Café Aurora" value="' + S.esc(form.cliente) + '"></label>' +
      '<label class="field"><span>Contacto <em>opcional</em></span><input type="text" data-f="contacto" placeholder="Nombre, email o teléfono" value="' + S.esc(form.contacto) + '"></label>' +
      '<label class="field"><span>Destino de entrega</span><input type="text" data-f="destino" placeholder="Ciudad, estado" value="' + S.esc(form.destino) + '"></label>' +
      "</div></section>" +
      '<section class="group"><h2 class="group-title">Café · por libra</h2>' +
      '<p class="rule">Mayorista ' + S.money(r) + "/lb hasta " + (B.coffee.negotiableFromLb - 1) + " lb · " + B.coffee.negotiableFromLb + " lb o más: negociable<br>" +
      "Precio comercial " + S.money(commercialPerLb()) + "/lb (" + S.money(B.commercial.coffeeBagPrice) + " la bolsa de " + B.commercial.coffeeBagGrams + " g)<br>" +
      "<small>≈ " + S.money(perShot(r)) + " por shot (9 g) · " + S.money(perBev(r)) + " por bebida (18 g)</small></p>" +
      coffee.map(function (p) { return rowHTML(p, 5, "lb"); }).join("") +
      '<div id="neg-slot"></div></section>' +
      '<section class="group"><h2 class="group-title">Snacks · por unidad</h2>' +
      '<p class="rule">Mínimo ' + B.snacks.minimumUnits + " u en total · " + tiersSentence(T.es) + "<br>Precio comercial " + S.money(B.commercial.snackUnitPrice) + " c/u</p>" +
      snacks.map(function (p) { return rowHTML(p, 5, "u"); }).join("") +
      '<div id="snack-slot"></div></section>' +
      '<section class="group"><h2 class="group-title">Idioma del PDF</h2>' +
      '<div class="segmented two" role="radiogroup">' +
      '<label><input type="radio" name="lang" value="es"' + (form.lang === "es" ? " checked" : "") + "><span>Español</span></label>" +
      '<label><input type="radio" name="lang" value="en"' + (form.lang !== "es" ? " checked" : "") + "><span>English</span></label></div></section>" +
      '<section class="group"><h2 class="group-title">Resumen</h2><div class="card" id="summary"></div></section>' +
      '<button type="button" class="link-btn danger" data-act="reset">Borrar todo y empezar de nuevo</button>' +
      "</main>" +
      '<div class="footer-bar"><div class="footer-inner">' +
      '<div class="footer-meta"><small>Total</small><strong id="f-total">—</strong></div>' +
      '<button type="button" class="btn btn-primary" id="gen" disabled>Generar cotización</button></div></div>';

    var negSlot = el.querySelector("#neg-slot"), snackSlot = el.querySelector("#snack-slot");
    var summary = el.querySelector("#summary"), fTotal = el.querySelector("#f-total"), gen = el.querySelector("#gen");

    function save() { S.store.set(FORM, form); }

    function paint() {
      var c = compute(form);
      // 400 lb+ callout (kept mounted while negotiable so the rate input keeps focus)
      if (c.negotiable && !negSlot.firstChild) {
        negSlot.innerHTML = '<div class="callout warn">' + S.icon("alert") +
          "<div><strong>" + B.coffee.negotiableFromLb + " lb o más: precio negociable.</strong> Consulta con Ruben o Manuel antes de cotizar. " +
          "Si ya acordaron un precio, escríbelo aquí:" +
          '<label class="field inline"><span>Precio acordado (US$/lb)</span><input type="text" inputmode="decimal" data-f="rate" placeholder="Ej. 18.50" value="' + S.esc(form.rate) + '"></label></div></div>';
      } else if (!c.negotiable) negSlot.innerHTML = "";

      var snackMsg = "";
      if (c.belowMin) snackMsg = '<div class="callout warn">' + S.icon("alert") + "<div>Faltan <strong>" + S.num(B.snacks.minimumUnits - c.snackU) + " u</strong> de snacks para el mínimo de " + B.snacks.minimumUnits + ".</div></div>";
      else if (c.hasSnacks) {
        var better = B.snacks.tiers.filter(function (t) { return t.minUnits > c.snackU; }).pop();
        if (better) snackMsg = '<div class="callout tip">Con <strong>' + S.num(better.minUnits - c.snackU) + " u</strong> más, el precio baja a " + S.money(better.pricePerUnit) + " c/u.</div>";
      }
      snackSlot.innerHTML = snackMsg;

      if (!c.lines.length) summary.innerHTML = '<p class="muted">Agrega cantidades para ver el precio.</p>';
      else summary.innerHTML = '<ul class="summary">' + c.lines.map(function (l) {
        return '<li style="--accent:' + l.accent + '"><span>' + S.esc(l.name) + " <small>" + S.num(l.q) + " " + l.unit + " × " +
          (l.price == null ? "negociable" : S.money(l.price)) + "</small></span><strong>" + (l.total == null ? "Por confirmar" : S.money(l.total)) + "</strong></li>";
      }).join("") + "</ul>" +
        '<div class="totals">' +
        (!c.pending && c.savings > 0 ?
          '<div class="muted-row"><span>Valor comercial</span><span>' + S.money(c.commercialValue) + "</span></div>" +
          '<div class="save-row"><span>Ahorro mayorista</span><span>−' + S.money(c.savings) + " (" + pct(c.savingsPct) + ")</span></div>" : "") +
        "<div><span>Subtotal mayorista</span><span>" + (c.pending ? (c.total ? S.money(c.total) + " + café por confirmar" : "Por confirmar") : S.money(c.total)) + "</span></div>" +
        "<div><span>Envío · " + c.shipLb + " lb</span><span>" + S.money(c.shipping) + "</span></div>" +
        '<div class="grand"><span>Total</span><span>' + (c.pending ? "Por confirmar" : S.money(c.grandTotal)) + "</span></div></div>" +
        '<p class="muted small">Envío: ' + S.money(B.shipping.flatFee) + " hasta " + B.shipping.includedLb + " lb + " + S.money(B.shipping.perExtraLb) +
        " por lb adicional. Peso: " + (c.hasCoffee && c.hasSnacks ? "café " + S.num(c.coffeeLb) + " lb + snacks " + S.num(S.round2(c.weightLb - c.coffeeLb)) + " lb = " : "") +
        S.num(c.weightLb) + " lb" + (c.weightLb !== c.shipLb ? ", redondeado a " + c.shipLb + " lb" : "") + ".</p>" +
        '<p class="muted small">Entrega: ' + B.leadTimeBusinessDays + " días hábiles · Válida " + B.validityCalendarDays + " días calendario</p>";

      fTotal.textContent = !c.lines.length ? "—" : c.pending ? "Por confirmar" : S.money(c.grandTotal);
      gen.disabled = !c.canQuote;
    }

    S.bindSteppers(el, function (input) {
      var id = input.id.slice(2);
      var q = S.parseQty(input.value);
      if (q == null || q === 0) delete form.qty[id]; else form.qty[id] = input.value;
      input.closest(".item").classList.toggle("filled", !!q);
      save(); paint();
    });
    el.querySelectorAll(".step-input").forEach(function (i) { i.closest(".item").classList.toggle("filled", !!S.parseQty(i.value)); });
    el.addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-f");
      if (!f) return;
      if (f === "rate") e.target.value = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      form[f] = e.target.value;
      save(); paint();
    });
    el.addEventListener("change", function (e) {
      if (e.target.name === "lang") { form.lang = e.target.value; S.store.set("b2b.lang", form.lang); save(); }
    });
    el.querySelector('[data-act="reset"]').addEventListener("click", function () {
      S.store.del(FORM);
      S.refresh();
    });
    gen.addEventListener("click", function () {
      var c = compute(form);
      if (!c.canQuote) return;
      var fecha = S.todayISO();
      var q = {
        id: newId(), fecha: fecha, validUntil: S.addDays(fecha, B.validityCalendarDays),
        preparedBy: S.user || "",
        cliente: S.clean(form.cliente), contacto: S.clean(form.contacto), destino: S.clean(form.destino),
        lang: form.lang === "es" ? "es" : "en", calc: c, estado: "Enviada", createdAt: new Date().toISOString(), copied: false
      };
      var log = S.store.get(QUOTES, []);
      log.push(q);
      if (log.length > 200) log = log.slice(-200);
      S.store.set(QUOTES, log);
      S.store.set(CURRENT, q.id);
      S.sync.add({ id: q.id, tab: "Cotizaciones", head: HEAD, row: quoteRow(q).split("\t"),
        label: "Cotización " + q.id + (q.cliente ? " · " + q.cliente : "") });
      S.go("#/b2b/cotizacion");
    });
    paint();
  };

  /* ---------- 2. Quote ready: copy + PDF ---------- */
  function currentQuote() {
    var id = S.store.get(CURRENT, null), log = S.store.get(QUOTES, []);
    for (var i = log.length - 1; i >= 0; i--) if (log[i].id === id) return { q: upgrade(log[i]), log: log, i: i };
    return null;
  }

  S.routes["/b2b/cotizacion"] = function (el) {
    var cur = currentQuote();
    if (!cur) { S.go("#/b2b"); return; }
    var q = cur.q;

    el.innerHTML = S.header("Cotización", "#/b2b") +
      '<main class="screen">' +
      '<div class="done-badge">' + S.icon("check") + "</div>" +
      '<h1 class="display center">Cotización lista</h1>' +
      '<p class="lead center">' + S.esc(q.id) + (q.cliente ? " · " + S.esc(q.cliente) : "") + "<br>" +
      "Total: <strong>" + (q.calc.pending ? "Por confirmar" : S.money(q.calc.grandTotal)) + "</strong> · válida hasta el " + S.esc(S.fmtShort(q.validUntil)) + "</p>" +
      '<div class="segmented two slim" role="radiogroup" aria-label="Idioma del PDF">' +
      '<label><input type="radio" name="qlang" value="es"' + (q.lang === "es" ? " checked" : "") + "><span>PDF en español</span></label>" +
      '<label><input type="radio" name="qlang" value="en"' + (q.lang !== "es" ? " checked" : "") + "><span>PDF in English</span></label></div>" +
      '<button type="button" class="btn btn-accent btn-xl btn-block" id="share">' + S.icon("share") + "<span>Enviar PDF</span></button>" +
      '<p class="muted center">Se abre el menú para mandarlo por <strong>WhatsApp</strong>, correo o guardarlo en Archivos.</p>' +
      (S.sync.enabled ? S.sync.box(q.id) :
      '<button type="button" class="btn btn-primary btn-lg btn-block" id="copy">' + S.icon("copy") + "<span>Copiar fila para la hoja</span></button>") +
      (C.quotesSheetUrl ? '<a class="link-btn block-link" href="' + S.esc(C.quotesSheetUrl) + '" target="_blank" rel="noopener">' + S.icon("sheet") + "Abrir hoja · pestaña Cotizaciones</a>" : "") +
      '<div class="preview" id="preview">' + quoteDoc(q) + "</div>" +
      '<div class="row-actions">' +
      '<button type="button" class="link-btn" id="download">' + S.icon("download") + "Descargar PDF</button> &nbsp; " +
      '<button type="button" class="link-btn" id="copy-head">' + S.icon("sheet") + "Copiar encabezados</button></div>" +
      '<div class="btn-row"><a class="btn btn-ghost" href="#/b2b">' + S.icon("edit") + 'Editar</a>' +
      '<button type="button" class="btn btn-ghost" data-act="new">Nueva cotización</button></div>' +
      "</main>";

    loadLogo();   // ready before the tap, so the PDF is built instantly inside the tap (iOS needs that for sharing)

    function save() { cur.log[cur.i] = q; S.store.set(QUOTES, cur.log); }

    el.querySelector("#share").addEventListener("click", function () {
      sharePDF(q, function () { q.shared = true; save(); });
    });
    el.querySelector("#download").addEventListener("click", function () {
      var out = makePDF(q);
      if (out) downloadBlob(out.blob, out.name);
    });
    if (S.sync.enabled) S.sync.bind(el);
    var btn = el.querySelector("#copy");
    if (btn) btn.addEventListener("click", function () {
      S.copyText(quoteRow(q)).then(function (ok) {
        if (!ok) return;
        q.copied = true; save();
        btn.querySelector("span").textContent = "¡Fila copiada!";
        S.toast("Fila copiada. Pégala en la hoja de Google.", "ok");
        setTimeout(function () { btn.querySelector("span").textContent = "Copiar fila para la hoja"; }, 2500);
      });
    });
    el.querySelector("#copy-head").addEventListener("click", function () {
      S.copyText(S.toTSV(HEAD)).then(function (ok) { if (ok) S.toast("Encabezados copiados. Pégalos en la fila 1.", "ok"); });
    });
    el.addEventListener("change", function (e) {
      if (e.target.name !== "qlang") return;
      q.lang = e.target.value; save();
      S.store.set("b2b.lang", q.lang);
      el.querySelector("#preview").innerHTML = quoteDoc(q);
    });
    el.querySelector('[data-act="new"]').addEventListener("click", function () {
      S.store.del(FORM);
      S.go("#/b2b");
    });
  };

  /* ---------- real PDF file (vector, jsPDF bundled in js/vendor) ---------- */
  var logoData = null;
  function loadLogo() {
    if (logoData) return;
    try {
      fetch("assets/logo-pdf.png").then(function (r) { return r.blob(); }).then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { logoData = fr.result; };
        fr.readAsDataURL(b);
      }).catch(function () { /* PDF falls back to a text wordmark */ });
    } catch (e) { /* ignore */ }
  }

  function pdfName(q) {
    var who = (q.cliente || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (q.lang === "es" ? "SUMA-Cotizacion-" : "SUMA-Quote-") + q.id + (who ? "-" + who : "") + ".pdf";
  }

  function buildPDF(q) {
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) return null;
    var t = T[q.lang] || T.en, c = q.calc, K = B.contact;
    var doc = new J({ unit: "pt", format: "letter" });
    var W = 612, H = 792, M = 40, y;
    var col = { forest: "#182B19", cream: "#FDF7DF", kraft: "#EDE5D0", sage: "#627940", ink: "#1C1C1A", soft: "#6B6656",
      terra: "#B8441A", line: "#E3DCC6", orange: "#F67633", gold: "#C8881A", teal: "#08839D" };
    function tx(v) { return String(v == null ? "" : v).replace(/≈/g, "~"); }
    function font(style, size, color) { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(color); }
    function label(v, x, yy, align) {
      font("bold", 7.5, col.sage);
      if (align) doc.text(tx(v).toUpperCase(), x, yy, { align: align });
      else doc.text(tx(v).toUpperCase(), x, yy, { charSpace: 1 });
    }
    function band(yy) {
      var s = 0.75, tile = 48 * s;
      doc.setFillColor(col.forest); doc.rect(0, yy, W, 12 * s, "F");
      for (var ox = 0; ox < W; ox += tile) {
        doc.setFillColor(col.gold);
        [[0, 9, 24], [3, 6, 18], [6, 3, 12], [9, 0, 6]].forEach(function (r) { doc.rect(ox + r[0] * s, yy + r[1] * s, r[2] * s, 3 * s + 0.3, "F"); });
        doc.setFillColor(col.orange);
        [[24, 0, 24], [27, 3, 18], [30, 6, 12], [33, 9, 6]].forEach(function (r) { doc.rect(ox + r[0] * s, yy + r[1] * s, r[2] * s, 3 * s + 0.3, "F"); });
        doc.setFillColor(col.forest); doc.rect(ox + 11 * s, yy + 6 * s, 2 * s, 2 * s, "F");
        doc.setFillColor(col.cream); doc.rect(ox + 35 * s, yy + 3 * s, 2 * s, 2 * s, "F");
        doc.setFillColor(col.teal); doc.rect(ox + 19 * s, yy + 1 * s, 2 * s, 2 * s, "F"); doc.rect(ox + 43 * s, yy + 10 * s, 2 * s, 2 * s, "F");
      }
    }

    // header
    doc.setFillColor(col.forest); doc.rect(0, 0, W, 86, "F");
    if (logoData) doc.addImage(logoData, "PNG", M, 26, 105, 34, "suma-logo", "FAST");
    else { font("bold", 30, col.cream); doc.text("SUMA", M, 56); }
    font("bold", 16, col.cream); doc.text(tx(t.kicker).toUpperCase(), W - M, 44, { align: "right" });
    font("normal", 9, col.kraft); doc.text(tx(t.title), W - M, 60, { align: "right" });
    band(86);

    // quote number / dates
    y = 128;
    [[t.quoteNo, q.id], [t.date, S.fmtDate(q.fecha, q.lang)], [t.validUntil, S.fmtDate(q.validUntil, q.lang)]].forEach(function (m, i) {
      var x = M + i * 180;
      label(m[0], x, y);
      font("bold", 10.5, col.ink); doc.text(tx(m[1]), x, y + 15);
    });
    doc.setDrawColor(col.line); doc.setLineWidth(0.8); doc.line(M, y + 30, W - M, y + 30);

    // parties
    y = 180;
    label(t.preparedFor, M, y);
    label(t.from, M + 280, y);
    var left = [[q.cliente, "bold"], [q.contacto, "normal"], [q.destino, "normal"]].filter(function (r) { return r[0]; });
    if (!left.length) left = [["—", "normal"]];
    var right = [[K.company, "bold"]];
    if (q.preparedBy) right.push([t.by + " " + q.preparedBy, "normal"]);
    right.push([K.city, "normal"], [K.email, "normal"], [K.web, "normal"]);
    left.forEach(function (r, i) { font(r[1], 10, col.ink); doc.text(doc.splitTextToSize(tx(r[0]), 240)[0], M, y + 15 + i * 14); });
    right.forEach(function (r, i) { font(r[1], 10, col.ink); doc.text(tx(r[0]), M + 280, y + 15 + i * 14); });
    y = y + 15 + Math.max(left.length, right.length) * 14 + 16;

    // line items: product | qty | retail (struck through) | wholesale | total
    var X = { qty: 292, com: 382, price: 470, total: W - M };
    label(t.product, M, y);
    label(t.qty, X.qty, y, "right");
    label(t.retail, X.com, y, "right");
    label(t.wholesale, X.price, y, "right");
    label(t.lineTotal, X.total, y, "right");
    doc.setDrawColor(col.forest); doc.setLineWidth(1.5); doc.line(M, y + 7, W - M, y + 7);
    y += 7;
    c.lines.forEach(function (l) {
      var per = l.kind === "coffee" ? t.perLb : t.perU;
      var desc = doc.splitTextToSize(tx(l[q.lang] || l.en), 185);
      var price = l.price == null ? doc.splitTextToSize(tx(t.negotiable), 80) : [S.money(l.price) + " " + per];
      var rowH = Math.max(34, 20 + desc.length * 11, 18 + price.length * 11);
      var ty = y + 17;
      font("bold", 10.5, col.ink); doc.text(tx(l.name), M, ty);
      font("normal", 8.5, col.soft); doc.text(desc, M, ty + 12);
      font("normal", 10, col.ink); doc.text(S.num(l.q) + " " + (l.kind === "coffee" ? "lb" : t.u), X.qty, ty, { align: "right" });
      var com = S.money(l.commercial) + " " + per;
      font("normal", 9.5, col.soft); doc.text(com, X.com, ty, { align: "right" });
      var cw = doc.getTextWidth(com);
      doc.setDrawColor(col.soft); doc.setLineWidth(0.7); doc.line(X.com - cw, ty - 3.2, X.com, ty - 3.2);
      if (l.price == null) { font("bold", 8.5, col.terra); doc.text(price, X.price, ty, { align: "right" }); }
      else { font("bold", 10, col.forest); doc.text(price, X.price, ty, { align: "right" }); }
      if (l.total == null) { font("bold", 9, col.terra); doc.text(tx(t.tbc), X.total, ty, { align: "right" }); }
      else { font("bold", 10, col.ink); doc.text(S.money(l.total), X.total, ty, { align: "right" }); }
      y += rowH;
      doc.setDrawColor(col.line); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
    });

    // totals (right) + savings banner (left)
    y += 22;
    var bw = 250, bx = W - M - bw, rx = W - M - 10, top = y;
    function row(lbl, val, color, style) {
      font(style || "normal", 10, color || col.ink);
      doc.text(tx(lbl), bx + 10, y); doc.text(tx(val), rx, y, { align: "right" });
      y += 16;
    }
    if (!c.pending && c.savings > 0) {
      row(t.retailValue, S.money(c.commercialValue), col.soft);
      row(t.savings, "-" + S.money(c.savings) + " (" + pct(c.savingsPct) + ")", col.forest, "bold");
      doc.setFillColor("#E3EBD3"); doc.roundedRect(M, top - 13, 205, 44, 5, 5, "F");
      font("bold", 11, col.forest);
      var ban = doc.splitTextToSize(tx(t.saveBanner(S.money(c.savings), pct(c.savingsPct))), 185);
      doc.text(ban, M + 10, ban.length > 1 ? top + 5 : top + 12);
    }
    row(t.subtotal, c.pending ? t.tbc : S.money(c.total));
    row(t.shipping + " (" + c.shipLb + " lb)", S.money(c.shipping));
    y -= 6;
    doc.setFillColor(col.kraft); doc.roundedRect(bx, y, bw, 30, 4, 4, "F");
    font("bold", 12, col.forest); doc.text(tx(t.total).toUpperCase() + " (USD)", bx + 10, y + 19.5);
    font("bold", 13, col.forest); doc.text(c.pending ? tx(t.tbc) : S.money(c.grandTotal), rx, y + 19.5, { align: "right" });
    y += 56;

    // terms
    label(t.terms, M, y);
    y += 14;
    termsList(q, t).forEach(function (line) {
      var parts = doc.splitTextToSize(tx(line), W - 2 * M - 12);
      font("normal", 9.5, col.ink);
      doc.text("•", M, y);
      doc.text(parts, M + 12, y);
      y += parts.length * 12.5 + 2;
    });
    if (c.hasCoffee) {
      y += 8;
      font("italic", 8.5, col.soft);
      doc.text(doc.splitTextToSize(tx(t.origin), W - 2 * M), M, y);
    }

    // footer
    doc.setFillColor(col.forest); doc.rect(0, H - 34, W, 34, "F");
    font("normal", 8, col.kraft);
    doc.text(tx([K.company, K.legal, K.city, K.web, K.email].join("  ·  ")), W / 2, H - 14, { align: "center" });

    doc.setProperties({ title: (q.lang === "es" ? "Cotización " : "Quote ") + q.id, author: K.company, subject: q.cliente || "" });
    return doc;
  }

  function makePDF(q) {
    var doc = buildPDF(q);
    if (!doc) { S.toast("No se pudo crear el PDF. Revisa tu conexión y vuelve a abrir la app."); return null; }
    return { blob: doc.output("blob"), name: pdfName(q) };
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    S.toast("PDF descargado", "ok");
  }

  function sharePDF(q, onDone) {
    var out = makePDF(q);          // built synchronously, still inside the tap
    if (!out) return;
    var file = null;
    try { file = new File([out.blob], out.name, { type: "application/pdf" }); } catch (e) { /* old browsers */ }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: out.name.replace(/\.pdf$/, "") }).then(function () {
        S.toast("PDF enviado", "ok"); if (onDone) onDone();
      }, function (err) {
        if (err && err.name === "AbortError") return;   // user closed the menu
        downloadBlob(out.blob, out.name); if (onDone) onDone();
      });
    } else {
      downloadBlob(out.blob, out.name);                  // desktop: download the file to attach it
      if (onDone) onDone();
    }
  }

  // exposed for tests
  S.b2b = { compute: compute, quoteRow: quoteRow, quoteDoc: quoteDoc, buildPDF: buildPDF, pdfName: pdfName, loadLogo: loadLogo, HEAD: HEAD };
})();
