# CANOE: Trip Budget yang ramah untuk user awam (USD) — Desain

Tanggal: 2026-11-12. Status: disetujui di chat, menunggu review spec.

## 1. Tujuan

User yang belum pernah memakai wallet kripto harus bisa memahami dan menyelesaikan alur Trip Budget
(sambung wallet → atur budget → bayar booking → ambil sisa) tanpa tahu istilah web3. Semua harga yang
dilihat user, termasuk hasil scraping flight, hotel dan mobil, memakai **USD**.

Bukan tujuan: mengubah kontrak, mengubah API `/api/canoe/*` di luar konversi USD, menambah locale baru,
login email/sosial, atau mengubah halaman Flights/Hotels/Cars selain mata uang default scraping.

## 2. Keputusan yang sudah diambil

| Topik | Keputusan |
|---|---|
| Bahasa | Inggris sederhana (juri membaca Inggris; app belum punya locale `id`). |
| Bentuk halaman | Tiga langkah bernomor yang terlihat sekaligus (bukan wizard per layar). |
| Mata uang | USD untuk budget, harga penawaran, sample, dan default scraping. |
| Wallet | Kotak panduan "New to wallets?" + sembunyikan wallet developer secara default. |

## 3. Struktur halaman `/trip`

Urutan dari atas: hero (tetap), catatan demo singkat, lalu tiga langkah.

1. **Step 1 · Connect your wallet**
   - Belum tersambung: tombol utama "Connect wallet" dan kotak **New to wallets?** (lihat §6).
   - Tersambung: "Connected as `canoe-user1.testnet`" + tombol "Disconnect". Status: selesai (✓).
2. **Step 2 · Set your trip budget**
   - Belum ada trip terbuka: form budget dalam USD (§4).
   - Ada trip terbuka: kartu "Your trip budget" dengan bar progres per kategori, "Spent $X · Left $Y (Z NEAR)",
     tanggal berakhir, dan tombol "End trip & return unused money". Status: selesai (✓).
   - Terkunci sampai Step 1 selesai, dengan alasan "Connect a wallet first".
3. **Step 3 · Pay for your bookings**
   - Daftar penawaran dalam USD (§5) dan riwayat pembayaran ("Your payments").
   - Terkunci sampai ada trip terbuka, dengan alasan "Set your trip budget first".
   - Lipatan `<details>` "What happens when I pay?" berisi tiga kalimat: wallet meminta persetujuan; aturan
     budget dicek oleh kontrak, bukan oleh situs; uang hanya pindah kalau masih di dalam budget.

Setiap langkah punya status `done | active | locked`. Langkah aktif disorot (border aksen), langkah terkunci
diredupkan dan menampilkan alasannya. Trip yang sudah ditutup tidak dianggap trip aktif: Step 2 kembali ke
form, dan trip terakhir yang ditutup ditampilkan ringkas di bawah form ("Last trip ended · $X returned").

Catatan demo menggantikan banner sekarang: "Demo mode: this uses free NEAR test tokens with no real value.
Bookings are simulated. Payments are 1% of the real price so test balances last."

## 4. Budget dalam USD

- Field: "Flights", "Hotels", "Car rental" dengan awalan `$`, plus "Trip length (days)". Default $100 / $100 /
  $50 / 30 hari.
- Konversi saat submit: `limitYocto = applyScale(fiatToYocto(usd, nearPriceUsd), CANOE_DEMO_SCALE_BPS)`
  memakai kurs live dari `/api/canoe/rate?currency=USD`. Kontrak tetap menerima NEAR.
- Ringkasan di bawah form sebelum submit: "You'll set aside **0.97 NEAR** from your wallet (demo price for
  $250). Unused money comes back when you end the trip." Tombol: "Set aside 0.97 NEAR".
- Kalau kurs belum tersedia: tombol nonaktif dengan teks "Loading price…"; kalau kurs gagal: pesan
  "Can't load the NEAR price right now. Try again in a minute."
- Tampilan sisa/terpakai: `yoctoToFiat(yocto, nearPriceUsd, scaleBps)` = nilai USD sebelum skala demo,
  dibulatkan ke dolar ("≈ $5"), dengan NEAR di sebelahnya.

## 5. Penawaran dalam USD

- `sampleOffers()` berganti ke USD: flight CGK → DPS **$95**, Bali beach hotel 3 nights **$85**, Ngurah Rai
  economy car 3 days **$45**. Label tetap diawali "Sample · ".
- Penawaran hasil scraping dengan mata uang selain USD dikonversi sebelum ditampilkan:
  `usd = price / nearPrice[currency] * nearPrice[USD]` (kurs NEAR dari CoinGecko untuk kedua mata uang).
  Offer hasil konversi membawa `original: { price, currency }` dan menampilkan "converted from IDR 1,500,000".
- Quote dibangun dari offer yang sudah dalam USD, sehingga `quoteHash` memuat `fiatAmount` USD dan
  `currency: "USD"`.
- Tombol: "Pay $95 · 0.38 NEAR". Kalau melebihi sisa budget kategori, tombol tetap aktif (untuk demo
  penolakan on-chain) dengan catatan "More than what's left in your Flights budget — the contract will refuse it."

