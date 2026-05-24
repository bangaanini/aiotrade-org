# Konfigurasi Upload 25 MB di Hostinger

## Masalah
Error: `Failed to parse body as FormData` dengan pesan `expected boundary after body`

Ini terjadi karena reverse proxy atau Node.js server di Hostinger membatasi body size.

## Solusi

### 1. Konfigurasi Nginx (jika Hostinger pakai Nginx)

Tambahkan di konfigurasi Nginx Hostinger:

```nginx
client_max_body_size 25M;
```

**Cara setting di Hostinger:**
- Login ke hPanel Hostinger
- Masuk ke menu "Advanced" → "Nginx Configuration" (jika tersedia)
- Atau hubungi support Hostinger untuk menambahkan directive ini

### 2. Konfigurasi Node.js

Pastikan environment variable sudah benar di Hostinger:

```bash
NODE_OPTIONS="--max-http-header-size=25000000"
```

### 3. Alternative: Upload Langsung ke R2 (Recommended)

Karena limitasi hosting, lebih baik upload langsung dari browser ke R2:

1. Server generate presigned URL
2. Client upload langsung ke R2 menggunakan presigned URL
3. Tidak melalui Next.js API route

Ini akan bypass semua limitasi server dan lebih cepat.

## Langkah Berikutnya

Pilih salah satu:

**A. Hubungi Hostinger Support**
- Minta mereka increase `client_max_body_size` di Nginx ke 25M
- Atau minta akses untuk edit Nginx config sendiri

**B. Implementasi Presigned URL Upload**
- Lebih reliable dan scalable
- Tidak tergantung limitasi hosting
- Upload langsung ke R2 dari browser

Mana yang Anda pilih?
