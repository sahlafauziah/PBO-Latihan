# Fokus (Mobile) — Pengingat Produktivitas & Pengontrol Screen Time

Tugas Persiapan Project UAS PBO — Kelompok 6

Versi mobile-friendly: dibuka lewat browser HP, tampilan cerah, navigasi
ala aplikasi native (bottom tab bar), dan bisa kirim notifikasi saat
waktu screen time habis atau jadwal belajar tiba.

## Cara menjalankan

```bash
pip install -r requirements.txt
python app.py
```

Lalu buka di browser **HP** kamu (pastikan HP & laptop terhubung WiFi yang
sama):

```
http://<IP-laptop-kamu>:5000
```

Cara cek IP laptop:
- Windows: buka CMD, ketik `ipconfig`, lihat "IPv4 Address"
- contoh hasilnya: `192.168.1.5` → buka `http://192.168.1.5:5000` di HP

Atau untuk coba cepat di laptop sendiri, buka saja `http://127.0.0.1:5000`
di browser laptop (tampilannya tetap disesuaikan untuk lebar HP).

## Mengaktifkan notifikasi

Saat halaman dibuka, ketuk ikon 🔔 di pojok kanan atas untuk mengizinkan
notifikasi. Setelah diizinkan, ada 5 jenis notifikasi otomatis:

1. **Timer screen time habis** — di tab Screen, set durasi (atau pakai
   chip cepat 1m/5m/15m/30m), tekan Mulai, lalu waktu berjalan mundur
   sendiri. Begitu mencapai 00:00:
   - **Bunyi alarm** otomatis berbunyi (3 bip pendek)
   - **Modal besar muncul di tengah layar** dan TIDAK hilang sendiri —
     harus ditekan tombol "OK, Mengerti" untuk menutupnya
   - Notifikasi browser juga dikirim (untuk kasus tab di-minimize)
   - Durasinya otomatis ditambahkan ke total screen time hari ini

   Timer berjalan sampai habis tanpa bisa dijeda/dihentikan di tengah.
2. **Pengingat jadwal** — muncul saat jam pengingat yang kamu set tercapai
3. **Screen time lewat batas harian** — muncul begitu total screen time
   hari ini (gabungan dari semua sesi timer) melebihi target yang kamu set
4. **Tugas belum selesai** — kalau ada tugas yang deadline-nya sudah
   tiba/lewat dan belum ditandai selesai, sistem akan terus mengingatkan
   ulang tiap 1 jam selama tugas itu belum selesai
5. **Waktu kosong untuk belajar** — di tab Home, atur "jam aktif" harian,
   sistem menghitung jam yang belum terisi jadwal lalu mengingatkan saat
   jam tersebut tiba

## Soal pemakaian di HP — yang perlu kamu tahu

Aplikasi ini **bisa dipakai di HP** lewat browser (Chrome/Safari), dan
tampilannya memang didesain khusus untuk lebar layar HP. Tapi karena ini
web app (bukan app native yang diinstal dari Play Store/App Store), ada
beberapa keterbatasan dari sisi browser HP yang perlu kamu pahami:

- **Timer & notifikasi paling andal kalau layar HP tetap menyala dan tab
  ini tetap di depan** selama sesi berjalan. Kalau layar dikunci atau
  pindah ke aplikasi lain, kebanyakan browser HP (Chrome Android, Safari
  iOS) akan "menahan" tab di background, sehingga timer bisa telat
  terdeteksi habis sampai kamu membuka tab-nya lagi.
- Untuk mengurangi dampak ini, aplikasi sudah dibuat agar begitu kamu
  **kembali membuka tab** (setelah sempat pindah aplikasi/kunci layar),
  sistem otomatis mengecek ulang apakah timer sebenarnya sudah habis
  selama itu, dan langsung memunculkan modal + bunyi alarm kalau iya.
  Jadi waktunya tetap akurat, hanya notifikasinya yang mungkin baru
  terlihat saat kamu kembali ke tab, bukan persis di detik ke-0.
- Notifikasi (Web Notification API) juga bergantung pada izin yang kamu
  berikan di awal serta dukungan browser HP yang dipakai — sebagian besar
  Chrome/Edge/Firefox Android mendukung penuh, sementara Safari iOS punya
  dukungan lebih terbatas untuk notifikasi dari halaman web biasa.

Untuk pemakaian sehari-hari (HP di meja, tab dibuka, layar nyala selagi
sesi berjalan), semua fitur di atas bekerja dengan baik.

## Struktur project

```
mobile_screentime/
├── app.py                  # Flask app + semua route/API
├── requirements.txt
├── models/
│   ├── __init__.py
│   ├── base.py              # class User & base class Manager
│   └── managers.py          # ScreenTimeTracker, ReminderManager, TaskManager
├── templates/
│   └── index.html           # tampilan mobile (4 screen + bottom nav)
└── static/
    ├── css/style.css        # tema cerah, mobile-first
    └── js/app.js             # navigasi tab + API + notifikasi browser
```

## Pemetaan ke spesifikasi tugas

| Spesifikasi             | Implementasi                                            |
|--------------------------|----------------------------------------------------------|
| Class `User`             | `models/base.py`                                         |
| Class `ScreenTimeTracker`| `models/managers.py`                                      |
| Class `ReminderManager`  | `models/managers.py`                                      |
| Class `TaskManager`      | `models/managers.py`                                      |
| Fitur: Screen time manager        | tab "Screen" — dial + tombol tambah cepat        |
| Fitur: Productivity reminder      | tab "Jadwal" + notifikasi browser                |
| Fitur: Task manager               | tab "Tugas"                                       |
| Fitur: Daily productivity report  | tab "Home" — ring skor & ringkasan                |

## Konsep OOP

- **Encapsulation** — atribut penting (`_daily_limit_minutes`,
  `_usage_log`, `_reminders`, `_tasks`) disembunyikan dan hanya bisa diubah
  lewat method yang sudah memvalidasi input.
- **Inheritance** — `ScreenTimeTracker`, `ReminderManager`, `TaskManager`
  semua mewarisi class abstrak `Manager`.
- **Polymorphism** — setiap class anak punya implementasi `get_summary()`
  sendiri, dipanggil dengan cara yang sama dari `build_daily_report()`.

## Catatan

Data disimpan di memori selama server berjalan (sesuai kebutuhan tugas
persiapan). Jika server di-restart, data akan kembali kosong.
