# Nodemor POS — Bookshop & Stationery Point of Sale

Bilingual (සිංහල / English) POS for bookshops and stationery shops in Sri Lanka.
Offline-first: billing never stops, even when the internet or the server is down.

**Demo logins** (tap the name, type the PIN):

| Name | Role | PIN |
|---|---|---|
| Sunil Perera (Owner) | Owner — everything | 1234 |
| Nadeesha (Manager) | Manager — approves discounts, refunds, voids | 2222 |
| Kasun (Cashier) | Cashier — billing, book lists, customer orders, returns, drawer | 1111 |
| Ravi (Stock) | Stock keeper — books and items, labels, receiving, supplier returns | 3333 |

## What is in it

| Area | What it does |
|---|---|
| Billing | Scan ISBN or barcode, search by title / author / publisher / grade / subject, variants (80 or 120 pages, ruling, colour), photocopies and sheets by quantity, discounts, split payments (cash, card, LankaQR, bank, credit, voucher, points), hold bills, A4 quotation |
| School book lists | Each school's list per grade, entered once; the whole list goes on a bill in one tap, for one or more children; print with prices |
| Customer orders | Books not on the shelf: order, advance (printed slip with barcode, scanned as payment on collection), ordered → arrived → collected |
| Customers | Individuals, teachers, schools, libraries, institutions; standing discount %, credit, loyalty points, birthdays |
| Books & items | Author, publisher/brand, language, grade, subject, edition, ISBN; stationery types; services with no stock (photocopy, printing, binding, laminating); Excel/CSV import and export |
| Stock | Add stock fast, receive deliveries, returns to publishers/suppliers, stock count by scanning, adjustments, low-stock alerts, price labels |
| Business | Offers, gift vouchers, expenses, cash drawer with X/Z reports, reports by category, title, publisher, author, cashier, payment, stock value |
| Admin | Staff roles and PINs, activity log, receipt and label settings, cloud sync to your own server, folder and file backups |

---

## 1. Run it on your computer

Needs Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

## 2. Deploy the frontend to Vercel

The project root **is** the frontend, so Vercel needs no special settings.

1. Push this folder to a GitHub repository (the `server/` folder can stay, Vercel ignores it via `.vercelignore`).
2. In Vercel: **Add New → Project → Import** your repository.
3. Vercel detects **Vite** automatically. Check:
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Press **Deploy**. Your preview is live at `https://<project>.vercel.app`.

`vercel.json` already sends every page (`/app/pos`, `/login` …) to the app, so refreshing any page works,
and sets the right caching for the offline service worker.

Later you can add your own domain (e.g. `pos.yourshop.lk`) under **Project → Settings → Domains**.

## 3. Run it on your own server (recommended for the shop)

The shop's live system runs on an Ubuntu server (Hostinger VPS) with one command. The app and the API share one
address, with HTTPS, MariaDB, nightly backups and no demo data. Build the package with `npm run package:server`, then follow
**[deploy/SERVER-GUIDE.md](deploy/SERVER-GUIDE.md)**.

## 3b. Shared hosting only (no VPS)

The POS works fully without this. The server adds automatic backup and lets several counters share data.

1. **hPanel → Databases → MySQL Databases**: create a database and a user. Note the name, user, password.
2. **hPanel → Files → File Manager**: inside `public_html`, create a folder `api`.
3. Upload everything from this project's `server/` folder into `public_html/api/`
   (`bootstrap.php`, `sync.php`, `health.php`, `.htaccess`, `config.sample.php`, `schema.sql`).
4. Copy `config.sample.php` to `config.php` and fill in:
   - the database details from step 1,
   - `api_key`: a long random secret (40+ characters),
   - `allowed_origins`: your Vercel address, e.g. `https://your-project.vercel.app` (and your own domain if you add one).
5. Make sure the site has **SSL** on (hPanel → Security → SSL). The POS must reach the API over `https://`.
6. In the POS: **Settings → Cloud backup**
   - Server address: `https://yourdomain.com/api`
   - Secret key: the same `api_key`
   - Press **Test connection**, then **Back up now**.

