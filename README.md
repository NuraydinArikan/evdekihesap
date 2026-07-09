# 🏠 Evdeki Hesap

**Evdeki Hesap**, tüm ev yönetimini tek uygulamada toplayan, yapay zeka destekli, ücretsiz bir dijital ev asistanıdır (PWA). Alışveriş listesinden aile bütçesine, diyet takibinden abonelik yönetimine kadar günlük ev hayatının hesabını tutar.

🌐 **Canlı uygulama:** [evdekihesap.app](https://evdekihesap.app)

## ✨ Modüller

| Modül | Açıklama |
|-------|----------|
| 🛒 Ne Alsam? | Ortak alışveriş listesi |
| ✈️ Nereye Gitsem! | AI destekli tatil planlayıcı |
| 💰 Para Durumum | Bütçe ve harcama yönetimi + 🧾 fatura takibi |
| 👗 Gardırobum | Kıyafet / kombin önerileri |
| 🚗 Nasıl Gitsem? | Araç bakımı ve AI sürücü danışmanı |
| 🥗 Diyet Takibim | Beslenme takibi |
| 🔧 İşler Güçler | Ev tamiratı görevleri |
| 🌿 Bitkilerim | Bitki bakım takibi |
| 🐾 Canlarım | Evcil hayvan bakımı |
| 📚 Kütüphanem | Kitap ve ödünç takibi |
| 💳 Aboneyim Abone! | Abonelik yönetimi |
| 📅 Ajandamdakiler | Planlama ve ajanda |
| 👨‍👩‍👧 Ailem | Aile üyeleri yönetimi |
| 💰 Servetim | Varlık takibi |
| ⚡ Enerji Tasarrufu | Enerji tüketimi analizi |
| 💧 Su Tasarrufu | Su faturası analizi + Damacana Endeksi |
| 📱 Dijital Ekran Sürem | Ekran süresi takibi, Ekransız Aile Saati |

Ayarlar ve Nereye Gitsem! hariç her sekmede **"Mutfak Masası" AI sohbeti** bulunur: kullanıcı, o modülün konusuna özel olarak yapay zeka asistanıyla (Gemini) sohbet edebilir. Uygulama **Bireysel** ve **Aile (grup)** modlarında çalışır; sekme adları moda göre uyarlanır ("Ne Alsam?" / "Ne Alsak?" gibi).

## 🔧 Teknoloji

- **Ön yüz:** Vanilla JavaScript (`app.js`) + HTML + CSS — framework yok, derleme adımı yok
- **PWA:** Service Worker (`sw.js`) ile offline cache, `manifest.json`, push bildirimleri
- **Backend:** Firebase
  - Realtime Database (europe-west1) — veri + sohbet mesajları
  - Cloud Functions (`functions/`) — Gemini API proxy'si (API anahtarı istemciye sızmaz)
  - Authentication — e-posta/şifre; grup modu SHA-256 hash ile
  - Hosting — `firebase.json` içinde CSP dahil güvenlik başlıkları tanımlı
- **AI:** Google Gemini (Functions üzerinden `onCall` ile)

## 🚀 Kurulum

### Gereksinimler

- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- Bir Firebase projesi (Realtime Database + Functions + Auth + Hosting etkin)
- Gemini API anahtarı

### Adımlar

```bash
# 1. Depoyu klonla
git clone https://github.com/NuraydinArikan/evdekihesap.git
cd evdekihesap

# 2. Firebase projene bağlan
firebase use <proje-id>
```

**3. İstemci yapılandırmasını değiştir:** `app.js` dosyasının başındaki `firebaseConfig` nesnesini (yaklaşık 25. satır) kendi Firebase projenizin web yapılandırmasıyla değiştirin. Bu adım atlanırsa uygulama bu deponun sahibine ait Firebase projesine bağlanmaya çalışır ve çalışmaz. Yapılandırmayı Firebase Console → Project Settings → General → Your apps bölümünden alabilirsiniz.

```bash
# 4. Gemini API anahtarını secret olarak tanımla
firebase functions:secrets:set GEMINI_API_KEY

# 5. Functions bağımlılıklarını kur ve deploy et
cd functions && npm install && cd ..
firebase deploy --only functions

# 6. Hosting'i deploy et (kök dizin doğrudan yayınlanır)
firebase deploy --only hosting
```

### Yerel geliştirme

```bash
firebase emulators:start --only hosting
```

AI özelliklerini yerelde test etmek için Functions emülatörünü de başlatabilirsiniz:

```bash
firebase emulators:start --only hosting,functions
```

> Not: Derleme adımı olmadığı için `index.html` + `app.js` + `style.css` doğrudan düzenlenip yenilenebilir. Service Worker cache'i sürümlüdür (`sw.js` içindeki `CACHE_NAME`); statik dosyalarda değişiklik yaptıysanız sürüm numarasını artırmayı unutmayın.

## 📄 Yasal Sayfalar

- `gizlilik.html` — Gizlilik Politikası
- `mesafeli-satis.html` — Mesafeli Satış Sözleşmesi
- `iptal-iade.html` — İptal ve İade Koşulları
- `geribildirimformu.html` — Beta geri bildirim formu tarifi

## 🗺️ Yol Haritası

Bekleyen işler ve öncelikler için [`evdekihesap_backlog.md`](evdekihesap_backlog.md) dosyasına bakın.

## ⚖️ Lisans

© 2026 Nuraydın Arıkan. Tüm hakları saklıdır — ayrıntılar için [`LICENSE`](LICENSE) dosyasına bakın. Kaynak kod, şeffaflık ve inceleme amacıyla herkese açık olarak yayımlanmıştır; yazılı izin olmadan kopyalanamaz, değiştirilemez, dağıtılamaz veya ticari amaçla kullanılamaz.