## 6. Bantuan wallet

- Kotak **New to wallets?** (Step 1), tiga langkah bernomor:
  1. "Create a free Meteor Wallet" → link ke Meteor Wallet (buka tab baru).
  2. "Get free test NEAR" → link ke faucet testnet.
  3. "Come back and tap Connect wallet."
  URL faucet dan Meteor dipastikan valid saat implementasi; kalau Meteor punya faucet bawaan, langkah 2 merujuk ke sana.
- Wallet developer disembunyikan dengan opsi `excludedWallets` di `NearConnector`: **NEAR CLI** dan
  **Ethereum Wallets** (id persis diambil dari manifest near-connect saat implementasi).
- `NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true` memunculkan kembali keduanya (untuk demo developer dan uji CLI).

## 7. Status dan pesan yang ramah

Teks proses:

| Sekarang | Jadi |
|---|---|
| Waiting for wallet… | Check your wallet window and tap Approve. |
| View transaction | View receipt |
| Withdraw remaining NEAR | End trip & return unused money |
| Trip #1 | Your trip budget |

Pemetaan error (`friendlyError(message)` → kunci i18n + parameter), berdasarkan pesan panic kontrak:

| Pesan asli | Pesan ke user |
|---|---|
| `Over category limit: <cat>` | This costs more than what's left in your <Category> budget. Nothing was paid. |
| `Quote expired` | This price expired. Tap Pay again to get a fresh price. |
| `Trip expired` | This trip budget has ended. Return the unused money and set a new budget. |
| `Trip is closed` | This trip budget is already closed. |
| `Quote already paid` | You already paid for this offer. |
| `Only the trip owner can do this` | Only the wallet that created this budget can use it. |
| `Attached deposit must equal the sum of limits`, `Budget must be greater than zero`, `Expiry must be in the future` | Your budget couldn't be saved. Check the amounts and try again. |
| Wallet dibatalkan (pesan mengandung `reject`, `cancel`, `denied`, atau `closed`) | You cancelled in your wallet. Nothing was paid. |
| Lainnya | Something went wrong. Nothing was paid. (Details: <pesan asli>) |

Error transaksi yang gagal on-chain tetap menampilkan link "View receipt" (sudah ada `TxFailedError`).

## 8. Default mata uang scraping = USD

- Hotels (`lib/hotels/domain.ts`) dan Cars (`app/cars/page.tsx`) sudah jatuh ke `USD`.
- Flights jatuh ke `null` (Google menebak dari IP). Ubah fallback menjadi `'USD'` di
  `lib/scraper/run-scrape.ts:642` dan `lib/preview-runner.ts:614`, dengan tetap menghormati mata uang
  query, user, dan instance kalau diisi. Opsi kosong di Settings dilabeli "USD (default)" alih-alih auto.
- Tes yang ada untuk perilaku "auto-detect" disesuaikan.

## 9. Komponen dan file

| Unit | Tanggung jawab |
|---|---|
| `lib/canoe/money.ts` (baru) | `usdToYocto`, `yoctoToUsd`, `toUsdOffer(offer, rates)`, `formatUsd`. Murni, dites. |
| `lib/canoe/errors.ts` (baru) | `friendlyError(message)` → `{ key, values }`. Murni, dites. |
| `components/canoe/Step.tsx` (baru) | Kerangka langkah: nomor, judul, status, alasan terkunci. |
| `components/canoe/WalletHelp.tsx` (baru) | Kotak "New to wallets?". |
| `components/canoe/TripBudget.tsx` | Orkestrasi 3 langkah, kurs USD, pesan ramah. |
| `components/canoe/TripCreateForm.tsx` | Input USD + ringkasan NEAR. |
| `components/canoe/OfferList.tsx`, `PaymentHistory.tsx` | Harga USD, teks baru. |
| `components/canoe/NearProvider.tsx` | `excludedWallets` + flag developer. |
| `lib/canoe/offers.ts` | Sample offers USD. |
| `messages/*/canoe.json` | Kunci baru/ubah, identik di semua locale (tes paritas). |
| `lib/scraper/run-scrape.ts`, `lib/preview-runner.ts`, Settings | Fallback USD. |

Semua styling tetap CSS Modules dengan token tema Nusa; tanpa `any`, TypeScript strict.

## 10. Pengujian

- Unit: `money.test.ts` (konversi dua arah, pembulatan, konversi IDR→USD), `errors.test.ts` (setiap baris
  tabel §7), `offers.test.ts` (sample USD), tes fallback USD untuk scraping flight.
- `messages-parity.test.ts` tetap lulus.
- Browser: alur lengkap di lebar desktop dan ponsel (375 px) — langkah terkunci/aktif/selesai, ringkasan
  NEAR, pesan error ramah (dengan trip berlimit kecil), dan daftar wallet tanpa NEAR CLI.
- Typecheck, lint, dan suite tes web lulus sebelum commit.

## 11. Dampak ke dokumen lain

- README "Try it": langkah 6–9 memakai angka USD; sebut flag `NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS`.
- Spec MVP (`2026-11-11-canoe-near-design.md`) §4.3 menyebut sample IDR; tambahkan catatan bahwa spec ini
  menggantikannya.