The table is created automatically on first use (`schema.sql` is there if you prefer phpMyAdmin).
Requirements: PHP 7.4 or newer (PHP 8.x recommended), MySQL 5.7+ / MariaDB 10.3+ — standard on all Hostinger plans.

### Adding a second counter

On the new computer, open the POS, go to **Settings → Cloud backup**, enter the same server address and key,
then press **Set up this computer from the cloud**. It clears that computer and downloads the whole shop.
Then go to **Settings → This counter** and give it a different counter code (`T2`). Bill numbers start with this code, so they never clash.

## 4. Going live checklist

1. Sign in as the owner (PIN 1234).
2. **Settings → Backup & reset → Clear demo data and start fresh.** (A backup is downloaded first.)
3. Sign in again as `admin` / PIN `1234`, go to **Staff** and change the PIN. Add your staff.
4. **Settings → Shop details**: name in English and Sinhala, address, phone, upload the logo.
5. **Settings → Receipt**: paper size (80 mm / 58 mm / A4), thank-you line, return policy.
6. **Settings → Printer setup**: follow the steps and print the test page on each printer.
7. Add categories, books and items (or **Books & items → Import** from Excel/CSV), enter the school book lists, print labels.
8. Connect the cloud backup (section 3). Also download a backup file weekly.

## 5. The everyday workflow

**1. Put the stock into the system: Stock → Add stock fast**
- **Books:** click the Barcode / ISBN box and scan the back of the book, then type the title, author, price and quantity.
- **Stationery:** one row per type: name, type (80 pages), colour or ruling, price, quantity. Type the same name again for the other types; they join into one item.
- Leave **Barcode** empty and a shop barcode is made. Scanning an ISBN that already exists adds to its stock (no duplicates).
- The **icon and category are picked from the name** (English or Sinhala). Just check the category.
- Photocopy, printing, binding: add under **Books & items** and tick **Service, no stock**.

**2. Print price labels (only where needed)**
- Books with an ISBN barcode need no label. For stationery and gifts press **Print labels now** after saving.
- **Price labels** page shortcuts: **Not printed yet**, **Price changed, reprint**, **Add whole category**.

**3. Enter the school book lists: Selling → School book lists**
- One list per school and grade. Scan or search each item and type the quantity.
- Use **Copy** to make the next grade or next year from an existing list.

**4. Sell**
- Scan the ISBN or label, or type a few letters of the title or author.
- Parent with a school list: **Book list** → pick the school and grade → the whole list is on the bill.
- School, library or teacher: add them as the customer and their discount applies by itself.
- **Quotation** prints an A4 quotation of the bill without selling it.
- On payment, **stock goes down automatically** (services are not counted). Returns put stock back.

**5. Books that are not on the shelf: Selling → Customer orders**
- Take the order and an advance; the slip prints with a barcode.
- Mark **ordered**, then **arrived**, and call the customer.
- On collection, bill the book and scan the slip as **Voucher** payment; the advance comes off.

**6. Unsold books: Stock → Receive stock → Return to supplier**
- List what goes back to the publisher. Stock goes down and the amount comes off what you owe.

**Import from Excel:** Books & items → Import. Columns:
`nameEn, nameSi, category, unit, author, publisher, language, grade, subject, edition, size, color, barcode, cost, price, mrp, stock`
(`unit` is `pcs`, `copy`, `sheet` or `m`; put the ISBN in `barcode`.)

## 6. Printing — how sharpness is guaranteed

