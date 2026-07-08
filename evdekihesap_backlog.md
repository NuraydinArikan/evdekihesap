# 📋 Evdeki Hesap — PWA Proje Backlog
> Otomatik tarama tarihi: 6 Haziran 2026  
> Kaynak: `evdeki_hesap_Claude` klasörü  
> Cache versiyonu: `evdeki-hesap-v106`

---

## 🔴 ACİL — Bekleyen Eksikler

### 1. Geri Bildirim Formu Linki Eklenmemiş
- **Dosya:** `geribildirimformu.html`, `index.html`, `app.js`
- **Sorun:** `FORM_LINKINIZ` placeholder'ı hâlâ koda yazılmamış; Google Forms hazırlanmadan Ayarlar ve footer'a buton eklenmemeli.
- **Yapılacak:**
  1. Google Forms'ta beta geri bildirim formu oluştur (5 soru: `geribildirimformu.html`'de detaylı tarif var)
  2. `FORM_LINKINIZ` yerine gerçek linki yaz
  3. Ayarlar sekmesi + footer'a geri bildirim butonunu ekle
  4. Mailchimp 7. gün e-postasına da ekle

### 2. Su Sekmesi — AI Sohbet Kutusu ✅ TAMAMLANDI
- **Durum:** `sekmeAc()` her sekme geçişinde `sohbetiYukle(id)` çağırıyor (`app.js:763`); `su` sekmesi `TAB_ISIMLER` ve `konular` haritalarında tanımlı. Sohbet kutusu otomatik ekleniyor — `index.html:660`'taki yorum bilgilendirme amaçlı, eksik iş yok.

### 3. Dijital Ekran Süresi — AI Sohbet Kutusu ✅ TAMAMLANDI
- **Durum:** Su sekmesiyle aynı mekanizma; `dijital` sekmesi de `TAB_ISIMLER` ve `konular` haritalarında tanımlı, sohbet kutusu otomatik ekleniyor.

---

## 🟡 ORTA ÖNCELİK — Geliştirilecek Özellikler

### 4. Evdeki Hesap Premium (Monetizasyon)
- **Kaynak:** `app.js:3120`, `app.js:3143`, `mesafeli-satis.html`, `iptal-iade.html`
- **Durum:** Tüm yasal belgeler (Mesafeli Satış, İptal-İade) hazır; Shopier altyapısı seçilmiş
- **Yapılacak:**
  - Shopier üzerinde 1 Aylık / 3 Aylık Dijital Hizmet Paketi oluştur
  - Premium ödeme akışını uygulamaya entegre et
  - FAQ yanıtlarını (`app.js:3120-3143`) gerçek Shopier linki ile güncelle
  - Premium kullanıcılar için ayrıcalıklı özellik belirle (ör. genişletilmiş AI kotası)

### 5. CSS Geçiş Animasyonları ✅ BÜYÜK ORANDA TAMAMLANDI
- **Durum:** Sekme geçişlerinde `fadeIn` animasyonu var (`style.css:168`), avatar geçişi `transition` ile animasyonlu (`style.css:297` civarı). İsteğe bağlı: kart hover durumlarına da geçiş eklenebilir.

### 6. Firebase Index Uyarıları
- **Dosya:** `app.js:2573`
- **Yorum:** `// [FIX #9] orderByChild kaldırıldı → Firebase index uyarısı yok, client-side sort`
- **Not:** Şu an client-side sort ile çözüldü ama veri büyüdükçe performans sorunu çıkabilir. Firebase Console'da gerekli indexleri tanımlamayı değerlendir.

---

## 🟢 DÜŞÜK ÖNCELİK — Bakım / Refactor

### 7. FIX Tag'leri — Tamamlanan Düzeltmeler (Arşiv)
Aşağıdaki düzeltmeler kodda yorum satırı olarak belgelenmiş; tümü tamamlanmış durumda:

| # | Düzeltme | Satır |
|---|----------|-------|
| FIX #1 | `loadArac()` kaldırıldı, Varlıklar'a taşındı | `app.js:1580` |
| FIX #2 | Hesap silme butonu Ayarlar'a eklendi | `app.js:3026` |
| FIX #3 | `abonelikPlan` HTML'de var, doğru kaydediliyor | `app.js:2553` |
| FIX #5 | Mutfak masası API varsa AI yanıtı üretiyor | `app.js:1022` |
| FIX #8 | Debounce — 3 listener tek güncelleme tetikler | `app.js:1155` |
| FIX #9 | `orderByChild` kaldırıldı, client-side sort | `app.js:2573` |
| FIX #10 | Anlık harcama toplamları gösteriliyor | `app.js:1106` |
| FIX #11 | Şifre sıfırlama eklendi | `app.js:285` |
| FIX #12 | T12:00:00 timezone kayması düzeltildi | `app.js:463` |
| FIX — | `activeListeners` ile temiz listener yönetimi | `app.js:103` |

### 8. README Güncellenmeli ✅ TAMAMLANDI
- **Dosya:** `README.md`
- **Durum:** Proje açıklaması, modül listesi, teknoloji özeti ve kurulum adımları eklendi.

---

## 📦 MEVCUT MODÜLLER (Genel Bakış)

| Modül | Dosya/Satır | Durum |
|-------|-------------|-------|
| 🛒 Market (alışveriş listesi) | `app.js:928` | ✅ Aktif |
| ✈️ Tatil Planlayıcı (AI) | `app.js:967` | ✅ Aktif |
| 💰 Bütçe Yönetimi | `app.js:1038` | ✅ Aktif |
| 👗 Kıyafet / Kombin | `app.js:1300` | ✅ Aktif |
| 🥗 Diyet Takibi | `app.js:1349` | ✅ Aktif |
| 🔧 Ev Tamiratı | `app.js:1591` | ✅ Aktif |
| 🌿 Bitkiler | `app.js:1639` | ✅ Aktif |
| 🐾 Canlar (evcil hayvanlar) | `app.js:1680` | ✅ Aktif |
| ⚡ Enerji Tasarrufu | `app.js:1837` | ✅ Aktif |
| 💧 Su Tasarrufu | `app.js:2048` | ⚠️ AI sohbet eksik |
| 📱 Dijital Denge | `app.js:2109` | ⚠️ AI sohbet eksik |
| 📚 Kütüphane | `app.js:2223` | ✅ Aktif |
| 📅 Ajanda | `app.js:2571` | ✅ Aktif |
| 👨‍👩‍👧‍👦 Ailem | `app.js:2616` | ✅ Aktif |
| 💰 Servetim | `app.js:2817` | ✅ Aktif |
| 💳 Abonelikler | `app.js:2519` | ✅ Aktif |
| 🧾 Faturalar | `app.js:507` | ✅ Aktif |

---

## 🔧 ALTYAPI NOTLARI

- **Firebase:** Realtime Database (europe-west1) + Cloud Functions + Analytics
- **AI:** Gemini API (Firebase Functions üzerinden proxy)
- **PWA:** Service Worker v106, offline cache aktif
- **Bildirimler:** Push notification + SW fallback
- **Auth:** Email/şifre + grup modu (SHA-256 hash)
- **Ödeme (Planlı):** Shopier — 1 Aylık / 3 Aylık Premium

---

*Bu backlog `evdeki_hesap_Claude` klasöründeki kaynak dosyalar otomatik taranarak oluşturulmuştur.*
