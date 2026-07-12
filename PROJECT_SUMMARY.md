# Ringkasan Perkembangan Sistem Sales Intelligence Platform

## 1. Sistem Bonus Salesman (3 Jenis)

Sistem menghitung **3 jenis bonus** secara otomatis berdasarkan peraturan perusahaan:

| Jenis Bonus | Cara Kerja |
|---|---|
| **Percentage Based** | Berdasarkan level salesman (L2/L3) dan persen pencapaian target BE. Contoh: L2 capai 100% target → bonus 1 juta |
| **Volume Based** | Berdasarkan tier BE yang dicapai (1500 BE, 2500 BE, 3500 BE) masing-masing punya bonus tetap |
| **Active Outlets** | Berdasarkan persen outlet yang aktif bertransaksi dalam bulan ini. Makin banyak outlet aktif, makin besar bonus |

Setiap salesman bisa melihat **perkiraan bonus total** dan **detail masing-masing bonus** langsung di handphone-nya.

---

## 2. Level Salesman & Wilayah

- Setiap salesman punya **Level L2 atau L3** (menentukan besar bonus dasar dan target BE)
- Setiap salesman dan supervisor punya **Wilayah/Region**
- Supervisor hanya bisa melihat tim di wilayahnya sendiri

---

## 3. Outlet: Area, Assignment & Vacant

- Setiap outlet punya kolom **Branch Area** (contoh: Jakarta Selatan, Jakarta Pusat)
- Supervisor/Admin bisa **tugaskan outlet ke salesman** (assignment)
- Outlet bisa **Vacant** (tidak punya salesman) → Supervisor harus menanganinya
- Ada **history assignment** (bisa tracking perubahan penugasan outlet)

---

## 4. Target & Konfigurasi Bonus per Salesman

Supervisor bisa:
- Mengatur **target BE bulanan** untuk setiap salesman
- Melihat dan mengatur **aturan bonus** per salesman per bulan
- Sistem otomatis mengisi default bonus sesuai level L2/L3 (bisa diubah manual)

---

## 5. Dashboard Salesman (Tampilan Handphone)

Salesman bisa melihat:

- **Gauge Pencapaian Target** (attainment %) — lingkaran besar menunjukkan sudah berapa persen target tercapai
- **Total Bonus Summary** — jumlah perkiraan bonus dari semua 3 jenis
- **3 Detail Bonus** (Percentage, Volume, Active Outlets) masing-masing dengan progress bar dan tier
- **Simulasi "What-If"** — geser slider BE untuk melihat proyeksi bonus kalau penjualan naik atau turun
- **Kebutuhan Harian** — sistem menghitung rata-rata BE yang harus dicapai per hari untuk mengejar target (berdasarkan sisa hari kalender dalam bulan ini)
- **Analisa Produk** dengan detail lengkap:
  - Ranking produk berdasarkan volume BE
  - Tren vs bulan lalu (MoM) dan vs tahun lalu (YoY)
  - Jumlah transaksi per produk
  - Rata-rata order size (BE per transaksi)
  - Outlet terbesar per produk
  - Persentase kontribusi (mix %)
- **Pull-to-Refresh** — tarik layar ke bawah untuk refresh data terbaru

---

## 6. Dashboard Supervisor (Tampilan Handphone)

Supervisor bisa melihat:

- **Team Performance Ranking** — tim diurutkan berdasarkan pencapaian attainment
- **Total Bonus** yang sudah didapat setiap anggota tim
- **Jumlah Outlet Vacant** (yang belum ditangani) dengan peringatan
- **Panel Atur Target & Bonus** — pilih salesman, set target BE, simpan konfigurasi bonus

---

## 7. Upload Data Invoice (Admin Panel)

Admin bisa mengunggah data penjualan dari file Excel/CSV:

- **Support format CSV dan XLSX**
- **Preview sebelum import** — sistem validasi setiap baris (outlet ada, salesman ada, tanggal valid, BE angka). Kalau ada data invalid, admin bisa lihat error per baris sebelum benar-benar di-import
- **Template Download** (CSV & XLSX) — tersedia file contoh siap pakai dengan data dummy yang valid

---

## 8. PWA (Progressive Web App)

Aplikasi berjalan sebagai PWA di handphone:

- **Tombol Install App** — muncul di pojok kanan bawah, user bisa install ke home screen
- **Panduan iOS** — kalau pakai iPhone/Safari, muncul modal panduan step-by-step install (Share → Add to Home Screen)
- **Auto-Update** — saat ada update aplikasi, handphone otomatis refresh ke versi terbaru tanpa user harus uninstall/reinstall
- **Pull-to-Refresh** — tarik layar ke bawah untuk reload halaman

---

## 9. OHS — Outlet Health Score (Kesehatan Outlet)

Sistem memberi skor kesehatan tiap outlet berdasarkan kapan terakhir transaksi:

| Skor | Warna | Arti |
|---|---|---|
| 80 – 100 | 🟢 Hijau | Sangat Aktif — transaksi dalam 7 hari terakhir |
| 50 – 79 | 🟡 Kuning | Perlu Perhatian — transaksi 7-25 hari lalu |
| 0 – 49 | 🔴 Merah | Berisiko Churn — transaksi > 25 hari lalu |

Ada **tombol Info (ⓘ)** yang menjelaskan rumus dan arti warna OHS.

---

## 10. Perbaikan & Keamanan

- Password tidak lagi tertulis hardcoded di kode → aman untuk deploy
- Menu Admin (tab bar) sudah responsive dan tidak keluar layar di handphone
- Perhitungan sisa hari dan tanggal diperbaiki (menghindari tanggal tidak valid seperti 31 April)
- Upload data lebih stabil dengan validasi dan error handling yang jelas

---

> **Catatan teknis:** Semua fitur di atas sudah terintegrasi dengan database PostgreSQL dan backend Go (Echo). Data salesman, outlet, assignment, dan target bonus disimpan secara live.
