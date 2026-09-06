# Family Superapp

Frontend production untuk Family Superapp.

## Hosting
Build ini disiapkan untuk GitHub Pages pada repository project, dengan semua path frontend memakai path relatif sehingga aman bila dipublish dari subfolder repository.

## Backend
Data aplikasi, autentikasi, keluarga, dompet, akun, dan transaksi menggunakan Supabase. File frontend hanya memuat Supabase **publishable key**. Jangan pernah menambahkan `service_role`, `sb_secret_*`, database password, atau secret server ke repository.

## PWA
Build sudah menyertakan:
- `manifest.webmanifest`
- `sw.js`
- app icons
- Apple touch icon
- offline fallback
- service-worker registration

Setelah GitHub Pages aktif, buka aplikasi dari HP lalu gunakan menu **Install app / Add to Home Screen**.

## Supabase Auth
Setelah URL GitHub Pages sudah aktif, sesuaikan **Authentication → URL Configuration** di Supabase ke URL production tersebut.
