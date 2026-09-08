FAMILY SUPERAPP — MASTER DEVELOPMENT ROADMAP
=============================================

CURRENT BASELINE 
----------------
v1.0.6 — Finance Core Stabilization Complete

VISI PRODUK 
-----------
Family Superapp adalah platform keluarga modular.

Satu akun Family Superapp dapat menggunakan berbagai modul:
- Keuangan
- Catatan
- Kalender
- Reminder / Notification
- Secure Password Vault
- Modul keluarga lain di masa depan

Ruang Keluarga adalah bagian dari CORE Family Superapp,
bukan bagian khusus dari modul Keuangan.

Keuangan adalah modul pertama dan akan dimatangkan terlebih dahulu
sebelum modul besar lain mulai dikembangkan.

PRINSIP UTAMA
--------------
1. Satu modul matang lebih baik daripada banyak modul penuh bug.
2. Keuangan tetap menjadi fokus utama sampai dinyatakan mature.
3. Family Core dibuat reusable untuk seluruh modul.
4. Data pribadi tidak otomatis dapat dilihat oleh Owner keluarga.
5. Setiap modul tetap dipisahkan secara arsitektur.
6. Backend stabil tidak dirombak tanpa kebutuhan nyata.
7. Setiap checkpoint harus melewati regression test.
8. Mobile/PWA tetap menjadi target pengujian utama.


============================================================
PHASE 1 — FOUNDATION + FINANCE MODULE
============================================================


1. v1.0.x — FOUNDATION & STABILIZATION
--------------------------------------

[x] Supabase Auth
[x] Profile display_name
[x] Foto profil Supabase Storage

[x] Create / Join Ruang Keluarga
[x] Invitation code
[x] Owner / Member
[x] Remove member

[x] Dompet
[x] Kategori keuangan
[x] Parent / child kategori
[x] Pemasukan
[x] Pengeluaran
[x] Transfer antar dompet + biaya admin
[x] Void transaksi
[x] Hapus akun

[x] Formatting nominal Rupiah
[x] Smooth Loading
[x] Cache / prefetch data stabil
[x] PWA

[x] Audit seluruh halaman di HP
[x] Empty state konsisten
[x] Error state internet putus / lambat
[x] Loading state halaman
[x] Final regression test

STATUS:
v1.0.x COMPLETE


-------------------------------------------------
2. v1.1 — FAMILY CORE & MEMBERSHIP LIFECYCLE
-------------------------------------------------

Tujuan:
Menyelesaikan lifecycle Ruang Keluarga sebagai fondasi
yang nantinya digunakan Keuangan, Catatan, Kalender,
dan modul Family Superapp lainnya.

[X] Transfer kepemilikan Ruang Keluarga

[X] Anggota dapat keluar dari Ruang Keluarga

[X] Owner tidak dapat keluar selama masih menjadi Owner

[X] Owner yang ingin keluar harus:
    - transfer kepemilikan; atau
    - membubarkan Ruang Keluarga

[ ] Bubarkan Ruang Keluarga
    - hanya Owner
    - mengeluarkan seluruh anggota
    - mencabut seluruh invitation
    - menghapus data FAMILY-OWNED
    - tidak menghapus akun pribadi anggota
    - tidak menghapus data PERSONAL anggota

[ ] Owner dapat melihat status anggota

[ ] Status membership yang jelas:
    - active
    - left
    - removed

[ ] Riwayat anggota:
    - bergabung
    - keluar sendiri
    - dikeluarkan

[ ] Riwayat invitation

[ ] Cabut invitation aktif

[ ] Role / relationship anggota bila diperlukan

[ ] Flow hapus akun Owner setelah ownership dipindahkan


FAMILY CORE — DATA OWNERSHIP RULE
---------------------------------

Mulai versi ini kita menetapkan tiga jenis ownership:

1. PERSONAL
   Data hanya dimiliki user.

2. PERSONAL + SHARED
   Data tetap milik user tetapi dapat dibagikan
   kepada anggota tertentu.

3. FAMILY-OWNED
   Data benar-benar dimiliki Ruang Keluarga.

Owner Ruang Keluarga TIDAK otomatis mendapat akses
ke data PERSONAL anggota.


Checkpoint:
v1.1.0 — Transfer Ownership
v1.1.1 — Leave Family
v1.1.2 — Dissolve Family
v1.1.3 — Member & Invitation History
v1.1.4 — Family Core Final Polish


============================================================
FINANCE MODULE MATURITY
============================================================


3. v1.2 — BUDGET & TAGIHAN
---------------------------

[ ] Budget bulanan

[ ] Budget per kategori

[ ] Progress penggunaan budget

[ ] Warning budget hampir habis

[ ] Budget terlampaui

[ ] Tagihan rutin

[ ] Nominal tagihan

[ ] Tanggal jatuh tempo

[ ] Status:
    - belum lunas
    - lunas

[ ] Hubungkan pembayaran tagihan dengan transaksi

[ ] Transaksi berulang:
    - otomatis jika aman
    - semiotomatis / konfirmasi jika diperlukan


