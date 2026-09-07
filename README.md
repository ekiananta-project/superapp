FAMILY SUPERAPP — ROADMAP DEVELOPMENT
=====================================

Current baseline:
v1.0.5 — Smooth Loading

Tujuan:
Mengembangkan Family Superapp secara bertahap, stabil, dan mudah diuji.
Setiap versi diselesaikan dulu sebelum lanjut ke versi berikutnya.


1. v1.0.x — STABILIZATION & POLISHING
-------------------------------------
[x] Supabase Auth
[x] Profile display_name
[x] Foto profil Supabase Storage
[x] Create / Join Family
[x] Invitation code
[x] Owner / Member
[x] Remove member
[x] Dompet / akun keuangan
[x] Pemasukan
[x] Pengeluaran
[x] Transfer antar akun + biaya admin
[x] Void transaksi
[x] Hapus akun
[x] PWA
[x] Formatting nominal 1.000.000
[x] Smooth Loading

[X] Audit seluruh halaman di HP
[X] Empty state yang konsisten
[X] Error state internet putus / lambat
[X] Loading state halaman selain Home
[ ] Final regression test sebelum naik ke v1.1


2. v1.1 — COMPLETE FAMILY MANAGEMENT
------------------------------------
NEXT PRIORITY

[ ] Transfer kepemilikan keluarga
[ ] Member bisa keluar dari keluarga
[ ] Owner tidak bisa keluar jika belum transfer ownership
[ ] Owner bisa melihat status anggota
[ ] Riwayat anggota keluar / dikeluarkan
[ ] Riwayat undangan
[ ] Cabut undangan aktif
[ ] Perbaikan role / relationship anggota bila diperlukan
[ ] Flow hapus akun owner setelah ownership dipindahkan

Rencana checkpoint:
v1.1.0 — Transfer Kepemilikan
v1.1.1 — Keluar dari Keluarga
v1.1.2 — Riwayat Anggota & Undangan
v1.1.3 — Final Family Management Polish


3. v1.2 — BUDGET & TAGIHAN
--------------------------
[ ] Budget bulanan
[ ] Budget per kategori
[ ] Progress pemakaian budget
[ ] Warning budget hampir habis
[ ] Tagihan rutin
[ ] Tanggal jatuh tempo
[ ] Status lunas / belum lunas
[ ] Transaksi berulang otomatis / semiotomatis


4. v1.3 — TARGET TABUNGAN
-------------------------
[ ] Buat target tabungan
[ ] Nominal target
[ ] Deadline
[ ] Progress tabungan
[ ] Sumber dana dari akun / dompet
[ ] Tambah / kurangi dana target
[ ] Status target tercapai
[ ] Target bersama keluarga


5. v1.4 — LAPORAN & INSIGHT
---------------------------
[ ] Grafik pemasukan vs pengeluaran
[ ] Pengeluaran per kategori
[ ] Perbandingan bulan sebelumnya
[ ] Tren cashflow
[ ] Pengeluaran terbesar
[ ] Ringkasan bulanan
[ ] Insight otomatis, contoh:
    "Pengeluaran bulan ini naik 8%."
[ ] Filter anggota keluarga


6. v1.5 — EXPORT & DATA SAFETY
------------------------------
[ ] Export Excel / CSV
[ ] Export PDF
[ ] Filter periode export
[ ] Backup data
[ ] Restore / import bila dibutuhkan
[ ] Audit log aktivitas penting
[ ] Riwayat perubahan transaksi


7. v1.6 — NOTIFICATION
---------------------
[ ] Tagihan jatuh tempo
[ ] Budget hampir habis
[ ] Target tabungan tercapai
[ ] Anggota keluarga baru
[ ] Transaksi besar
[ ] Web Push Notification
[ ] Pengaturan jenis notifikasi per user


8. v2.0 — NATIVE ANDROID
------------------------
[ ] Migrasi / wrap dengan Capacitor
[ ] APK untuk install langsung
[ ] AAB untuk Play Store
[ ] Native splash screen
[ ] Android Back handling
[ ] Deep link email confirmation
[ ] Fingerprint / biometric
[ ] Native share
[ ] Push notification Android
[ ] Update aplikasi


9. LATER / OPTIONAL
-------------------
[ ] Custom domain
[ ] Tema terang / gelap
[ ] PIN app
[ ] Multi-family
[ ] Multi-currency
[ ] Scan struk
[ ] Import rekening bank
[ ] AI financial insight
[ ] Web admin / dashboard keluarga


URUTAN KERJA YANG DISEPAKATI
============================
1. Stabilkan v1.0.5 terlebih dahulu.
2. Jangan lompat-lompat versi.
3. Selesaikan satu checkpoint lalu regression test.
4. Setelah v1.0.x stabil, lanjut ke v1.1.
5. Prioritas besar berikutnya:
   Transfer Kepemilikan + Keluar dari Keluarga.
6. Setelah Family Management matang, lanjut ke:
   Budget & Tagihan.
7. Fitur besar seperti grafik, notifikasi, dan APK dikerjakan setelah
   core aplikasi benar-benar stabil.


CATATAN
=======
- Backend yang sudah stabil sebisa mungkin tidak diubah tanpa kebutuhan.
- Setiap patch perlu bump versi dan service worker cache.
- Setiap perubahan besar sebaiknya punya checkpoint / rollback.
- Uji utama tetap dilakukan dari HP karena target utama penggunaan adalah PWA mobile.