- Fonts (Atkinson Hyperlegible + Noto Sans Sinhala) are **bundled inside the app**, so Sinhala never falls back to a missing or blurry font, even offline.
- Barcodes are drawn as vector lines sized in millimetres. The default bar is **0.25 mm = exactly 2 dots on a 203-dpi thermal printer** (the industry “10 mil” standard), so edges are clean.
- Receipts set the exact page size (e.g. 80 mm × the bill's length), so the browser never shrinks them onto A4/Letter.
- Everything prints pure black, no grey.
- Verified in testing: every receipt and label size decodes with a barcode reader at 203 dpi.

In Chrome's print window: **Margins: None, Scale: 100%, Headers and footers: off.**
For printing without the dialog, start Chrome with `--kiosk-printing` (details in Settings → Printer setup).

Supported: 58/80 mm thermal printers (Xprinter, Epson TM, etc.), label printers (Xprinter XP-365B, TSC, Zebra),
A4/A5 office printers, any USB/Bluetooth barcode scanner (keyboard mode + Enter), or the phone/laptop camera.

Label stock: 38×25, 40×30, 50×25, 50×30 mm rolls, 35×55 mm tags, A4 sheets of 24, 40 or 65 labels.

## 7. Keyboard shortcuts (Billing)

| Key | Action |
|---|---|
| F2 | Search / scan |
| F4 or F12 | Pay |
| F6 | Customer |
| F7 | Hold bill |
| F8 | Held bills |
| F10 | Bill discount |
| Book list / Quotation | Buttons under the bill total |
| F9 | Go to billing from any page |
| F3 | Price check (scan any book or item) |
| F1 | Help for the current page |

## 8. How “never goes down” works

```
Counter (browser)  ──►  IndexedDB on this computer  ──►  Hostinger API (when online)
   bill instantly          saved instantly, survives          backup + shared with
                           refresh / power cut                 other counters
```

- Every sale is written to the browser's own database **before** anything else. The bill being built is also saved, so a power cut doesn't lose it.
- The app installs as a PWA (Chrome → Install) and loads with no internet.
- The browser is asked to keep the data permanently (persistent storage).
- Sync is incremental, retries automatically, and the newest version of each record wins.
- Hostinger downtime only delays the backup; the counters keep selling.

### Stock with several counters (stock ledger)

Every stock change is saved as a movement (sale, return, delivery, adjustment, count).
An item's stock is always **the sum of its movements**, recalculated after every sync, so sales made
at different counters at the same time add up correctly. Tested: two counters selling 2 and 3 of the
same item before syncing both end at 10 − 5 = 5.

### Data safety

- Upload works in verified chunks: the server must confirm every record, or the sync fails and repeats.
- Bill, return, delivery, voucher and barcode numbers can never repeat, even on a new computer or a new address.
- **Settings → Cloud backup → Check the server copy** compares every table on the PC with the server.
- Automatic backup folder (PC / USB / Google Drive folder): full backup every 2 hours and at day close, 31 days kept, plus daily and monthly Excel workbooks.
- Server: nightly SQL dump + JSON export, 35 days kept.

## 9. Customising the brand

- Shop name, logo, receipts: in the app under **Settings** (no code needed).
- Product name “Nodemor POS”: `src/components/Layout.jsx` (`Brand`), `index.html`, `vite.config.js` (PWA manifest).
- Colours: `tailwind.config.js` (`indigo` = handloom indigo, `saffron` = accent, `maroon`, `leaf`).
- Landing page text: `src/i18n/en.js` and `src/i18n/si.js` (keys starting with `land.`).
- App icon: `public/favicon.svg`.

## 10. Project structure

```
src/
  App.jsx               routes
  pages/                Landing, Login, Dashboard, POS, QuickAdd, Products, Categories, Labels, Inventory,
                        BookLists, Orders, Purchases (deliveries + returns to suppliers), Suppliers, Customers,
                        Sales, Returns, Promotions, Expenses, Shifts, Reports, Users, Settings
  components/           layout, dialogs, help panel, icon picker, barcode, camera scanner
  icons/catalog.jsx     60 book and stationery icons + name→icon recommender (English & Sinhala)
  print/templates.jsx   receipts, A4 quotations, order slips, labels, vouchers, shift reports, printer test page
  lib/                  pos logic, book lists, ISBN handling, search, scanner detection, printing, sync, backup
  db/                   IndexedDB schema (Dexie) and demo data
  i18n/                 en.js, si.js (1,100 entries each, incl. help for every page)
server/                 Hostinger PHP + MySQL sync API
```

## 11. Security notes

- Staff PINs are stored hashed (SHA-256 with a per-user salt). PINs control who does what at the counter; they are not a replacement for keeping the computer itself secure.
- The API checks a secret key on every request (constant-time comparison), uses prepared statements only, accepts only known table names, and refuses requests from websites not listed in `allowed_origins`.
- `.htaccess` blocks direct access to `config.php`.
- Always use HTTPS for the API.