Checkpoint:
v1.2.0 — Budget
v1.2.1 — Tagihan
v1.2.2 — Recurring Transaction
v1.2.3 — Finance Regression Test


--------------------------------
4. v1.3 — TARGET & PERENCANAAN
--------------------------------

[ ] Buat target tabungan

[ ] Nominal target

[ ] Deadline

[ ] Progress tabungan

[ ] Hubungkan target dengan Dompet

[ ] Tambah dana target

[ ] Kurangi dana target

[ ] Status target tercapai

[ ] Target keluarga

[ ] Target personal jika nantinya diperlukan

[ ] Riwayat perubahan target


Checkpoint:
v1.3.0 — Savings Goal
v1.3.1 — Family Goal
v1.3.2 — Final Polish


------------------------------
5. v1.4 — LAPORAN & INSIGHT
------------------------------

[ ] Dashboard laporan

[ ] Pemasukan vs pengeluaran

[ ] Pengeluaran per kategori

[ ] Subkategori

[ ] Perbandingan bulan sebelumnya

[ ] Tren cashflow

[ ] Pengeluaran terbesar

[ ] Ringkasan bulanan

[ ] Filter:
    - periode
    - kategori
    - dompet
    - anggota

[ ] Insight otomatis berbasis data

Contoh:
    "Pengeluaran bulan ini naik 8%."

    "Pengeluaran Makan & Minum merupakan
     kategori terbesar bulan ini."

[ ] Insight tetap bersifat informatif
    dan tidak mengambil keputusan finansial pengguna


------------------------------------
6. v1.5 — FINANCE DATA & AUDIT
------------------------------------

[ ] Export Excel

[ ] Export CSV

[ ] Export PDF

[ ] Filter periode export

[ ] Audit log aktivitas penting

[ ] Riwayat perubahan transaksi

[ ] Riwayat void transaksi

[ ] Riwayat perubahan Dompet

[ ] Riwayat perubahan Kategori

[ ] Strategi backup data

[ ] Strategi recovery data jika diperlukan

[ ] Validasi integritas data Finance


-----------------------------------------
7. v1.6 — NOTIFICATION CORE + FINANCE
-----------------------------------------

Tujuan:
Membangun notification engine reusable untuk Family Superapp,
tetapi penggunaan pertamanya hanya untuk modul Keuangan.

CORE:

[ ] Notification Center

[ ] Status:
    - unread
    - read

[ ] Pengaturan notifikasi per user

[ ] In-app notification

[ ] Web Push Notification

[ ] Permission notification browser / PWA


FINANCE:

[ ] Tagihan jatuh tempo

[ ] Budget hampir habis

[ ] Budget terlampaui

[ ] Target tabungan tercapai

[ ] Transaksi besar

[ ] Aktivitas Finance penting dari anggota keluarga


Catatan:
Notification Core nantinya digunakan ulang oleh
Kalender, Catatan, Family Management, dan modul lainnya.


---------------------------------------
8. v1.7 — FINANCE MODULE MATURITY
---------------------------------------

FINAL FINANCE MILESTONE

[ ] Audit seluruh fitur Finance

[ ] Audit permission Owner / Member

[ ] Audit data family-owned

[ ] Audit transaksi & saldo

[ ] Audit Budget

[ ] Audit Tagihan

[ ] Audit Target

[ ] Audit Laporan

[ ] Audit Export

[ ] Audit Notification

[ ] Performance test data besar

[ ] Offline / network error regression

[ ] Mobile regression

[ ] PWA regression

[ ] Security regression

[ ] Database integrity check

[ ] Final UX polishing


MILESTONE:
FINANCE MODULE — MATURE / PRODUCTION READY


============================================================
PHASE 2 — FAMILY SUPERAPP EXPANSION
============================================================


9. v2.0 — SUPERAPP CORE & MODULE SHELL
--------------------------------------

Tujuan:
Mengubah pengalaman aplikasi dari
"Family Superapp yang berisi Keuangan"
menjadi platform multi-module.

[ ] Module launcher / Home Superapp

[ ] Modul Keuangan

[ ] Struktur navigasi multi-module

[ ] Shared Family Core

[ ] Shared Profile

[ ] Shared Notification Center

[ ] Shared permission foundation

[ ] Standar visibility:

    - Hanya Saya
    - Anggota Tertentu
    - Semua Anggota Keluarga

[ ] Standar permission:

    - View
    - Edit
    - Owner

[ ] Module-specific RLS tetap terpisah


Catatan:
Tidak perlu mengerjakan ini sebelum modul kedua benar-benar
akan mulai dibuat.


--------------------------
10. v2.1 — NOTES
--------------------------

[ ] Catatan pribadi

[ ] Folder / kategori catatan

[ ] Search

[ ] Pin / favorite

[ ] Hanya saya

[ ] Share dengan anggota tertentu

[ ] Share ke semua anggota keluarga

[ ] Permission:
    - View
    - Edit

[ ] Catatan family-owned

[ ] Riwayat perubahan bila diperlukan

[ ] Notification perubahan catatan bersama


-----------------------------
11. v2.2 — FAMILY CALENDAR
-----------------------------

