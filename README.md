# SUMA Internal Tools

Internal web app for the SUMA team (Lima, Arizona, Florida). The UI is in Spanish, it installs on iPhone from Safari, and there's no backend.

- **Inventario**: count stock on a phone, then tap **Copiar** and paste one row into the team's Google Sheet.
- **Traslados** (inside Inventario): whoever carries stock taps **Cargar** when loading (it becomes "En tránsito · Name") and **Entregar** at each hand-off to Ruben (Arizona), Pamela (Florida) or Manuel (Lima). The app shows what you still carry.
- **Salidas y ventas**: log sales (amount + Efectivo, Zelle or Venmo) and samples to prospects. Traslados, ventas and muestras all paste into the **Movimientos** tab.
- **Sin copiar**: any movement saved but not copied shows on the home screen until it is copied.
- **B2B Pricing**: build a wholesale quote live, then tap **Enviar PDF** to send a branded PDF through WhatsApp, Mail or Files. Tap **Copiar fila para la hoja** to paste one row into the quotes sheet. Each quote is also logged on the phone.

Each person has their own 4-digit PIN. The app greets them by name, fills in their name on inventory counts, and puts it on every quote they make. PINs are shared privately; only their hashes are stored in this repo.

## Run it locally

```bash
cd suma-internal-tools
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy on GitHub Pages

1. Create a GitHub repo, for example `suma-internal-tools`, and upload the contents of this folder (so `index.html` is at the repo root).
2. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and save.
3. After about a minute the app is live at `https://<your-user>.github.io/suma-internal-tools/`.
4. On each iPhone, open that link in **Safari**, tap **Share → Add to Home Screen**, and enter that person's PIN once.

## Where to change things

Everything lives in `js/config.js`:

| What | Where |
| --- | --- |
| Products counted in Inventario (order = column order) | `inventory` |
| Wholesale prices, 400 lb negotiable threshold, snack tiers | `b2b.coffee`, `b2b.snacks` |
| Retail (commercial) prices shown for savings: $27.99 per 250 g coffee bag, $5 per snack | `b2b.commercial` |
| Shipping: $55 for the first 25 lb, then $3.60 per extra lb | `b2b.shipping` |
| Lead time (30 business days) and quote validity (15 calendar days) | `b2b.leadTimeBusinessDays`, `b2b.validityCalendarDays` |
| Contact info on the PDF | `b2b.contact` |
| Team members, PINs and where stock handed to them is counted | `users` (`home`) |
| Payment methods for sales | `paymentMethods` |
| Retail price per inventory unit (suggested sale amount) | `inventory[].retail` |
| Links that open the Google Sheet | `inventorySheetUrl`, `movementsSheetUrl`, `quotesSheetUrl` |
| Hub tiles (add a new tool) | `tools` |

After any change, bump `version` in `config.js` and `CACHE` in `sw.js`. Phones pick up the new version the next time they open the app online.

**Add someone or change a PIN:** run `echo -n "suma-tools:1234" | shasum -a 256` (with their 4-digit PIN instead of 1234) and add `{ name: "Name", pinHash: "<result>" }` to `users`. To remove someone, delete their line; that phone asks for a PIN again next time.

## Google Sheet (SUMA_Inventario_v2.xlsx)

Tabs: **Inventario**, **Movimientos**, **Resumen**, **Cotizaciones**, **Cómo usar**. Resumen shows current stock per place (last count + movements in − movements out since that count), one row per person for stock in transit, this month's sales and samples, cash collected per payment method, and checks for text pastes and duplicate movement IDs. If you add a team member, add their "En tránsito · Name" row to Resumen too.

## Google Sheets columns

Tap **Copiar encabezados** in each tool once to paste the header row into row 1 of the sheet.

- **Inventario (16 columns):** Fecha, Nombre, Lugar, then one column per product (Cumbre 250 g Molido, 250 g Grano, 1 kg Grano; the same three for Cordillera; Cumbre and Cordillera 100 g whole-bean samples; Terra Stix, Andean Grain Chips, Choco-Granola, Berry Crisps), then Registrado. A blank cell means not counted, and 0 means none on hand.
- **Movimientos (25 columns):** ID, Fecha, Tipo (Carga, Entrega, Venta, Muestra), Desde, Hacia, Entregado a, Registrado por, the 12 products, Cliente o prospecto, Contacto, Monto (USD), Método de pago, Nota, Registrado.
- **Cotizaciones (17 columns):** Fecha, Cotización, Preparada por, Cliente, Contacto, Destino, Detalle, Café (lb), Snacks (u), Peso envío (lb), Valor comercial (USD), Ahorro (USD), Subtotal mayorista (USD), Envío (USD), Total (USD), Válida hasta, Estado.

## Pricing rules built in

- **Coffee:** $20.00/lb when the quote's total coffee is under 400 lb. At 400 lb or more, the price is negotiable. The app never makes up a number there; the user types in the price agreed with Ruben or Manuel, and until then the quote shows "Por confirmar". The quote also shows a per-shot and per-beverage reference based on a 9 g shot and an 18 g beverage.
- **Snacks:** 20-unit minimum across all snack SKUs combined. 20–49 units cost $3.75 each, and 50 or more cost $3.25 each.
- **Retail vs wholesale:** each line shows the retail price crossed out next to the wholesale price, and the totals show the buyer's savings. Coffee retail is $27.99 per 250 g bag, which is $50.78/lb; snacks are $5 each.
- **Shipping:** $55 for the first 25 lb, plus $3.60 per extra lb. Weight counts coffee pounds plus snack net weight (60 g or 80 g per bag) and is rounded up to the next pound. It applies to every quote, including 400+ lb orders.
- **Every quote:** 30 business days lead time, valid for 15 calendar days.

## Notes

- **PINs are only a soft gate.** GitHub Pages is public, and with 4 digits anyone who reads the code could work the PINs out. For that reason, landed costs and customer records are not kept in this repo.
- **Sending the PDF:** the app builds a real PDF file (about 45 KB) on the phone. **Enviar PDF** opens the iPhone share menu (WhatsApp, Mail, Messages, Save to Files). On a computer without a share menu, it downloads the file so you can attach it. Browsers can't put a PDF file on the clipboard, which is why sharing is used instead of copying.
- **PDF library:** jsPDF is bundled in `js/vendor` (MIT license), so PDFs work offline and nothing loads from other sites.
- **Coming next:** a direct save to Google Sheets through Apps Script, using the same columns as the copied rows.
