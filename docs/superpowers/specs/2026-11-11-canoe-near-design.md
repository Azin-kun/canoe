# CANOE — Desain MVP untuk NEAR Hackathon 2026

- **Tanggal:** 2026-11-11
- **Deadline submission:** 2026-11-14 23:59 UTC (15 Nov 06:59 WIB)
- **Tim:** 1 orang + Claude Code
- **Track:** `realworld` (utama), `open` (tambahan)
- **Status:** disetujui pengguna

## 1. Ringkasan

CANOE adalah fork dari [affromero/flight-finder](https://github.com/affromero/flight-finder) (MIT). Flight-finder sudah melacak harga penerbangan, hotel, dan sewa mobil secara terpisah. Ia juga sudah menyimpan riwayat harga, mengirim alert, dan menyediakan konfigurasi model AI dengan sistem BYOK. Namun README-nya sendiri menyatakan bahwa ketiga tracker itu tidak digabung menjadi "package, shared itinerary, or combined budget".

CANOE mengisi celah tersebut dengan **Trip Budget on-chain di NEAR**:

1. Pengguna mengunci dana NEAR dalam satu trip budget yang dibagi per kategori (flight, hotel, car).
2. Pengguna memilih penawaran dari tracker miliknya. CANOE membuat quote yang menyertakan kurs dan hash.
3. Pengguna menandatangani `pay_quote` dari wallet-nya. Kontrak memvalidasi aturan anggaran lalu mentransfer NEAR ke merchant.
4. Sisa dana bisa ditarik kembali kapan saja.

Pemesanan ke maskapai, hotel, atau rental adalah **simulasi** dan diberi label jelas. Transfer dana di testnet adalah **nyata**.

## 2. Kepatuhan aturan hackathon ([HACKATHON.md](https://nearhackathon.com/HACKATHON.md))

| Aturan | Implementasi |
|---|---|
| Repo publik sebelum deadline | Pengguna sendiri yang membuat repo publik dan melakukan push. Claude tidak melakukannya tanpa konfirmasi. |
| Q-003 / Q-005: basis yang sudah ada dan library diungkapkan | Commit upstream `266d798` diberi tag `pre-hackathon`. Pekerjaan CANOE ada di branch `canoe-near` dan diberi tag `hackathon-submission`. README menautkan diff `pre-hackathon...hackathon-submission` dan mencantumkan library. |
| Q-010 / Q-011: testnet dan kontrak sendiri | Kontrak `canoe-budget` di NEAR testnet. Tidak ada integrasi wajib. |
| Q-012: demo lokal + video | README dapat direproduksi dengan Docker. Pengguna merekam video dan memposting di X dengan tag @NEARProtocol #NEARHackathon. |
| Q-014: LICENSE | Pertahankan LICENSE MIT dari upstream dan tambahkan baris copyright CANOE. |
| Tidak ada secret di repo | Key hanya lewat environment atau keychain near-cli. `wallet testing.docx` berada di luar folder repo. Workflow gitleaks dari upstream tetap aktif. |
| README untuk juri AI | Bagian "CANOE" di bagian atas README berisi tujuan, masalah, dan langkah bernomor "do X → see Y", tanpa bahasa marketing. |
| Submit hanya sekali | Claude menampilkan payload JSON dan menunggu konfirmasi. Data pribadi seperti nama, email, dan akun mainnet diisi oleh pengguna. |

## 3. AI

AI memakai fitur bawaan flight-finder di `admin/(dashboard)/config`. Pengguna memilih provider dan model (Anthropic, OpenAI, Gemini, Claude Code / Codex CLI, Ollama, llama.cpp, vLLM), lalu memasukkan API key. CANOE tidak menambahkan pemanggilan AI baru. Pencarian hotel dan mobil tetap bisa berjalan tanpa AI melalui form terstruktur. Ekstraksi penerbangan membutuhkan model yang sudah dikonfigurasi.

## 4. Komponen

### 4.1 Kontrak `contracts/canoe-budget` (Rust, near-sdk 5.x)

**State**

```text
trips:     IterableMap<u64, Trip>
payments:  Vector<Payment>                    (append-only)
paid_hash: LookupSet<String>                  (mencegah pembayaran ganda)
next_trip_id: u64

Trip {
  id, owner: AccountId,
  limits:  { flight: U128, hotel: U128, car: U128 }   // yoctoNEAR
  spent:   { flight: U128, hotel: U128, car: U128 }
  expires_at_ms: u64,
  status: Open | Closed,
}

Payment {
  trip_id, category: Flight|Hotel|Car, amount: U128, merchant: AccountId,
  quote_hash: String, quote_ref: String, paid_at_ms: u64,
}
```

**Method**

| Method | Jenis | Aturan |
|---|---|---|
| `create_trip(limits, expires_at_ms) -> u64` | payable | `attached_deposit == flight + hotel + car`. Setiap limit ≥ 0 dan totalnya > 0. `expires_at_ms` harus di masa depan. |
| `pay_quote(trip_id, category, amount, merchant, quote_hash, quote_ref, quote_expires_at_ms)` | call | Hanya `owner`. Trip berstatus `Open` dan belum kedaluwarsa. Quote belum kedaluwarsa. `quote_hash` belum pernah dibayar. `spent[cat] + amount <= limits[cat]`. Jika lolos, catat pembayaran, kirim `Promise::transfer` ke merchant, dan emit event NEP-297 `canoe_payment`. |
| `withdraw_remaining(trip_id)` | call | Hanya `owner`. Kirim kembali `Σ(limits − spent)` dan ubah status menjadi `Closed`. |
| `get_trip(trip_id)`, `get_trips_by_owner(owner)`, `get_payments(trip_id)` | view | — |

Setiap kegagalan validasi menghasilkan `panic` dengan pesan yang jelas, misalnya `"Over category limit: flight"`. Panic membatalkan state, dan deposit tidak berpindah.

**Build dan test:** dijalankan di Docker (image Rust resmi + target `wasm32-unknown-unknown` + `cargo-near`), sehingga Rust tidak perlu dipasang di Windows. Unit test memakai `near_sdk::test_utils` dan `testing_env!`. Kasus yang diuji: bayar sukses, melebihi limit, quote kedaluwarsa, trip kedaluwarsa, hash ganda, bukan owner, withdraw, dan deposit yang tidak cocok.

**Deploy:** sub-akun `budget.canoe-dev.testnet`. Merchant demo adalah `canoe-dev.testnet`. Deploy dan penandatanganan transaksi hanya dilakukan setelah pengguna mengonfirmasi.

### 4.2 Web (`apps/web`)

| File | Fungsi |
|---|---|
| `src/lib/canoe/config.ts` | Membaca `NEXT_PUBLIC_NEAR_NETWORK`, `NEXT_PUBLIC_CANOE_CONTRACT`, dan `NEXT_PUBLIC_CANOE_MERCHANT` (dengan default testnet). |
| `src/lib/canoe/quote.ts` | Fungsi murni: membuat quote dari penawaran dan kurs, mengonversi harga fiat ke yoctoNEAR, dan menghitung sha256 dari JSON kanonik. Diuji unit. |
| `src/lib/canoe/near.ts` | Pembungkus `@hot-labs/near-connect` dan `near-api-js`: connect, sign-out, `callMethod`, `viewMethod`. |
| `src/app/api/canoe/offers/route.ts` | `GET`: daftar penawaran aktif milik pengguna. Flight diambil dari `PriceSnapshot` terendah terbaru per `Query`. Hotel dari `HotelTracker.latestPrice`. Mobil dari `CarTracker.latestPriceMinor`. Hasilnya dinormalisasi menjadi `{id, category, label, price, currency, observedAt, sourceUrl}`. Lingkup data per pengguna mengikuti aturan auth yang sudah ada. |
| `src/app/api/canoe/rate/route.ts` | `GET`: kurs NEAR terhadap mata uang yang diminta dari CoinGecko simple price, disertai timestamp dan `source`. Jika gagal, pakai `CANOE_FALLBACK_NEAR_USD` dengan `source: "fallback"`. Hasil di-cache 60 detik. |
| `src/app/trip/page.tsx` + `src/components/canoe/*` | Halaman Trip Budget. Isinya: WalletButton, TripCreateForm, TripSummary (limit, terpakai, sisa), OfferList yang menampilkan tombol "Approve & Pay" per penawaran, PaymentHistory dengan link ke `testnet.nearblocks.io`, dan tombol Withdraw. Ada banner "Booking is simulated; NEAR transfer is real (testnet)". |
| Navigasi | Link "Trip Budget" di header. |
| `messages/{en,de,es,fr,pt}` | Key string baru di kelima locale agar tes paritas i18n tetap lolos. |

### 4.3 Data demo

`scripts/canoe-seed-demo.mjs` membuat satu Query flight, satu HotelTracker, dan satu CarTracker beserta snapshot harga berlabel `sample`. Skrip ini dipakai jika scraping gagal saat demo. Label "sample" tetap terlihat di UI.

## 5. Alur data

```text
Tracker flight-finder (Prisma) ──► /api/canoe/offers ─┐
CoinGecko ──► /api/canoe/rate ────────────────────────┼─► quote.ts (amount yocto + quote_hash)
                                                      ▼
Wallet (near-connect) ── sign pay_quote ──► canoe-budget (testnet) ──► transfer NEAR ke merchant
                                                      │
                     get_trip / get_payments ◄────────┘ ──► TripSummary + PaymentHistory
```

## 6. Penanganan error

- Wallet belum terhubung: tombol aksi dinonaktifkan dan muncul ajakan untuk connect.
- Kurs memakai fallback: badge "fallback rate" tampil di quote.
- Transaksi gagal (panic kontrak): pesan panic ditampilkan apa adanya, dan state UI di-refresh dari view.
- Penawaran tanpa harga atau yang sudah kedaluwarsa tidak bisa dibayar.

## 7. Pengujian

- Kontrak: unit test di Docker (`cargo test`).
- Web: unit test Vitest untuk `quote.ts` (konversi, pembulatan ke yocto, determinisme hash) dan untuk normalisasi offers. Tes paritas i18n yang sudah ada tetap lolos.
- End-to-end manual di testnet: create trip → pay (sukses) → pay melebihi limit (ditolak) → withdraw. Hash transaksinya dicatat di README.

## 8. Di luar lingkup

Hal berikut tidak dikerjakan: integrasi merchant atau booking sungguhan, stablecoin/USDC, NEAR Intents, meta transaction, approval multi-user atau berjenjang, deploy mainnet, rebranding penuh UI flight-finder, dan hosting publik (opsional jika waktu tersisa).

## 9. Jadwal

| Hari | Target |
|---|---|
| 11–12 Nov | Flight-finder berjalan via Docker. Kontrak dan unit test. Deploy ke testnet (dengan konfirmasi). |
| 13 Nov | API offers dan rate, `quote.ts`, halaman `/trip`, wallet, alur bayar end-to-end di testnet. |
| 14 Nov | README untuk juri, tag, CI lokal. Pengguna merekam video, memposting di X, membuat repo publik, dan submit setelah konfirmasi payload. |