[ ] Kalender pribadi

[ ] Kalender keluarga

[ ] Buat event

[ ] Event personal

[ ] Event untuk anggota tertentu

[ ] Event untuk seluruh keluarga

[ ] Visibility event

[ ] Pilih siapa yang mendapat reminder

[ ] Reminder:
    - beberapa menit sebelumnya
    - beberapa jam sebelumnya
    - beberapa hari sebelumnya

[ ] Recurring event

[ ] Hari penting keluarga

[ ] Notification integration

[ ] Tampilan:
    - bulan
    - agenda
    - upcoming


Catatan:
Visibility dan siapa yang mendapat reminder
adalah dua hal yang berbeda.


-----------------------------------
12. v2.3 — NOTIFICATION EXPANSION
-----------------------------------

[ ] Notification dari Calendar

[ ] Notification dari Notes

[ ] Notification dari Family Core

[ ] Notification preferences per modul

[ ] Notification preferences per event

[ ] Scheduled reminder

[ ] Push notification

[ ] Notification history


============================================================
PHASE 3 — NATIVE PLATFORM & SECURITY
============================================================


13. v3.0 — NATIVE ANDROID
--------------------------

[ ] Capacitor

[ ] APK

[ ] AAB / Play Store

[ ] Native splash screen

[ ] Android Back handling

[ ] Deep link

[ ] Native share

[ ] Native Push Notification

[ ] Background notification

[ ] Biometric authentication

[ ] Secure device storage

[ ] App update strategy


------------------------------------
14. v3.1 — SECURE PASSWORD VAULT
------------------------------------

SECURITY-CRITICAL MODULE

[ ] Vault pribadi

[ ] Credential:
    - Website / App
    - Username
    - Password
    - Notes
    - URL

[ ] Search credential

[ ] Password generator

[ ] Copy username

[ ] Copy password

[ ] Auto clear clipboard

[ ] Vault lock

[ ] Master Password / PIN

[ ] Biometric unlock

[ ] Client-side encryption

[ ] Encryption key tidak disimpan sebagai plaintext

[ ] Server hanya menyimpan ciphertext

[ ] Auto-lock

[ ] Session timeout

[ ] Security audit

[ ] Recovery strategy

[ ] Sharing credential hanya secara eksplisit

[ ] Credential pribadi TIDAK otomatis dapat dilihat Owner

[ ] Shared family credential bila keamanan sudah matang


RULE:
Secure Vault tidak boleh dikerjakan dengan standar keamanan
yang sama seperti data Finance biasa.

Security architecture harus direview secara khusus
sebelum implementasi.


============================================================
LATER / OPTIONAL
============================================================

[ ] Custom domain

[ ] Tema terang / gelap

[ ] Multi-family

[ ] Multi-currency

[ ] Scan struk

[ ] Import rekening bank

[ ] Integrasi rekening / bank bila memungkinkan

[ ] AI Financial Insight

[ ] AI Notes

[ ] Shared Shopping List

[ ] Family Tasks / To-do

[ ] Family Documents

[ ] Family Emergency Information

[ ] Web Admin / Family Dashboard

[ ] iOS native bila diperlukan


============================================================
URUTAN KERJA YANG DISEPAKATI
============================================================

1. v1.0.x sudah selesai dan menjadi baseline stabil.

2. Mulai v1.1, Ruang Keluarga diperlakukan sebagai
   FAMILY CORE, bukan bagian dari Finance.

3. Selesaikan lifecycle Family Core terlebih dahulu.

4. Setelah Family Core selesai, kembali fokus penuh
   mematangkan modul Keuangan.

5. Jangan mulai Notes / Calendar hanya karena
   arsitekturnya sudah memungkinkan.

6. Budget, Tagihan, Target, Laporan, Export,
   Audit dan Notification Finance diselesaikan dahulu.

7. Setelah Finance mencapai milestone
   FINANCE MODULE MATURE,
   baru Family Superapp masuk fase multi-module.

8. Notes menjadi kandidat modul kedua.

9. Calendar menjadi modul berikutnya.

10. Notification engine digunakan bersama seluruh modul.

11. Native Android dilakukan setelah fondasi web/PWA
    dan module architecture matang.

12. Secure Password Vault dikerjakan belakangan
    karena membutuhkan standar keamanan khusus.

13. Setiap checkpoint:
    implementasi
        ↓
    test
        ↓
    regression
        ↓
    bump version
        ↓
    deploy

14. Jangan lompat-lompat versi.


============================================================
ARSITEKTUR YANG HARUS DIJAGA
============================================================

CORE
----
profiles
families
family_memberships
family_invitations
family permissions
notifications


FINANCE
-------
finance_wallets
finance_accounts / categories
finance_transactions
finance_budget_*
finance_bill_*
finance_goal_*


NOTES
-----
notes_*
note_permissions / sharing


CALENDAR
--------
calendar_*
calendar_reminders_*


VAULT
-----
vault_*

Dengan prinsip:

CORE dapat dipakai semua modul.

Tetapi data setiap modul tidak dicampur
menjadi satu struktur database besar.
