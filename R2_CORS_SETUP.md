# Konfigurasi CORS untuk R2 Bucket

## Masalah
Error: `CORS Missing Allow Origin` saat upload langsung ke R2 dari browser.

## Solusi

### 1. Login ke Cloudflare Dashboard
1. Buka https://dash.cloudflare.com
2. Pilih akun Anda
3. Klik **R2** di sidebar kiri
4. Pilih bucket **aiotrade-files**

### 2. Tambahkan CORS Policy

Klik tab **Settings** → scroll ke **CORS Policy** → klik **Add CORS Policy**

Masukkan konfigurasi berikut:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Ganti `yourdomain.com` dengan domain Hostinger Anda yang sebenarnya.**

### 3. Alternatif: Menggunakan Wrangler CLI

Jika Anda punya Wrangler CLI terinstall:

```bash
# Install wrangler jika belum
npm install -g wrangler

# Login
wrangler login

# Set CORS policy
wrangler r2 bucket cors put aiotrade-files --cors-config cors.json
```

File `cors.json`:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. Verifikasi CORS

Setelah setting CORS, tunggu beberapa detik lalu test upload lagi.

Jika masih error, cek CORS policy dengan:

```bash
wrangler r2 bucket cors get aiotrade-files
```

## Catatan Penting

- **AllowedOrigins** harus exact match dengan domain Anda
- Jangan gunakan wildcard `*` di production untuk security
- Tambahkan semua domain yang akan akses R2 (localhost untuk dev, production domain)
- CORS policy bisa memakan waktu beberapa detik untuk aktif

## Setelah CORS Dikonfigurasi

Upload seharusnya langsung berhasil tanpa error CORS.
