/*
 * SUMA Internal Tools — configuration
 * ------------------------------------
 * This is the ONE file to edit when products, prices or tiles change.
 * Source of truth: SUMA_Product_Catalog.xlsx and SUMA_Cost_Pricing_2.xlsx (Sept 2026).
 * Landed costs are intentionally NOT stored here: this repo is public.
 * After editing, bump `version` so phones pick up the change.
 */
window.SUMA_CONFIG = {
  version: "2.3.0",

  // One 4-digit PIN per person. Only the SHA-256 of "suma-tools:" + PIN is stored. See README.md to add someone.
  // home = the location where stock handed to this person is counted (used by "Entregar" in Traslados).
  pinLength: 4,
  users: [
    { name: "Ruben",  home: "Arizona", pinHash: "0f3c715bcab1c608fd9186412e711456cb2a1822a044c617b5a00786176df6b2" },
    { name: "Pamela", home: "Florida", pinHash: "512a152a31528f9208fed43348330ef3b77ae0771cda810ac1f2875fab8ae1f9" },
    { name: "Manuel", home: "Lima",    pinHash: "16d82d061839cf56f9911fac091707f83617a6cbdbecd461ca9f1646ca0c2372" }
  ],

  // Hub tiles. Add a tool = add one entry here + a js/<tool>.js file that registers its route.
  tools: [
    { id: "inventario", title: "Inventario", subtitle: "Conteos y traslados", route: "#/inventario", accent: "#F67633", icon: "box" },
    { id: "salidas", title: "Salidas y ventas", subtitle: "Ventas y muestras a prospectos", route: "#/salidas", accent: "#C8881A", icon: "out" },
    { id: "b2b", title: "B2B Pricing", subtitle: "Cotizaciones mayoristas en PDF", route: "#/b2b", accent: "#08839D", icon: "tag" }
  ],

  locations: ["Lima", "Arizona", "Florida"],

  // Google Sheet where inventory rows are pasted (opened from the "listo" screen).
  // Keep the sheet shared only with the team: this repo is public, so the link is visible.
  inventorySheetUrl: "https://docs.google.com/spreadsheets/d/13TDxnS9iR6hBNi4S1gopM6DOrTpyZy-owYsQtMkEpMU/edit",
  // Direct save: paste the Apps Script web app URL here (ends in /exec). Leave "" to keep copy-and-paste.
  sheetApiUrl: "https://script.google.com/macros/s/AKfycbx8_g2zjntCx_cFt1OtsV2hCapHOm-C-AxT-wRBP0O0OW6ExcVvgltIh3rg2o55zV7f/exec",

  // Same spreadsheet. Paste a tab-specific link (…#gid=123) here to open straight on the Movimientos / Cotizaciones tab.
  movementsSheetUrl: "https://docs.google.com/spreadsheets/d/13TDxnS9iR6hBNi4S1gopM6DOrTpyZy-owYsQtMkEpMU/edit",
  quotesSheetUrl: "https://docs.google.com/spreadsheets/d/13TDxnS9iR6hBNi4S1gopM6DOrTpyZy-owYsQtMkEpMU/edit",

  // Salidas y ventas: payment methods and the retail price per inventory unit (null = no set retail price, type the amount).
  paymentMethods: ["Efectivo", "Zelle", "Venmo"],

  // Inventory: counted in bags (coffee) or units (snacks). Order here = column order in the copied row.
  inventory: [
    { sku: "SUMA-005-GR",  group: "Café · Cumbre",     name: "Cumbre",     variant: "250 g · Molido",       unit: "bolsas",   header: "Cumbre 250g Molido (bolsas)",       accent: "#627940", retail: 27.99 },
    { sku: "SUMA-005-WB",  group: "Café · Cumbre",     name: "Cumbre",     variant: "250 g · Grano entero", unit: "bolsas",   header: "Cumbre 250g Grano (bolsas)",        accent: "#627940", retail: 27.99 },
    { sku: "SUMA-005-1KG", group: "Café · Cumbre",     name: "Cumbre",     variant: "1 kg · Grano entero",  unit: "bolsas",   header: "Cumbre 1kg Grano (bolsas)",         accent: "#627940", retail: null },
    { sku: "SUMA-006-GR",  group: "Café · Cordillera", name: "Cordillera", variant: "250 g · Molido",       unit: "bolsas",   header: "Cordillera 250g Molido (bolsas)",   accent: "#295128", retail: 27.99 },
    { sku: "SUMA-006-WB",  group: "Café · Cordillera", name: "Cordillera", variant: "250 g · Grano entero", unit: "bolsas",   header: "Cordillera 250g Grano (bolsas)",    accent: "#295128", retail: 27.99 },
    { sku: "SUMA-006-1KG", group: "Café · Cordillera", name: "Cordillera", variant: "1 kg · Grano entero",  unit: "bolsas",   header: "Cordillera 1kg Grano (bolsas)",     accent: "#295128", retail: null },
    { sku: "SUMA-005-S100", group: "Muestras · 100 g grano entero", name: "Cumbre",     variant: "Muestra 100 g · Grano entero", unit: "bolsas", header: "Cumbre Muestra 100g Grano (bolsas)",     accent: "#627940", retail: null },
    { sku: "SUMA-006-S100", group: "Muestras · 100 g grano entero", name: "Cordillera", variant: "Muestra 100 g · Grano entero", unit: "bolsas", header: "Cordillera Muestra 100g Grano (bolsas)", accent: "#295128", retail: null },
    { sku: "SUMA-001",     group: "Snacks",            name: "Terra Stix",         variant: "Bolsa 60 g", unit: "unidades", header: "Terra Stix (u)",         accent: "#B8441A", retail: 5.00 },
    { sku: "SUMA-002",     group: "Snacks",            name: "Andean Grain Chips", variant: "Bolsa 60 g", unit: "unidades", header: "Andean Grain Chips (u)", accent: "#C8881A", retail: 5.00 },
    { sku: "SUMA-003",     group: "Snacks",            name: "Choco-Granola",      variant: "Bolsa 80 g", unit: "unidades", header: "Choco-Granola (u)",      accent: "#F67633", retail: 5.00 },
    { sku: "SUMA-004",     group: "Snacks",            name: "Berry Crisps",       variant: "Bolsa 60 g", unit: "unidades", header: "Berry Crisps (u)",       accent: "#08839D", retail: 5.00 }
  ],

  // B2B / wholesale rules (SUMA_Cost_Pricing_2.xlsx, confirmed Sept 2026).
  b2b: {
    currency: "USD",
    leadTimeBusinessDays: 30,   // same for every tier
    validityCalendarDays: 15,
    coffee: {
      pricePerLb: 20.00,
      negotiableFromLb: 400,    // 400 lb or more (total coffee on the quote) = negotiable, never auto-priced
      doseShotG: 9,
      doseBeverageG: 18
    },
    // Commercial (retail) prices shown next to wholesale so buyers see their savings. Website prices, confirmed by Ruben Sept 2026.
    commercial: { coffeeBagPrice: 27.99, coffeeBagGrams: 250, snackUnitPrice: 5.00 },
    // Shipping: flat fee for the first 25 lb, then per extra lb. Weight = coffee lb + snack net weight, rounded up.
    shipping: { flatFee: 55.00, includedLb: 25, perExtraLb: 3.60 },
    snacks: {
      minimumUnits: 20,          // total snack units on the quote
      tiers: [                   // highest min first
        { minUnits: 50, pricePerUnit: 3.25 },
        { minUnits: 20, pricePerUnit: 3.75 }
      ]
    },
    products: [
      { id: "cumbre-wb",     kind: "coffee", name: "Cumbre",     es: "Tueste medio-oscuro · Grano entero", en: "Medium-dark roast · Whole bean", accent: "#627940" },
      { id: "cumbre-gr",     kind: "coffee", name: "Cumbre",     es: "Tueste medio-oscuro · Molido",       en: "Medium-dark roast · Ground",     accent: "#627940" },
      { id: "cordillera-wb", kind: "coffee", name: "Cordillera", es: "Tueste oscuro · Grano entero",       en: "Dark roast · Whole bean",        accent: "#295128" },
      { id: "cordillera-gr", kind: "coffee", name: "Cordillera", es: "Tueste oscuro · Molido",             en: "Dark roast · Ground",            accent: "#295128" },
      { id: "terra-stix",    kind: "snack",  name: "Terra Stix",         es: "Bolsa 60 g", en: "60 g bag", grams: 60, accent: "#B8441A" },
      { id: "grain-chips",   kind: "snack",  name: "Andean Grain Chips", es: "Bolsa 60 g", en: "60 g bag", grams: 60, accent: "#C8881A" },
      { id: "choco-granola", kind: "snack",  name: "Choco-Granola",      es: "Bolsa 80 g", en: "80 g bag", grams: 80, accent: "#F67633" },
      { id: "berry-crisps",  kind: "snack",  name: "Berry Crisps",       es: "Bolsa 60 g", en: "60 g bag", grams: 60, accent: "#08839D" }
    ],
    contact: {
      company: "SUMA Organics",
      legal: "Suma LLC",
      city: "Chandler, AZ",
      web: "sumaorganics.com",
      email: "ruben.david.gv@gmail.com"
    }
  }
};
