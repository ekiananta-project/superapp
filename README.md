FAMILY SUPERAPP v1.0.6 — STABILIZATION & UX AUDIT
==================================================

BASELINE
========
Upgrade dari v1.0.5 Smooth Loading.

TUJUAN PATCH
============
Merangkum hasil audit UX v1.0.x sebelum final regression test dan v1.1.
Backend/table lama tetap dipertahankan sebisa mungkin; istilah "Kategori"
adalah istilah user-facing, sedangkan finance_accounts tetap nama internal.

PERUBAHAN UTAMA
===============
1. LOGIN & AKUN
- "Selamat datang kembali." -> "Selamat datang."
- Error login tetap general: email/password tidak dibedakan demi keamanan.
- Lupa password + reset password melalui email.
- Pengaturan: Email Login dapat diubah dengan re-autentikasi password.
- Pengaturan: Ubah Password.
- Nomor HP/MFA belum diwajibkan; recovery tambahan tetap fitur opt-in di masa depan.

2. DAFTAR AKUN USER
- Feedback hasil pendaftaran memakai modal di tengah layar.
- State sukses, email sudah digunakan (jika provider mengembalikan status tersebut),
  serta gangguan jaringan/server.
- Validasi field tetap inline dan fokus ke field pertama yang salah.
- Tombol menjadi "Membuat akun..." selama request untuk mencegah double submit.

3. RUANG KELUARGA
- Terminologi onboarding dirapikan menjadi "ruang keluarga".
- "Buat Keluarga Baru" -> "Buat Ruang Keluarga Baru".
- "Buat Keluarga" -> "Buat Ruang Keluarga".
- Join flow juga memakai istilah "Gabung Ruang Keluarga".

4. AKUN KEUANGAN -> KATEGORI
- Judul dan copy user-facing memakai "Kategori".
- "Daftar Akun" -> "Daftar Kategori".
- Transaksi memakai label "Kategori".
- Backend tetap public.finance_accounts untuk kompatibilitas.

5. KATEGORI PARENT / CHILD
- Maksimal 2 tingkat: kategori utama -> subkategori.
- Kategori utama menampilkan "x subkategori" sebagai kontrol buka/tutup.
- Chevron kanan utama tetap untuk membuka/edit kategori.
- Child mewarisi icon + warna parent.
- Perubahan visual parent ikut diterapkan ke child aktif.
- Parent/child aman terhadap riwayat transaksi:
  * belum pernah dipakai -> dapat dihapus permanen;
  * sudah pernah dipakai -> diarsipkan agar history tetap utuh.

6. KATEGORI DEFAULT UNTUK RUANG KELUARGA BARU
Pengeluaran mencakup antara lain:
- Makan & Minum -> Makan Harian, Cemilan, Kopi / Minuman
- Transportasi -> Bensin, Parkir, Ojol / Transportasi Umum
- Belanja Harian -> Sembako, Keperluan Pribadi
- Tagihan -> Listrik, Internet, Pulsa
- Rumah Tangga -> Dapur, Kebersihan, Perlengkapan Rumah
- Kesehatan -> Obat, Dokter / Klinik
- Pendidikan -> Sekolah / Kuliah, Buku / Kursus
- Hiburan -> Nongkrong, Streaming, Game
- Cicilan -> Pinjaman, Kartu Kredit
- Lain-lain

Pemasukan:
- Gaji
- Bonus / THR
- Usaha
- Transfer Masuk
- Lain-lain

Kategori default hanya otomatis dibuat untuk Ruang Keluarga BARU setelah migration
003N aktif. Ruang keluarga lama tidak dipaksa menerima kategori default baru.

7. ICON PICKER
- Grid icon dibatasi tinggi agar halaman tidak terlalu panjang.
- Scroll berada di dalam container.
- Scrollbar native disembunyikan.
- Fade + chevron atas/bawah menunjukkan masih ada icon yang dapat digulir.

8. RUPIAH & NOMINAL
- Fokus Indonesia / Rupiah-only untuk versi ini.
- "Jumlah" -> "Nominal".
- Input uang memakai prefix Rp.
- Nominal tetap diformat 25.000 / 1.000.000 saat mengetik.
- Prefix Rp diterapkan ke nominal transaksi, biaya admin, dan saldo awal dompet.
- Multi-currency ditunda ke fitur besar terpisah.

9. KEAMANAN
- keamanan.html fokus ke sesi/perangkat.
- Penjelasan "Hapus anggota" dihapus karena pengelolaan anggota sudah berada di
  keluarga.html.

10. PERFORMANCE NAVIGASI
- Home menyiapkan cache session untuk Kategori + Dompet.
- Halaman Kategori/Dompet dapat render cache lebih dulu lalu refresh Supabase.
- Cache dibedakan per family/user dan hanya berlaku selama session browser.
- Cache wallet dihapus setelah transaksi/void/archive agar saldo lama tidak tampil.
- Tidak melakukan refactor SPA besar pada tahap ini.

11. PWA
- Cache version: family-superapp-v1.0.6.
- Service worker memakai skipWaiting + clients.claim agar build baru lebih cepat aktif.

SQL WAJIB
=========
Jalankan terlebih dahulu:
003N - Category Hierarchy & Defaults v1.sql

Migration ini menambah parent_id, RPC kategori baru, aturan hierarchy,
penghapusan/arsip kategori aman, serta seeding kategori default untuk family baru.

URUTAN DEPLOY
=============
1. Supabase -> SQL Editor.
2. Jalankan seluruh isi "003N - Category Hierarchy & Defaults v1.sql".
3. Pastikan SQL selesai tanpa error.
4. Upload/replace isi folder production ke ROOT repo GitHub Pages.
5. Tunggu GitHub Pages selesai deploy.
6. Buka website dan lakukan hard refresh sekali bila masih mendapat cache lama.
7. Tutup/buka ulang PWA.
8. Pengaturan harus menampilkan "1.0.6 PWA".

SMOKE TEST SETELAH DEPLOY
=========================
- Login salah -> pesan tetap general.
- Lupa password -> respons tidak membocorkan status email.
- Daftar akun -> hasil submit muncul sebagai modal.
- Buat Ruang Keluarga BARU -> kategori default parent/child otomatis muncul.
- Daftar Kategori -> child bisa expand tanpa mengganggu chevron edit.
- Tambah child -> icon mengikuti parent.
- Edit icon parent -> child aktif ikut mengikuti visual parent.
- Hapus parent kosong -> child ikut terhapus.
- Parent/child yang sudah dipakai transaksi -> diarsipkan, history tetap ada.
- Input nominal -> Rp + format titik ribuan.
- Buat transaksi -> Home/Dompet menampilkan saldo terbaru.
- Pengaturan -> Ubah Email / Ubah Password.
- keamanan.html -> tidak ada lagi penjelasan Hapus Anggota.
- Pindah Home -> Kategori/Dompet terasa lebih cepat setelah cache tersedia.

CATATAN
=======
Final regression test v1.0.x tetap dilakukan setelah patch ini lolos smoke test di HP.
