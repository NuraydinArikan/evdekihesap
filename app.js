// ⬇️ SENTRY BAŞLATMA — 1. satır!
Sentry.init({
  dsn: 'https://1a71304b94c153b5f1e1ea98d1ecc559@o4511404686901248.ingest.us.sentry.io/4511404687097856',
  environment: window.location.hostname === 'evdekihesap.app' ? 'production' : 'staging',
  release: 'app@v73',
  tracesSampleRate: 1.0,
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
    }
    if (event.user?.id) {
      event.user.id = '[UID]';
    }
    return event;
  }
});

// ==========================================
// 🔥 FİREBASE YAPILANDIRMASI
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCq-mcEx3rHjvbl8RYbhRrcH6eQS1igasI",
    authDomain: "evdeki-hesap-6b079.firebaseapp.com",
    databaseURL: "https://evdeki-hesap-6b079-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evdeki-hesap-6b079",
    storageBucket: "evdeki-hesap-6b079.firebasestorage.app",
    messagingSenderId: "716358452735",
    appId: "1:716358452735:web:81c708cfdc7f7a7b8cd3ca",
    measurementId: "G-5K0PYD0FY7"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const rtdb = firebase.database();

// Firebase Analytics — kullanım istatistikleri (anonim, KVKK uyumlu)
let analytics = null;
try {
    if (typeof firebase.analytics === 'function') {
        analytics = firebase.analytics();
    }
} catch(e) {}

// Sekme geçişlerini logla — hangi özellikler kullanılıyor?
function logEvent(eventName, params) {
    try { if (analytics) analytics.logEvent(eventName, params || {}); } catch(e) {}
}

// ==========================================
// 📊 KULLANICI OTURUMU TAKİBİ
// ==========================================
let _oturumBaslangic = Date.now();
let _oturumAktifSekme = 'market';
let _oturumSuresi = {};

function oturumKaydet() {
    const sure = Math.round((Date.now() - _oturumBaslangic) / 1000);
    logEvent('session_end', {
        duration_seconds: sure,
        most_used_tab: _oturumAktifSekme
    });
}

window.addEventListener('beforeunload', oturumKaydet);
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') oturumKaydet();
});


// ==========================================
// 🤖 YAPAY ZEKA — MERKEZİ SİSTEM (Firebase Functions)
// ==========================================

async function callGemini(prompt) {
    try {
        const askGemini = firebase.app().functions('europe-west1').httpsCallable('askGemini');
        const result = await askGemini({ prompt });
        return result.data.text;
    } catch (error) {
        console.error('Firebase Functions hatası:', error);
        return '⚠️ AI Asistan şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.';
    }
}

async function callGeminiVision(prompt, base64, mimeType) {
    try {
        const askGeminiVision = firebase.app().functions('europe-west1').httpsCallable('askGeminiVision');
        const result = await askGeminiVision({ prompt, image: base64, mimeType });
        return result.data;
    } catch (error) {
        console.error('Firebase Functions Vision hatası:', error);
        throw new Error('Görüntü analiz edilemedi veya sunucu hatası oluştu.');
    }
}

// ==========================================
// 🌍 GLOBAL DURUM
// ==========================================
let activePath = "";
let currentUser = null;
let isAile = false;
const activeListeners = {}; // [FIX] loadedSections yerine — her sekme için temiz listener
let _butceOzetTimer = null;

// ==========================================
// 🛡️ XSS KORUMASI — Kullanıcı verilerini HTML'e gömmeden önce her zaman bu fonksiyonu kullan
// ==========================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// AI yanıtlarını güvenli HTML'e dönüştür: önce escape, sonra markdown dönüşümü
function renderAiText(text) {
    return escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

const TAB_ISIMLER = {
    bireysel: {
        market:'🛒 Ne Alsam?', 
	tatil:'✈️ Nereye Gitsem!', 
	butce:'💰 Para Durumum',
        kiyafet:'👗 Gardırobum', 
	arac:'🚗 Nasıl Gitsem?', 
	diyet:'🥗 Diyet Takibim',
	tamirat:'🔧 İşler Güçler',
	bitkiler:'🌿 Bitkilerim', 
	canlar:'🐾 Canlarım',
	kutuphane:'📚 Kütüphanem',
	abonelikler:'💳 Aboneyim Abone!',
	ajanda:'📅 Ajandamdakiler',
	ailem:'👨‍👩‍👧 Ailem',
	varliklar:'💰 Servetim',
	enerji:'⚡ Enerji Tasarrufu Takibim',
	su:'💧 Su Tasarrufu Takibim',
	dijital:'📱 Dijital Ekran Sürem',
	ayarlar:'⚙️ Ayarlar'
    },
    aile: {
        market:'🛒 Ne Alsak?',
	tatil:'✈️ Nereye Gitsek!',
	butce:'💰 Para Durumumuz',
        kiyafet:'👗 Gardırobumuz',
	arac:'🚗 Nasıl Gitsek?',
	diyet:'🥗 Diyet Takibimiz',
	tamirat:'🔧 Evdeki İşler Güçler',
        bitkiler:'🌿 Bitkilerimiz',
	canlar:'🐾 Canlarımız',
	kutuphane:'📚 Kütüphanemiz',
        abonelikler:'💳 Aboneyiz Abone!',
	ajanda:'📅 Ajandamızdakiler',
        ailem:'👨‍👩‍👧 Ailemiz',
	varliklar:'💰 Servetimiz', 
	enerji:'⚡ Enerji Tasarrufu Takibimiz',
	su:'💧 Su Tasarrufu Takibimiz',
	dijital:'📱 Dijital Ekran Süremiz',
	ayarlar:'⚙️ Ayarlar'
    }
};

function tabIsimGuncelle() {
    const isimler = isAile ? TAB_ISIMLER.aile : TAB_ISIMLER.bireysel;
    Object.entries(isimler).forEach(([tab, isim]) => {
        const btn = document.querySelector(`[data-tab="${tab}"]`);
        if (btn) btn.textContent = isim;
    });
}

// ==========================================
// 🔐 KİMLİK DOĞRULAMA
// ==========================================
auth.onAuthStateChanged(user => {
    ['authScreen', 'modeSelection', 'appSection'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    if (user) {
        currentUser = user;
        document.getElementById('modeSelection').classList.remove('hidden');
        setTimeout(avatarYukle, 150);

        rtdb.ref(user.uid + '/displayName').once('value', snap => {
            const kayitliAd = snap.val();
            let ad;
            if (kayitliAd) {
                ad = kayitliAd;
                localStorage.setItem('evdeki_displayName', kayitliAd);
            } else {
                const localAd = localStorage.getItem('evdeki_displayName');
                ad = localAd || _emaildenIsim(user.email);
            }
            document.getElementById('uMsg').textContent = 'Hoş geldin ' + ad + ' 🏡🫣';
        });
    } else {
        currentUser = null;
        activePath = '';
        document.getElementById('authScreen').classList.remove('hidden');
    }
});

function _emaildenIsim(email) {
    if (!email) return 'Kullanıcı';
    const adi = email.split('@')[0];
    return adi.charAt(0).toUpperCase() + adi.slice(1);
}

function login() {
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('pass').value;
    if (!email || !pass) return showToast('E-posta ve şifre gerekli.', 'error');
    auth.signInWithEmailAndPassword(email, pass)
        .catch(err => showToast('Giriş hatası: ' + turkceHata(err.code), 'error'));
}

function register() {
    // KVKK onay alanını göster (ilk tıklamada)
    const kvkkAlani = document.getElementById('kvkkOnayAlani');
    const kvkkOnay  = document.getElementById('kvkkOnay');

    if (kvkkAlani && kvkkAlani.style.display === 'none') {
        kvkkAlani.style.display = 'block';
        kvkkAlani.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('📋 Lütfen sözleşmeleri okuyup onaylayın.', 'error');
        return;
    }

    if (kvkkOnay && !kvkkOnay.checked) {
        kvkkOnay.closest('label').style.outline = '2px solid #dc2626';
        kvkkOnay.closest('label').style.borderRadius = '6px';
        showToast('⚠️ Devam etmek için sözleşmeleri onaylamanız gerekiyor.', 'error');
        return;
    }

    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('pass').value;
    if (!email || !pass) return showToast('E-posta ve şifre gerekli.', 'error');
    if (pass.length < 6) return showToast('Şifre en az 6 karakter olmalı.', 'error');

    auth.createUserWithEmailAndPassword(email, pass)
        .then(() => {
            // Onay zamanını kaydet (audit trail)
            if (auth.currentUser) {
                rtdb.ref(auth.currentUser.uid + '/kvkkOnay').set({
                    onaylandi: true,
                    tarih: new Date().toISOString(),
                    versiyon: '2026-01'
                });
            }
            showToast('Hesabınız oluşturuldu! 🎉', 'success');
        })
        .catch(err => showToast('Kayıt hatası: ' + turkceHata(err.code), 'error'));
}

function turkceHata(code) {
    const hatalar = {
        'auth/user-not-found':       'Bu e-posta ile kayıt bulunamadı.',
        'auth/wrong-password':       'Şifre yanlış.',
        'auth/invalid-credential':   'E-posta veya şifre hatalı.',
        'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
        'auth/invalid-email':        'Geçersiz e-posta adresi.',
        'auth/weak-password':        'Şifre çok zayıf.',
        'auth/too-many-requests':    'Çok fazla deneme. Lütfen bekleyin.',
    };
    return hatalar[code] || code;
}

// [FIX #11] Şifre sıfırlama
function sifreSifirla() {
    const email = document.getElementById('email').value.trim();
    if (!email) return showToast('Önce e-posta adresinizi girin.', 'error');
    auth.sendPasswordResetEmail(email)
        .then(() => showToast('📧 Sıfırlama e-postası gönderildi! Gelen kutunuzu kontrol edin.'))
        .catch(err => showToast('Hata: ' + turkceHata(err.code), 'error'));
}

function isminiDegistir() {
    const mevcutAd = localStorage.getItem('evdeki_displayName') || '';
    const yeniAd = prompt('Görünen adınızı girin:', mevcutAd);
    if (!yeniAd || !yeniAd.trim()) return;
    const temizAd = yeniAd.trim();
    localStorage.setItem('evdeki_displayName', temizAd);
    if (auth.currentUser) {
        rtdb.ref(auth.currentUser.uid + '/displayName').set(temizAd);
    }
    document.getElementById('uMsg').textContent = 'Hoş geldin ' + temizAd + ' 🏡🫣';
    showToast('✅ İsim güncellendi: ' + temizAd);
}

// ==========================================
// 🎛️ MOD SEÇİMİ
// ==========================================
function enterMode(mode) {
    // Avatar küçül animasyonu
    const av = document.getElementById('avatarDisplay');
    if (av) av.classList.remove('avatar-hero');

    if (mode === 'family') {
        const box = document.getElementById('groupLoginBox');
        box.classList.toggle('hidden');
        return;
    }
    isAile = false;
    activePath = auth.currentUser.uid;
    _startApp('Sana Özel');
}

function submitGroupLogin() {
    const av = document.getElementById('avatarDisplay');
    if (av) av.classList.remove('avatar-hero');
    const gName = document.getElementById('gName').value.trim();
    const gPass = document.getElementById('gPass').value;
    if (!gName || !gPass) return showToast('Grup adı ve şifre gerekli.', 'error');
    _sha256(gName.toLowerCase() + ':' + gPass).then(hash => {
        const groupKey = 'groups/' + hash.substring(0, 40);
        rtdb.ref(groupKey + '/info').once('value').then(snap => {
            if (!snap.exists()) {
                rtdb.ref(groupKey + '/info').set({ name: gName, created: Date.now() });
                showToast('Yeni grup oluşturuldu: ' + gName + ' 🏠', 'success');
            }
            isAile = true;
            activePath = groupKey;
            _startApp('🏠 ' + gName);
        }).catch(() => showToast('Grup bağlantısı başarısız.', 'error'));
    });
}

async function _sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function _startApp(label) {
    // Tüm aktif listener'ları temizle
    Object.keys(activeListeners).forEach(k => {
        try { activeListeners[k](); } catch(e) {}
        delete activeListeners[k];
    });
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    const titleSpan = document.getElementById('appTitleText');
    if (titleSpan) titleSpan.textContent = label;
    tabIsimGuncelle();
    switchTab('market', document.querySelector('.nav-btn'));
    kayitliModulleriYukle();
    setTimeout(bildirimIzniIste, 1000);
    setTimeout(faturaUyariKontrol, 2000);
    setTimeout(gizliModulHatirlatmaKontrol, 10000);
    setTimeout(dogumGunuUyariKontrol, 3000);
    setTimeout(varlikUyariKontrol, 4000);
    setTimeout(abonelikUyariKontrol, 5000);
    setTimeout(marketBildirimDinle, 6000);
    sonGirisKaydet();
    setTimeout(inaktiflikKontrol, 2000);
    logEvent('login', { method: 'email' });
}

function showModeSelection() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('modeSelection').classList.remove('hidden');
    // Avatar: yeniden yükle + hero animasyonu başlat
    setTimeout(() => {
        avatarYukle();
        const av = document.getElementById('avatarDisplay');
        if (av) {
            av.classList.remove('avatar-hero');
            av.classList.add('avatar-hero-ilk');
            setTimeout(() => {
                av.classList.remove('avatar-hero-ilk');
                av.classList.add('avatar-hero');
            }, 500);
        }
    }, 80);
}

// ==========================================
// 🪟 ÖZEL ONAY MODALI (confirm() yerine — mobil uyumlu)
// ==========================================
function showConfirmCustom(htmlIcerik, onEvet, evetLabel) {
    const overlay = document.getElementById("confirmOverlay");
    const msgEl   = document.getElementById("confirmMsg");
    if (!overlay || !msgEl) { if (confirm("Devam edilsin mi?")) onEvet(); return; }
    msgEl.innerHTML = htmlIcerik;
    overlay.classList.remove("hidden");
    const evetBtn  = document.getElementById("confirmEvet");
    const hayirBtn = document.getElementById("confirmHayir");
    const yeniEvet  = evetBtn.cloneNode(true);
    const yeniHayir = hayirBtn.cloneNode(true);
    if (evetLabel) yeniEvet.textContent = evetLabel;
    evetBtn.parentNode.replaceChild(yeniEvet,  evetBtn);
    hayirBtn.parentNode.replaceChild(yeniHayir, hayirBtn);
    function kapat() { overlay.classList.add("hidden"); msgEl.textContent = ""; }
    yeniEvet.addEventListener("click",  () => { kapat(); onEvet(); });
    yeniHayir.addEventListener("click", () => kapat());
}

function showConfirm(mesaj, onEvet, onHayir) {
    const overlay = document.getElementById('confirmOverlay');
    const msgEl   = document.getElementById('confirmMsg');
    if (!overlay || !msgEl) {
        // Fallback — eski tarayıcı
        if (confirm(mesaj)) onEvet();
        return;
    }
    msgEl.textContent = mesaj;
    overlay.classList.remove('hidden');

    const evetBtn  = document.getElementById('confirmEvet');
    const hayirBtn = document.getElementById('confirmHayir');

    // Önceki listener'ları temizle
    const yeniEvet  = evetBtn.cloneNode(true);
    const yeniHayir = hayirBtn.cloneNode(true);
    evetBtn.parentNode.replaceChild(yeniEvet,  evetBtn);
    hayirBtn.parentNode.replaceChild(yeniHayir, hayirBtn);

    function kapat() { overlay.classList.add('hidden'); }

    yeniEvet.addEventListener('click',  () => { kapat(); onEvet(); });
    yeniHayir.addEventListener('click', () => { kapat(); if (onHayir) onHayir(); });
}

// ==========================================
// 🔔 TOAST BİLDİRİM
// ==========================================
function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast-msg';
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:${type === 'error' ? '#dc2626' : '#16a34a'};color:white;
        padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;
        z-index:9999;box-shadow:0 4px 15px rgba(0,0,0,0.2);
        animation:fadeIn 0.3s ease;max-width:300px;text-align:center;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ==========================================
// 📅 TARİH YARDIMCILARI
// ==========================================
// [FIX #12] T12:00:00 ile gösterim — timezone kaymasını önler
function tarihGoster(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('tr-TR');
}

function tarihGosterUzun(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ==========================================
// 🔔 BİLDİRİM SİSTEMİ
// ==========================================
async function bildirimIzniIste() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        const izin = await Notification.requestPermission();
        if (izin === 'granted') showToast('🔔 Bildirimler açıldı! Artık hatırlatmalar alacaksınız.');
        else showToast('🔕 Bildirim izni verilmedi. Ayarlardan açabilirsiniz.', 'error');
    }
}

function bildirimGonder(baslik, metin, etiket) {
    if (Notification.permission !== 'granted') return;
    // Service worker üzerinden gönder (arka plan desteği)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: baslik,
            body: metin,
            tag: etiket || 'evdeki-bildirim'
        });
    } else {
        // Fallback: doğrudan bildirim
        new Notification(baslik, {
            body: metin,
            icon: './evdekihesap_logo_yeni.png',
            tag: etiket || 'evdeki-bildirim'
        });
    }
}


function loadFaturalar() {
    const refFaturalar = ref('faturalar');
    refFaturalar.on('value', snap => {
        const list = document.getElementById('faturaList');
        if (!list) return;
        const items = [];
        snap.forEach(c => {
            const v = c.val();
            if (v) items.push({ id: c.key, ...v });
        });
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg" style="font-size:12px;">Henüz fatura eklenmedi 🧾</p>';
            return;
        }
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);

        list.innerHTML = items.map(item => {
            let uyariRenk = '#16a34a', uyariMetin = '', arkaPlan = 'white', kenar = '#f1f1f1';
            if (item.sonOdeme) {
                const son = new Date(item.sonOdeme + 'T00:00:00');
                const fark = Math.round((son - bugun) / (1000 * 60 * 60 * 24));
                if (fark < 0) {
                    uyariRenk = '#dc2626'; uyariMetin = '⛔ Son ödeme geçti!';
                    arkaPlan = '#fef2f2'; kenar = '#fca5a5';
                } else if (fark === 0) {
                    uyariRenk = '#dc2626'; uyariMetin = '🚨 BUGÜN son gün!';
                    arkaPlan = '#fef2f2'; kenar = '#fca5a5';
                } else if (fark <= 3) {
                    uyariRenk = '#d97706'; uyariMetin = `⚠️ ${fark} gün kaldı`;
                    arkaPlan = '#fffbeb'; kenar = '#fcd34d';
                } else if (fark <= 7) {
                    uyariRenk = '#f59e0b'; uyariMetin = `📅 ${fark} gün kaldı`;
                }
            }
            return `
            <div class="item-row" style="background:${arkaPlan};border-color:${kenar};">
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:13px;">🧾 ${escapeHtml(item.ad)}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                        ${item.sonOdeme ? 'Son ödeme: ' + tarihGoster(item.sonOdeme) : ''}
                        ${item.otomatik ? ' • 🔄 Otomatik ödeme' : ''}
                    </div>
                    ${uyariMetin ? `<div style="font-size:12px;font-weight:700;color:${uyariRenk};margin-top:3px;">${uyariMetin}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${item.tutar ? `<span style="font-weight:800;color:#dc2626;">${Number(item.tutar).toLocaleString('tr-TR')} ₺</span>` : ''}
                    <button onclick="faturaOdendi('${item.id}')" style="background:#16a34a;color:white;border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:700;">✓ Ödendi</button>
                    <button onclick="deleteItem('faturalar','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                </div>
            </div>`;
        }).join('');
    });
    return () => { refFaturalar.off('value'); };
}

function faturaEkle() {
    logEvent('item_add', { module: 'fatura' });
    const ad       = document.getElementById('faturaAd').value.trim();
    const tutar    = document.getElementById('faturatutar').value;
    const sonOdeme = document.getElementById('faturaSonOdeme').value;
    const otomatik = document.getElementById('faturaOtomatik').checked;
    if (!ad) return showToast('Fatura adı gerekli.', 'error');
    ref('faturalar').push({ ad, tutar: tutar ? parseFloat(tutar) : null, sonOdeme, otomatik, ts: Date.now() });
    document.getElementById('faturaAd').value = '';
    document.getElementById('faturatutar').value = '';
    document.getElementById('faturaSonOdeme').value = '';
    document.getElementById('faturaOtomatik').checked = false;
    showToast('✅ Fatura kaydedildi!');
}

function faturaOdendi(id) {
    ref('faturalar/' + id).once('value', snap => {
        const v = snap.val();
        if (!v) return;
        if (v.sonOdeme) {
            const yeni = new Date(v.sonOdeme + 'T00:00:00');
            yeni.setMonth(yeni.getMonth() + 1);
            const yeniStr = yeni.toISOString().split('T')[0];
            ref('faturalar/' + id).update({ sonOdeme: yeniStr });
            showToast('✅ Ödendi! Sonraki tarih: ' + tarihGoster(yeniStr));
        } else {
            deleteItem('faturalar', id);
            showToast('✅ Fatura silindi.');
        }
    });
}

async function faturaFotoOku(input) {
    const file = input.files[0];
    if (!file) return;
    const el = document.getElementById('faturaOcrSonuc');
    el.innerHTML = '<p style="font-size:12px;color:#92400e;padding:8px 0;">📸 Fatura okunuyor...</p>';

    const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
    const mimeType = file.type || 'image/jpeg';

    try {
        const prompt = 'Bu bir fatura veya fiş görüntüsü. Lütfen şu bilgileri JSON formatında çıkar:\n{"ad":"kurum/firma adı","tutar":sadece sayı (TL),"sonOdeme":"YYYY-MM-DD veya null"}\nSadece JSON döndür.';
        const parsed = await callGeminiVision(prompt, base64, mimeType);
        if (parsed.ad)       document.getElementById('faturaAd').value = parsed.ad;
        if (parsed.tutar)    document.getElementById('faturatutar').value = parsed.tutar;
        if (parsed.sonOdeme) document.getElementById('faturaSonOdeme').value = parsed.sonOdeme;
        el.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#15803d;">✅ Okundu! Form dolduruldu. Kontrol edip kaydedin.</div>';
    } catch (e) {
        el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#dc2626;">⚠️ Fatura okunamadı: ' + escapeHtml(e.message) + '. Manuel girin.</div>';
    }
    input.value = '';
}

function faturaUyariKontrol() {
    if (!activePath) return;
    ref('faturalar').once('value', snap => {
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        const uyarilar = [];
        snap.forEach(c => {
            const v = c.val();
            if (!v.sonOdeme || v.otomatik) return;
            const son = new Date(v.sonOdeme + 'T00:00:00');
            const fark = Math.round((son - bugun) / (1000 * 60 * 60 * 24));
            if (fark >= 0 && fark <= 3) {
                const mesaj = fark === 0 ? 'BUGÜN son gün!' : fark + ' gün kaldı';
                uyarilar.push(`${v.ad}: ${mesaj}`);
                bildirimGonder(
                    '🧾 Fatura Uyarısı — ' + v.ad,
                    fark === 0 ? 'Bugün son ödeme günü!' : `Son ödeme için ${fark} gün kaldı.`,
                    'fatura-' + c.key
                );
            }
        });
        if (uyarilar.length > 0) showToast('🧾 Fatura: ' + uyarilar.join(' | '), 'error');
    });
}

// ==========================================
// 🔔 ABONELİK UYARI KONTROLÜ
// ==========================================
function abonelikUyariKontrol() {
    if (!activePath) return;
    ref('abonelikler').once('value', snap => {
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        snap.forEach(c => {
            const v = c.val();
            if (!v.yenilemeTarihi) return;
            const tarih = new Date(v.yenilemeTarihi + 'T00:00:00');
            const fark = Math.round((tarih - bugun) / (1000 * 60 * 60 * 24));
            if (fark === 3) {
                bildirimGonder(
                    '💳 Abonelik Yenileniyor — ' + v.ad,
                    `${v.ad} aboneliğiniz 3 gün içinde yenilenecek. (${v.tutar ? v.tutar + ' ₺' : ''})`,
                    'abonelik-' + c.key
                );
            } else if (fark === 0) {
                bildirimGonder(
                    '💳 Abonelik Bugün Yenileniyor — ' + v.ad,
                    `${v.ad} aboneliği bugün yenileniyor.`,
                    'abonelik-bugun-' + c.key
                );
            }
        });
    });
}

// ==========================================
// 🔔 ALIŞVERİŞ LİSTESİ BİLDİRİMLERİ
// ==========================================
let _marketOncekiSayim = null;
function marketBildirimDinle() {
    if (!activePath) return;
    ref('market').on('value', snap => {
        const yeniSayim = snap.numChildren();
        // İlk yüklemede referans al, sonraki değişikliklerde bildir
        if (_marketOncekiSayim === null) {
            _marketOncekiSayim = yeniSayim;
            return;
        }
        if (yeniSayim > _marketOncekiSayim) {
            bildirimGonder(
                '🛒 Alışveriş Listesi Güncellendi',
                'Listeye yeni ürün eklendi.',
                'market-guncelleme'
            );
        }
        _marketOncekiSayim = yeniSayim;
    });
}

// ==========================================
// 🔔 İNAKTİFLİK HATIRLATMASI
// ==========================================
function sonGirisKaydet() {
    try { localStorage.setItem('evdeki_sonGiris', Date.now()); } catch(e) {}
}

function inaktiflikKontrol() {
    try {
        const son = parseInt(localStorage.getItem('evdeki_sonGiris') || '0');
        if (!son) return;
        const gunFarki = Math.floor((Date.now() - son) / (1000 * 60 * 60 * 24));
        if (gunFarki >= 5 && gunFarki < 6) {
            bildirimGonder(
                '🏡 Evdeki Hesap sizi özlüyor!',
                '5 gündür uğramadınız. Faturalar, listeler bekliyor olabilir.',
                'inaktiflik-5gun'
            );
        } else if (gunFarki >= 14 && gunFarki < 15) {
            bildirimGonder(
                '🏡 2 haftadır görüşemedik!',
                'Belki kontrol etmeniz gereken fatura veya hatırlatma vardır.',
                'inaktiflik-14gun'
            );
        }
    } catch(e) {}
}

// ==========================================
// 🧭 SEKME YÖNETİMİ
// ==========================================
function switchTab(id, btn) {
    logEvent('tab_view', { tab: id });
    _oturumAktifSekme = id;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const el = document.getElementById('s-' + id);
    if (el) el.classList.add('active');
    if (btn) btn.classList.add('active');
    else {
        const navBtn = document.querySelector(`[data-tab="${id}"]`);
        if (navBtn) navBtn.classList.add('active');
    }
    if (!activePath) return;
    const loaders = {
        market:      loadMarket,
        tatil:       loadTatil,
        butce:       loadButce,
        kiyafet:     loadKiyafet,
        diyet:       loadDiyet,
        tamirat:     loadTamirat,
        bitkiler:    loadBitkiler,
        canlar:      loadCanlar,
        kutuphane:   loadKutuphane,
        abonelikler: loadAbonelikler,
        ajanda:      loadAjanda,
        ailem:       loadAilem,
        varliklar:   loadVarliklar,
	enerji:      loadEnerji,
        su:          loadSu,
        dijital:     loadDijital
    };
    // canlar her tab geçişinde yeniden yüklenir (listener refresh)
    if (id === 'canlar' && loaders[id]) {
        if (typeof activeListeners[id] === 'function') activeListeners[id]();
        delete activeListeners[id];
    }
    // Diğer sekmeler sadece bir kez yüklenir
    if (loaders[id] && !activeListeners[id]) {
        const cleanup = loaders[id]();
        activeListeners[id] = cleanup || true;
    }
    // Her sekmeye özel mutfak masası sohbeti
    setTimeout(() => sohbetiYukle(id), 150);
}

// ==========================================
// 🧩 MODÜLER PANO
// ==========================================

function modulleriGuncelle() {
    const moduller = ['enerji','su','dijital','canlar','bitkiler','diyet','arac','kutuphane','ailem'];
    moduller.forEach(m => {
        const aktif = document.getElementById('ayar-' + m)?.checked ?? true;
        const nav   = document.getElementById('nav-' + m);
        if (nav) nav.style.display = aktif ? 'inline-block' : 'none';
    });
    const kayit = {};
    moduller.forEach(m => {
        kayit[m] = document.getElementById('ayar-' + m)?.checked ?? true;
    });
    localStorage.setItem('evdekiHesapModuller', JSON.stringify(kayit));
}

function gizliModulHatirlatmaKontrol() {
    try {
        const kayitli = localStorage.getItem('evdekiHesapModuller');
        if (!kayitli) return;
        const ayarlar = JSON.parse(kayitli);
        const isimler = {
            enerji:'⚡ Enerji Takibi', su:'💧 Su Takibi', dijital:'📱 Dijital Ekran Sürem',
            canlar:'🐾 Canlarım', bitkiler:'🌿 Bitkilerim', diyet:'🥗 Diyet Takibim',
            arac:'🚗 Nasıl Gitsem?', kutuphane:'📚 Kütüphanem', ailem:'👨‍👩‍👧 Ailem'
        };
        const gizliler = Object.entries(isimler)
            .filter(([k]) => ayarlar[k] === false)
            .map(([, v]) => v);
        if (!gizliler.length) return;
        const son = parseInt(localStorage.getItem('evdeki_modul_hatirlatma') || '0');
        if (son && Date.now() - son < 7 * 24 * 60 * 60 * 1000) return;
        localStorage.setItem('evdeki_modul_hatirlatma', String(Date.now()));
        showToast('💡 Gizli modül' + (gizliler.length > 1 ? 'ler' : '') + ': ' + gizliler.join(', ') + ' — Ayarlar\'dan açabilirsiniz.');
    } catch(e) {}
}

function kayitliModulleriYukle() {
    try {
        const kayitli = localStorage.getItem('evdekiHesapModuller');
        if (kayitli) {
            const a = JSON.parse(kayitli);
            ['enerji','su','dijital','canlar','bitkiler','diyet','arac','kutuphane','ailem'].forEach(m => {
                const el = document.getElementById('ayar-' + m);
                if (el) el.checked = a[m] !== false;
            });
        }
    } catch(e) {}
    modulleriGuncelle();
    _setupEnterListeners();
}

// ==========================================
// ☕ HER SEKMEYE ÖZEL MUTFAK MASASI SOHBETİ
// ==========================================
let _aktifSohbetRef = null;

function sohbetiYukle(sekmeId) {
    // ayarlar ve tatil (kendi sohbeti var) hariç
    if (!activePath || sekmeId === 'ayarlar' || sekmeId === 'tatil') return;
    
    const section = document.getElementById('s-' + sekmeId);
    if (!section) return;

    if (!section.querySelector('.sohbet-konteyner')) {
        const div = document.createElement('div');
        div.className = 'sohbet-konteyner card';
        div.style.cssText = 'padding:0;overflow:hidden;border:none;background:transparent;box-shadow:none;margin-top:20px;';
        const isimler = isAile ? TAB_ISIMLER.aile : TAB_ISIMLER.bireysel;
        div.innerHTML = `
            <div class="mutfak-masasi">
                <div class="mutfak-baslik">☕ ${isimler[sekmeId] || 'Mutfak Masası'} Sohbeti</div>
                <div class="mutfak-mesajlar" id="mesajlar-${sekmeId}"></div>
                <div style="display:flex;padding:10px;gap:8px;background:white;border-top:1px solid #ffedd5;">
                    <input type="text" id="input-${sekmeId}" placeholder="Bu konuya özel mesaj yaz..." style="flex:1;margin-bottom:0;"
                        onkeypress="if(event.key==='Enter') sekmeMesajGonder('${sekmeId}')">
                    <button onclick="sekmeMesajGonder('${sekmeId}')" class="btn btn-orange" style="width:auto;padding:11px 16px;">🚀</button>
                </div>
            </div>`;
        section.appendChild(div);
    }

    if (_aktifSohbetRef) _aktifSohbetRef.off('value');
    _aktifSohbetRef = ref(sekmeId + '_mesajlar');
    _aktifSohbetRef.on('value', snap => {
        const el = document.getElementById('mesajlar-' + sekmeId);
        if (!el) return;
        const msgs = [];
        snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
        if (!msgs.length) { el.innerHTML = '<p class="empty-msg">Henüz mesaj yok ☕<br>Bu konuda sohbet başlatın!</p>'; return; }
        el.innerHTML = msgs.map(m => {
            const sinif = m.type === 'user' ? 'benim-mesajim' : 'bot-mesaji';
            return `<div class="mesaj-balonu ${sinif}">
                <div class="mesaj-yazani">${escapeHtml(m.kim || 'Kullanıcı')}</div>
                <div>${renderAiText(m.text)}</div>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    });
}

async function sekmeMesajGonder(sekmeId) {
    const input = document.getElementById('input-' + sekmeId);
    const text  = input?.value.trim();
    if (!text || !activePath) return;
    const kim = localStorage.getItem('evdeki_displayName') || 'Siz';
    ref(sekmeId + '_mesajlar').push({ text, kim, type: 'user', ts: Date.now() });
    input.value = '';
    const loadingRef = ref(sekmeId + '_mesajlar').push();
    await loadingRef.set({ text: '💭 Düşünüyorum...', kim: '🤖 Asistan', type: 'ai-loading', ts: Date.now() });
    const konular = {
        market:'alışveriş', butce:'finans ve bütçe', kiyafet:'kombin ve moda',
        diyet:'diyet ve beslenme', tamirat:'ev tamiratı', bitkiler:'bitki bakımı',
        canlar:'evcil hayvan bakımı', kutuphane:'kitaplar', abonelikler:'abonelikler',
        ajanda:'planlama ve ajanda', ailem:'aile', varliklar:'araç ve ev eşyaları',
        enerji:'enerji tasarrufu', su:'su tasarrufu', dijital:'dijital ekran sürem ve ekran süresi'
    };
    const konu = konular[sekmeId] || 'genel ev işleri';
    const prompt = `Sen evin yardımcı asistanısın. Şu an '${konu}' konusundayız. Kullanıcı şunu yazdı: "${text}". Samimi, Türkçe ve kısa bir yanıt ver.`;
    const cevap = await callGemini(prompt);
    await loadingRef.remove();
    ref(sekmeId + '_mesajlar').push({ text: cevap, kim: '🤖 Asistan', type: 'ai', ts: Date.now() });
}

// ==========================================
// 💾 VERİ YARDIMCILARI
// ==========================================
function ref(path) {
    return rtdb.ref(activePath + '/' + path);
}

function addItem(type, data, inputId) {
    if (!activePath) return;
    const firstVal = Object.values(data)[0];
    if (!firstVal || String(firstVal).trim() === '') return;
    ref(type).push({ ...data, ts: Date.now() }).then(() => {
        if (inputId) {
            const el = document.getElementById(inputId);
            if (el) el.value = '';
        }
    });
}

function deleteItem(type, id) {
    if (!activePath) return;
    ref(type + '/' + id).remove();
}

// ==========================================
// 🛒 MARKET
// ==========================================
function loadMarket() {
    const refMarket = ref('market');
    refMarket.on('value', snap => {
        const list = document.getElementById('marketList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg">Liste boş 🛒<br>Ne almak gerekiyor?</p>';
            return;
        }
        const bekleyen = items.filter(i => !i.done).length;
        list.innerHTML = `<div style="padding:8px 15px;font-size:12px;color:#888;font-weight:600;">${bekleyen} ürün bekliyor • ${items.length - bekleyen} alındı</div>` +
            items.reverse().map(item => `
            <div class="item-row">
                <div style="display:flex;align-items:center;gap:10px;flex:1;">
                    <input type="checkbox" ${item.done ? 'checked' : ''}
                        onchange="ref('market/${item.id}').update({done:${!item.done}})"
                        style="width:20px;height:20px;cursor:pointer;accent-color:var(--primary);flex-shrink:0;">
                    <span style="${item.done ? 'text-decoration:line-through;color:#9ca3af;' : 'font-weight:600;'}">${escapeHtml(item.text)}</span>
                </div>
                <button onclick="deleteItem('market','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:18px;padding:4px;">🗑</button>
            </div>`).join('');
    });
    return () => { refMarket.off('value'); };
}

async function sefAiSor() {
    const malzeme = document.getElementById('malzemeInput').value.trim();
    if (!malzeme) return showToast('Evdeki malzemeleri yazın.', 'error');
    const el = document.getElementById('sefSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">👨‍🍳 Şef tarif hazırlıyor...</p>';
    const cevap = await callGemini(`Sen yetenekli bir ev aşçısısın.\nEvde şu malzemeler var: ${malzeme}\n\nBu malzemelerle yapılabilecek 2-3 pratik ve lezzetli yemek öner. Her tarif için:\n🍽️ Yemek adı\n📝 Kısa malzeme listesi\n👩‍🍳 Yapılış adımları (kısa)\n⏱️ Yaklaşık süre\n\nTürkçe, samimi ve pratik bir dille yaz.`);
    el.innerHTML = `<div style="background:#fffbf0;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin-top:10px;color:#92400e;line-height:1.8;font-size:13px;">${renderAiText(cevap)}</div>`;
}

// ==========================================
// ✈️ TATİL
// ==========================================
function loadTatil() {
    const refTatil = ref('tatilMesajlar');
    refTatil.on('value', snap => {
        const el = document.getElementById('tatilMesajlari');
        if (!el) return;
        const msgs = [];
        snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
        if (!msgs.length) {
            el.innerHTML = '<p class="empty-msg">Henüz mesaj yok ✈️<br>Tatil hayalinizi yazın!</p>';
            return;
        }
        el.innerHTML = msgs.map(m => {
            const sinif = m.type === 'user' ? 'benim-mesajim' :
                          m.type === 'ai'   ? 'bot-mesaji' :
                          m.type === 'ai-loading' ? 'bot-mesaji ai-loading' :
                          m.type === 'ai-hata'    ? 'bot-mesaji' : '';
            const stil = m.type === 'ai-hata' ? 'background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;' : '';
            return `<div class="mesaj-balonu ${sinif}" style="${stil}">
                <div class="mesaj-yazani">${escapeHtml(m.kim || 'Kullanıcı')}</div>
                <div>${renderAiText(m.text)}</div>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    });
    return () => { refTatil.off('value'); };
}

async function tatilAiBtnTikla() {
    const btn = document.getElementById('tatilAiBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Hazırlanıyor...'; }
    try { await askAIForTatil(); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '🤖 Rota Öner'; } }
}

async function askAIForTatil() {
    const planEl  = document.getElementById('tPlan');
    const butceEl = document.getElementById('tButce');
    const plan    = planEl?.value.trim();
    const butce   = butceEl?.value.trim();
    if (!plan) return showToast('Tatil hayalinizi yazın.', 'error');
    const kim = localStorage.getItem('evdeki_displayName') || 'Siz';
    ref('tatilMesajlar').push({ text: plan, kim, type: 'user', ts: Date.now() });
    planEl.value = '';
    const loadingRef = ref('tatilMesajlar').push();
    await loadingRef.set({ text: '✈️ Tatil Asistanı rota hazırlıyor...', kim: '🤖 Tatil Asistanı', type: 'ai-loading', ts: Date.now() });
    const cevap = await callGemini(`Sen deneyimli bir tatil planlama uzmanısın.\nKullanıcının talebi: "${plan}"\n${butce ? 'Bütçe: ' + butce + ' TL' : 'Bütçe: belirtilmedi'}\n\nŞunları içeren kapsamlı ama okunması kolay bir tatil planı öner:\n📍 Destinasyon ve neden bu yer\n🗓️ Günlük program (kısa kısa)\n🏨 Konaklama önerisi\n🍽️ Mutlaka yenmesi gereken yemekler\n💰 Tahmini maliyet dağılımı\n✈️ Ulaşım önerisi\n\nTürkçe, samimi ve heyecan verici bir dille yaz.`);
    await loadingRef.remove();
    ref('tatilMesajlar').push({ text: cevap, kim: '🤖 Tatil Asistanı', type: cevap.startsWith('⚠️') ? 'ai-hata' : 'ai', ts: Date.now() });
}

// [FIX #5] Mutfak masası artık API varsa AI yanıtı da üretiyor
async function mesajGonder() {
    const input = document.getElementById('yeniMesajInput');
    const text  = input?.value.trim();
    if (!text || !activePath) return;
    const kim = localStorage.getItem('evdeki_displayName') || 'Siz';
    ref('tatilMesajlar').push({ text, kim, type: 'user', ts: Date.now() });
    input.value = '';
    const loadingRef = ref('tatilMesajlar').push();
    await loadingRef.set({ text: '💭 Düşünüyorum...', kim: '🤖 Tatil Asistanı', type: 'ai-loading', ts: Date.now() });
    const cevap = await callGemini(`Sen bir tatil ve seyahat asistanısın. Kullanıcı şunu yazdı: "${text}". Kısa ve yardımcı bir Türkçe yanıt ver.`);
    await loadingRef.remove();
    ref('tatilMesajlar').push({ text: cevap, kim: '🤖 Tatil Asistanı', type: cevap.startsWith('⚠️') ? 'ai-hata' : 'ai', ts: Date.now() });
}

// ==========================================
// 💰 BÜTÇE MODÜLÜ
// ==========================================
function loadButce() {
    loadFaturalar();

    const refBGelir = ref('butce_gelir');
    const refSabit  = ref('sabitGider');
    const refTaksit = ref('taksitler');
    const refButce  = ref('butce');

    refBGelir.on('value', snap => {
        const gelir = snap.val() || 0;
        const el = document.getElementById('aylikGelirGoster');
        if (el) el.textContent = Number(gelir).toLocaleString('tr-TR') + ' ₺';
        butceOzetGuncelle();
    });

    refSabit.on('value', snap => {
        const list = document.getElementById('sabitGiderList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg" style="font-size:12px;">Sabit gider eklenmedi.</p>';
        } else {
            list.innerHTML = items.map(i => `
                <div class="item-row" style="padding:10px 14px;">
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:13px;">${escapeHtml(i.ad)}</div>
                        <div style="font-size:11px;color:#888;">${escapeHtml(i.kategori || 'Genel')}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:700;color:#dc2626;">${Number(i.miktar||0).toLocaleString('tr-TR')} ₺</span>
                        <button onclick="deleteItem('sabitGider','${i.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;">🗑</button>
                    </div>
                </div>`).join('');
        }
        butceOzetGuncelle();
    });

    refTaksit.on('value', snap => {
        const list = document.getElementById('taksitList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg" style="font-size:12px;">Taksit eklenmedi.</p>';
        } else {
            list.innerHTML = items.map(i => {
                const kalan = Number(i.kalanTaksit || 0);
                const renk = kalan <= 2 ? '#dc2626' : kalan <= 4 ? '#d97706' : '#16a34a';
                return `
                <div class="item-row" style="padding:10px 14px;">
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:13px;">${escapeHtml(i.ad)}</div>
                        <div style="font-size:11px;color:${renk};font-weight:700;">${kalan} taksit kaldı</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:700;color:#dc2626;">${Number(i.aylikTutar||0).toLocaleString('tr-TR')} ₺/ay</span>
                        <button onclick="taksitOde('${i.id}',${kalan})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:700;">Ödendi</button>
                        <button onclick="deleteItem('taksitler','${i.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;">🗑</button>
                    </div>
                </div>`;
            }).join('');
        }
        butceOzetGuncelle();
    });

    // [FIX #10] Anlık harcama toplamları artık gösteriliyor
    refButce.on('value', snap => {
        const list = document.getElementById('butceList');
        if (!list) return;
        let gelirHarcama = 0, gider = 0;
        const items = [];
        snap.forEach(c => {
            const v = c.val();
            items.push({ id: c.key, ...v });
            if (v.tur === 'gelir') gelirHarcama += Number(v.miktar || 0);
            else gider += Number(v.miktar || 0);
        });

        const ozetEl = document.getElementById('butceAnlikOzet');
        if (ozetEl) {
            ozetEl.innerHTML = items.length ? `
                <div style="flex:1;background:white;border-radius:10px;padding:10px;text-align:center;border:1px solid #d1fae5;">
                    <div style="font-size:10px;color:#888;font-weight:600;">Ek Gelir</div>
                    <div style="font-size:16px;font-weight:800;color:#16a34a;">+${gelirHarcama.toLocaleString('tr-TR')} ₺</div>
                </div>
                <div style="flex:1;background:white;border-radius:10px;padding:10px;text-align:center;border:1px solid #fecaca;">
                    <div style="font-size:10px;color:#888;font-weight:600;">Harcama</div>
                    <div style="font-size:16px;font-weight:800;color:#dc2626;">-${gider.toLocaleString('tr-TR')} ₺</div>
                </div>` : '';
        }

        if (!items.length) { list.innerHTML = '<p class="empty-msg">Henüz işlem yok 💰</p>'; return; }
        list.innerHTML = items.reverse().map(item => `
            <div class="item-row">
                <div style="flex:1;">
                    <div style="font-weight:600;">${escapeHtml(item.aciklama)}</div>
                    <div style="font-size:12px;color:#888;">${escapeHtml(item.kategori || 'Genel')} • ${item.ts ? new Date(item.ts).toLocaleDateString('tr-TR') : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:${item.tur === 'gelir' ? '#16a34a' : '#dc2626'};">
                        ${item.tur === 'gelir' ? '+' : '-'}${Number(item.miktar||0).toLocaleString('tr-TR')} ₺
                    </span>
                    <button onclick="deleteItem('butce','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                </div>
            </div>`).join('');
    });
    return () => {
        refBGelir.off('value');
        refSabit.off('value');
        refTaksit.off('value');
        refButce.off('value');
    };
}

// [FIX #8] Debounce — aynı anda gelen 3 listener tek bir güncelleme tetikler
function butceOzetGuncelle() {
    if (_butceOzetTimer) clearTimeout(_butceOzetTimer);
    _butceOzetTimer = setTimeout(_butceOzetGuncelleImpl, 300);
}

async function _butceOzetGuncelleImpl() {
    const gelirSnap  = await ref('butce_gelir').once('value');
    const sabitSnap  = await ref('sabitGider').once('value');
    const taksitSnap = await ref('taksitler').once('value');

    const gelir = Number(gelirSnap.val() || 0);
    let sabitToplam = 0, taksitToplam = 0;
    sabitSnap.forEach(c  => { sabitToplam  += Number(c.val().miktar     || 0); });
    taksitSnap.forEach(c => { taksitToplam += Number(c.val().aylikTutar || 0); });

    const toplamYuk = sabitToplam + taksitToplam;
    const serbest   = gelir - toplamYuk;
    const yukOran   = gelir > 0 ? Math.round((toplamYuk / gelir) * 100) : 0;

    let barRenk = '#16a34a', uyari = '';
    if (yukOran >= 80)      { barRenk = '#dc2626'; uyari = '🚨 Fren yap! Giderler gelirinizin %' + yukOran + '\'ini aşıyor!'; }
    else if (yukOran >= 60) { barRenk = '#d97706'; uyari = '⚠️ Dikkat! Giderler gelirinizin %' + yukOran + '\'i.'; }
    else if (yukOran >= 40) { barRenk = '#f59e0b'; uyari = '💡 Taksit yükü gelirinizin %' + yukOran + '\'i. Takip edin.'; }

    const ozet = document.getElementById('butceOzet');
    if (!ozet) return;

    ozet.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div style="background:white;border-radius:12px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#888;font-weight:600;">Aylık Gelir</div>
                <div style="font-size:20px;font-weight:800;color:#16a34a;">${gelir.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div style="background:white;border-radius:12px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#888;font-weight:600;">Toplam Yük</div>
                <div style="font-size:20px;font-weight:800;color:#dc2626;">${toplamYuk.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div style="background:white;border-radius:12px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#888;font-weight:600;">Sabit Giderler</div>
                <div style="font-size:18px;font-weight:800;color:#d97706;">${sabitToplam.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div style="background:white;border-radius:12px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#888;font-weight:600;">Taksit Yükü</div>
                <div style="font-size:18px;font-weight:800;color:#7c3aed;">${taksitToplam.toLocaleString('tr-TR')} ₺</div>
            </div>
        </div>
        <div style="background:${serbest >= 0 ? '#f0fdf4' : '#fef2f2'};border:2px solid ${serbest >= 0 ? '#86efac' : '#fca5a5'};border-radius:12px;padding:14px;margin-bottom:12px;text-align:center;">
            <div style="font-size:12px;color:#888;font-weight:600;margin-bottom:4px;">💸 Serbest Harcama Payı</div>
            <div style="font-size:28px;font-weight:900;color:${serbest >= 0 ? '#16a34a' : '#dc2626'};">${serbest.toLocaleString('tr-TR')} ₺</div>
            <div style="font-size:11px;color:#888;margin-top:4px;">Gelir - Sabit Giderler - Taksitler</div>
        </div>
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#555;margin-bottom:5px;">
                <span>Gider Oranı</span><span style="color:${barRenk};">%${yukOran}</span>
            </div>
            <div style="height:10px;background:#f3f4f6;border-radius:20px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(yukOran,100)}%;background:${barRenk};border-radius:20px;transition:width 0.5s ease;"></div>
            </div>
        </div>
        ${uyari ? `<div style="background:${yukOran>=80?'#fef2f2':'#fffbeb'};border:1.5px solid ${yukOran>=80?'#fca5a5':'#fde68a'};border-radius:10px;padding:10px 12px;font-size:13px;font-weight:700;color:${yukOran>=80?'#dc2626':'#92400e'};">${uyari}</div>` : ''}
    `;
}

function gelirKaydet() {
    logEvent('item_add', { module: 'gelir' });
    const miktar = document.getElementById('aylikGelirInput').value;
    if (!miktar) return showToast('Gelir miktarı girin.', 'error');
    ref('butce_gelir').set(parseFloat(miktar));
    document.getElementById('aylikGelirInput').value = '';
    showToast('✅ Aylık gelir kaydedildi!');
}

function sabitGiderEkle() {
    const ad       = document.getElementById('sabitAd').value.trim();
    const miktar   = document.getElementById('sabitMiktar').value;
    const kategori = document.getElementById('sabitKategori').value;
    if (!ad || !miktar) return showToast('Ad ve miktar gerekli.', 'error');
    ref('sabitGider').push({ ad, miktar: parseFloat(miktar), kategori, ts: Date.now() });
    document.getElementById('sabitAd').value = '';
    document.getElementById('sabitMiktar').value = '';
    showToast('✅ Sabit gider eklendi!');
}

function taksitEkle() {
    logEvent('item_add', { module: 'taksit' });
    const ad          = document.getElementById('taksitAd').value.trim();
    const aylikTutar  = document.getElementById('taksitTutar').value;
    const kalanTaksit = document.getElementById('taksitKalan').value;
    if (!ad || !aylikTutar || !kalanTaksit) return showToast('Tüm alanları doldurun.', 'error');
    ref('taksitler').push({ ad, aylikTutar: parseFloat(aylikTutar), kalanTaksit: parseInt(kalanTaksit), toplamTaksit: parseInt(kalanTaksit), ts: Date.now() });
    document.getElementById('taksitAd').value = '';
    document.getElementById('taksitTutar').value = '';
    document.getElementById('taksitKalan').value = '';
    showToast('✅ Taksit eklendi!');
}

function taksitOde(id, kalanTaksit) {
    const yeniKalan = kalanTaksit - 1;
    if (yeniKalan <= 0) {
        showConfirm(
            'Son taksit ödendi! Bu taksiti listeden kaldıralım mı?',
            () => { ref('taksitler/' + id).remove(); showToast('🎉 Taksit tamamen bitti!'); }
        );
    } else {
        ref('taksitler/' + id).update({ kalanTaksit: yeniKalan });
        showToast(`✅ Ödendi! ${yeniKalan} taksit kaldı.`);
    }
}

function butceEkle() {
    logEvent('item_add', { module: 'butce' });
    const aciklama = document.getElementById('butceAciklama').value.trim();
    const miktar   = document.getElementById('butceMiktar').value;
    const tur      = document.getElementById('butceTur').value;
    const kategori = document.getElementById('butceKategori').value;
    if (!aciklama || !miktar) return showToast('Açıklama ve miktar gerekli.', 'error');
    ref('butce').push({ aciklama, miktar: parseFloat(miktar), tur, kategori, ts: Date.now() });
    document.getElementById('butceAciklama').value = '';
    document.getElementById('butceMiktar').value = '';
    showToast('✅ İşlem eklendi!');
}

async function butceAiAnaliz() {
    const gelirSnap   = await ref('butce_gelir').once('value');
    const sabitSnap   = await ref('sabitGider').once('value');
    const taksitSnap  = await ref('taksitler').once('value');
    const harcamaSnap = await ref('butce').once('value');

    const gelir = Number(gelirSnap.val() || 0);
    let sabitler = [], taksitler = [], harcamalar = [];
    let sabitToplam = 0, taksitToplam = 0, giderToplam = 0;

    sabitSnap.forEach(c   => { const v = c.val(); sabitler.push(v.ad + ': ' + v.miktar + ' ₺'); sabitToplam += Number(v.miktar||0); });
    taksitSnap.forEach(c  => { const v = c.val(); taksitler.push(v.ad + ': ' + v.aylikTutar + ' ₺/ay, ' + v.kalanTaksit + ' taksit kaldı'); taksitToplam += Number(v.aylikTutar||0); });
    harcamaSnap.forEach(c => { const v = c.val(); if (v.tur !== 'gelir') { harcamalar.push(v.aciklama + ': ' + v.miktar + ' ₺'); giderToplam += Number(v.miktar||0); } });

    const el = document.getElementById('butceAiSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">📊 Bütçe analizi yapılıyor...</p>';

    const cevap = await callGemini(`Sen bir kişisel finans danışmanısın. Aşağıdaki aile bütçesini analiz et:\n\nAylık Net Gelir: ${gelir} ₺\nSabit Giderler (${sabitToplam} ₺): ${sabitler.join(', ') || 'yok'}\nTaksitler (${taksitToplam} ₺/ay): ${taksitler.join(', ') || 'yok'}\nDiğer Harcamalar (${giderToplam} ₺): ${harcamalar.slice(0,5).join(', ') || 'yok'}\nSerbest Para: ${gelir - sabitToplam - taksitToplam} ₺\nTaksit yük oranı: %${gelir > 0 ? Math.round((sabitToplam+taksitToplam)/gelir*100) : 0}\n\nLütfen şunları değerlendir:\n1. Genel bütçe sağlığı\n2. Tasarruf fırsatları\n3. Taksit yönetimi önerileri\n4. Somut ve uygulanabilir 3 öneri\n\nTürkçe, samimi ve pratik bir dille yaz.`);
    el.innerHTML = `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px;margin-top:10px;color:#15803d;line-height:1.7;font-size:13px;">${renderAiText(cevap)}</div>`;
}

// ==========================================
// 👗 KİYAFET / KOMBİN
// ==========================================
function loadKiyafet() {
    const refKiyafet = ref('kiyafet');
    refKiyafet.on('value', snap => {
        const list = document.getElementById('kiyafetList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) { list.innerHTML = '<p class="empty-msg">Gardırobunuz boş 👗<br>Kıyafetlerinizi ekleyin!</p>'; return; }
        list.innerHTML = items.map(item => `
            <div class="item-row">
                <div style="flex:1;">
                    <div style="font-weight:600;">${escapeHtml(item.ad)}</div>
                    <div style="font-size:12px;color:#888;">${item.kategori||''} ${item.renk ? '• '+item.renk : ''}</div>
                </div>
                <button onclick="deleteItem('kiyafet','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
            </div>`).join('');
    });
    return () => { refKiyafet.off('value'); };
}

function kiyafetEkle() {
    logEvent('item_add', { module: 'kombin' });
    const ad       = document.getElementById('kiyafetAd').value.trim();
    const kategori = document.getElementById('kiyafetKategori').value;
    const renk     = document.getElementById('kiyafetRenk').value.trim();
    if (!ad) return showToast('Kıyafet adı gerekli.', 'error');
    ref('kiyafet').push({ ad, kategori, renk, ts: Date.now() });
    document.getElementById('kiyafetAd').value = '';
    document.getElementById('kiyafetRenk').value = '';
    showToast('✅ Gardıroba eklendi!');
}

async function kombinOner() {
    const snap = await ref('kiyafet').once('value');
    const items = [];
    snap.forEach(c => items.push(c.val()));
    if (!items.length) return showToast('Önce gardırobunuza kıyafet ekleyin.', 'error');
    const hava     = document.getElementById('kombinHava').value || 'normal hava';
    const etkinlik = document.getElementById('kombinEtkinlik').value || 'günlük';
    const liste    = items.map(i => `${escapeHtml(i.ad)} (${i.kategori||''}, ${i.renk||''})`).join(', ');
    const el = document.getElementById('kombinSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">✨ Kombin hazırlanıyor...</p>';
    const cevap = await callGemini(`Sen bir moda danışmanısın. Gardıropta: ${liste}. Hava: ${hava}. Etkinlik: ${etkinlik}. Türkçe olarak 2 farklı kombin öner, her birini kısa açıkla.`);
    el.innerHTML = `<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:14px;margin-top:10px;color:#7c3aed;line-height:1.7;font-size:13px;">👗 ${renderAiText(cevap)}</div>`;
}

// ==========================================
// 🥗 DİYET MODÜLÜ
// ==========================================
function bugunKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function loadDiyet() {
    const bugun = bugunKey();
    const tarihEl = document.getElementById('diyetTarihGoster');
    if (tarihEl) tarihEl.textContent = tarihGoster(bugun);

    // Kalori ve su hedefini yükle
    ref('diyet_ayar').once('value', snap => {
        const v = snap.val() || {};
        if (v.kalioriHedef) document.getElementById('kHedef').value = v.kalioriHedef;
        if (v.suHedef) {
            document.getElementById('suHedef').value = v.suHedef;
            document.getElementById('suHedefGoster').textContent = v.suHedef + ' bardak';
        }
    });

    // Bugünkü öğünleri dinle
    const refOgunler = ref('diyet/' + bugun + '/ogunler');
    const refSu      = ref('diyet/' + bugun + '/su');
    refOgunler.on('value', snap => {
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        diyetOzetGuncelle(items);
        renderOgunler(items);
    });

    // Su sayacını dinle
    refSu.on('value', snap => {
        const su = snap.val() || 0;
        const suEl = document.getElementById('suSayacGoster');
        ref('diyet_ayar/suHedef').once('value', hs => {
            const hedef = hs.val() || '—';
            if (suEl) suEl.textContent = su + ' / ' + hedef + ' bardak';
        });
        renderSuBardaklar(su);
    });
    return () => {
        refOgunler.off('value');
        refSu.off('value');
    };
}

function diyetOzetGuncelle(items) {
    const toplamKalori = items.reduce((t, i) => t + Number(i.kalori || 0), 0);
    const ozet = document.getElementById('diyetOzet');
    if (!ozet) return;

    ref('diyet_ayar/kalioriHedef').once('value', snap => {
        const hedef = Number(snap.val() || 0);
        const kalan = hedef - toplamKalori;
        const oran  = hedef > 0 ? Math.min(Math.round((toplamKalori / hedef) * 100), 100) : 0;
        let barRenk = '#16a34a';
        if (oran >= 100) barRenk = '#dc2626';
        else if (oran >= 80) barRenk = '#f59e0b';

        ozet.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
                <div style="background:white;border-radius:12px;padding:10px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div style="font-size:10px;color:#888;font-weight:600;">Hedef</div>
                    <div style="font-size:18px;font-weight:800;color:#16a34a;">${hedef || '—'}</div>
                    <div style="font-size:10px;color:#888;">kcal</div>
                </div>
                <div style="background:white;border-radius:12px;padding:10px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div style="font-size:10px;color:#888;font-weight:600;">Tüketilen</div>
                    <div style="font-size:18px;font-weight:800;color:#f59e0b;">${toplamKalori}</div>
                    <div style="font-size:10px;color:#888;">kcal</div>
                </div>
                <div style="background:white;border-radius:12px;padding:10px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div style="font-size:10px;color:#888;font-weight:600;">${kalan >= 0 ? 'Kalan' : 'Aşım'}</div>
                    <div style="font-size:18px;font-weight:800;color:${kalan >= 0 ? '#16a34a' : '#dc2626'};">${Math.abs(kalan)}</div>
                    <div style="font-size:10px;color:#888;">kcal</div>
                </div>
            </div>
            <div style="margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#555;margin-bottom:4px;">
                    <span>Günlük İlerleme</span>
                    <span style="color:${barRenk};">%${oran}</span>
                </div>
                <div style="height:12px;background:#f3f4f6;border-radius:20px;overflow:hidden;">
                    <div style="height:100%;width:${oran}%;background:${barRenk};border-radius:20px;transition:width 0.5s ease;"></div>
                </div>
            </div>
            ${oran >= 100 ? `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px;font-size:13px;font-weight:700;color:#dc2626;margin-top:8px;">🚨 Günlük kalori hedefini aştın!</div>` : ''}
            ${oran >= 80 && oran < 100 ? `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:10px;font-size:13px;font-weight:700;color:#92400e;margin-top:8px;">⚠️ Hedefe yaklaşıyorsun, dikkat et!</div>` : ''}
        `;
    });
}

function renderOgunler(items) {
    const list = document.getElementById('ogunList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="empty-msg">Henüz öğün eklenmedi 🍽️</p>';
        return;
    }
    const gruplar = { kahvalti: [], ogle: [], aksam: [], ara: [] };
    const etiket  = { kahvalti: '🌅 Kahvaltı', ogle: '☀️ Öğle', aksam: '🌙 Akşam', ara: '🍎 Ara Öğün' };
    items.forEach(i => { if (gruplar[i.ogun]) gruplar[i.ogun].push(i); });

    list.innerHTML = Object.entries(gruplar).map(([key, ogunItems]) => {
        if (!ogunItems.length) return '';
        const toplam = ogunItems.reduce((t, i) => t + Number(i.kalori || 0), 0);
        return `<div class="card" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:14px;color:#374151;">${etiket[key]}</h4>
                <span style="font-size:13px;font-weight:700;color:#f59e0b;">${toplam} kcal</span>
            </div>
            ${ogunItems.map(i => `
                <div class="item-row" style="margin:0 0 6px;">
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:13px;">${escapeHtml(i.ad)}</div>
                        <div style="font-size:11px;color:#888;">${i.miktar ? i.miktar + ' gr/ml' : ''}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:700;color:#f59e0b;">${i.kalori} kcal</span>
                        <button onclick="ogunSil('${i.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;">🗑</button>
                    </div>
                </div>`).join('')}
        </div>`;
    }).join('');
}

function renderSuBardaklar(su) {
    const el = document.getElementById('suBardaklar');
    if (!el) return;
    ref('diyet_ayar/suHedef').once('value', snap => {
        const hedef = Number(snap.val() || 8);
        let html = '';
        for (let i = 0; i < hedef; i++) {
            html += `<span style="font-size:24px;opacity:${i < su ? '1' : '0.25'};">💧</span>`;
        }
        el.innerHTML = html;
    });
}

function kalioriHedefKaydet() {
    const hedef = document.getElementById('kHedef').value;
    if (!hedef) return showToast('Kalori hedefi girin.', 'error');
    ref('diyet_ayar/kalioriHedef').set(parseInt(hedef));
    showToast('✅ Kalori hedefi kaydedildi!');
    // Özeti güncelle
    ref('diyet/' + bugunKey() + '/ogunler').once('value', snap => {
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        diyetOzetGuncelle(items);
    });
}

function suHedefKaydet() {
    const hedef = document.getElementById('suHedef').value;
    if (!hedef) return showToast('Su hedefi girin.', 'error');
    ref('diyet_ayar/suHedef').set(parseInt(hedef));
    document.getElementById('suHedefGoster').textContent = hedef + ' bardak';
    showToast('✅ Su hedefi kaydedildi!');
}

function suIc() {
    const bugun = bugunKey();
    ref('diyet/' + bugun + '/su').once('value', snap => {
        const yeni = (snap.val() || 0) + 1;
        ref('diyet/' + bugun + '/su').set(yeni);
    });
}

function ogunEkle() {
    logEvent('item_add', { module: 'diyet' });
    const ad     = document.getElementById('yemekAd').value.trim();
    const kalori = document.getElementById('yemekKalori').value;
    const miktar = document.getElementById('yemekMiktar').value;
    const ogun   = document.getElementById('ogunTur').value;
    if (!ad || !kalori) return showToast('Yemek adı ve kalori gerekli.', 'error');
    ref('diyet/' + bugunKey() + '/ogunler').push({ ad, kalori: parseInt(kalori), miktar, ogun, ts: Date.now() })
        .then(() => {
            document.getElementById('yemekAd').value = '';
            document.getElementById('yemekKalori').value = '';
            document.getElementById('yemekMiktar').value = '';
            showToast('✅ Öğün eklendi!');
        });
}

function ogunSil(id) {
    ref('diyet/' + bugunKey() + '/ogunler/' + id).remove();
}

async function aiKaloriSor() {
    const ad = document.getElementById('yemekAd').value.trim();
    const miktar = document.getElementById('yemekMiktar').value || '1 porsiyon';
    if (!ad) return showToast('Önce yemek adını yazın.', 'error');
    const el = document.getElementById('aiKaloriSonuc');
    el.innerHTML = '<p style="font-size:12px;color:#888;padding:8px 0;">🤖 Kalori hesaplanıyor...</p>';
    const cevap = await callGemini(`Sen bir diyetisyen ve beslenme uzmanısın. "${ad}" yemeğinin ${miktar} için kalori değerini söyle. Sadece şu JSON formatında yanıt ver: {"kalori": sayı, "aciklama": "kısa açıklama"}. Başka hiçbir şey yazma.`);
    try {
        const parsed = JSON.parse(cevap.replace(/```json|```/g, '').trim());
        document.getElementById('yemekKalori').value = parsed.kalori;
        el.innerHTML = `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#15803d;">✅ Tahmini kalori: <b>${escapeHtml(String(parsed.kalori))} kcal</b> — ${escapeHtml(parsed.aciklama)}</div>`;
    } catch(e) {
        el.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#dc2626;">⚠️ Kalori tahmin edilemedi. Manuel girin.</div>`;
    }
}

async function yemekFotoOku(input) {
    const file = input.files[0];
    if (!file) return;
    const el = document.getElementById('yemekFotoSonuc');
    el.innerHTML = '<p style="font-size:12px;color:#92400e;padding:8px 0;">📸 Yemek analiz ediliyor...</p>';
    const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
    try {
        const prompt = 'Bu yemek fotoğrafını analiz et. Şu JSON formatında yanıt ver:\n{"ad":"yemek adı","kalori":tahmini kalori sayısı,"porsiyon":"porsiyon açıklaması","aciklama":"kısa besin bilgisi"}\nSadece JSON döndür.';
        const parsed = await callGeminiVision(prompt, base64, file.type || 'image/jpeg');
        document.getElementById('yemekAd').value    = parsed.ad || '';
        document.getElementById('yemekKalori').value = parsed.kalori || '';
        el.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#15803d;">✅ ' + escapeHtml(parsed.ad) + ' — ' + escapeHtml(String(parsed.kalori)) + ' kcal (' + escapeHtml(parsed.porsiyon) + ')<br><span style="color:#6b7280;">' + escapeHtml(parsed.aciklama) + '</span></div>';
    } catch(e) {
        el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#dc2626;">⚠️ Analiz edilemedi: ' + escapeHtml(e.message) + '</div>';
    }
    input.value = '';
}

// ==========================================
// 🚗 ARAÇ — Varlıklar'a taşındı
// ==========================================
// [FIX #1] loadArac() kaldırıldı, loaders map'ten çıkarıldı
async function aracAiSor() {
    const soru = document.getElementById('aracSoru').value.trim();
    if (!soru) return showToast('Sorunuzu yazın.', 'error');
    const el = document.getElementById('aracAiSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">🔧 Usta düşünüyor...</p>';
    const cevap = await callGemini('Sen deneyimli bir oto tamircisi ve sürücü danışmanısın. Şu soruya Türkçe ve pratik cevap ver: ' + soru);
    el.innerHTML = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-top:10px;color:#1d4ed8;line-height:1.7;font-size:13px;">🔧 ${renderAiText(cevap)}</div>`;
}

// ==========================================
// 🔧 TAMİRAT
// ==========================================
function loadTamirat() {
    const refTamirat = ref('tamirat');
    refTamirat.on('value', snap => {
        const list = document.getElementById('tamiratList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) { list.innerHTML = '<p class="empty-msg">Tamirat listesi boş 🔧</p>'; return; }
        const renkMap   = { acil: '#dc2626', orta: '#d97706', normal: '#16a34a' };
        const etiketMap = { acil: '🔴 Acil', orta: '🟡 Orta', normal: '🟢 Normal' };
        list.innerHTML = items.map(item => `
            <div class="item-row" style="${item.durum==='tamamlandi' ? 'opacity:0.5;' : ''}">
                <div style="flex:1;">
                    <div style="font-weight:600;${item.durum==='tamamlandi' ? 'text-decoration:line-through;' : ''}">${escapeHtml(item.is)}</div>
                    <div style="font-size:12px;color:${renkMap[item.oncelik]||'#888'};">${etiketMap[item.oncelik]||'🟢 Normal'} ${item.durum==='tamamlandi' ? '• ✅ Tamamlandı' : ''}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    ${item.durum!=='tamamlandi' ? `<button onclick="ref('tamirat/${item.id}').update({durum:'tamamlandi'})" style="background:#10b981;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">✓</button>` : ''}
                    <button onclick="deleteItem('tamirat','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                </div>
            </div>`).join('');
    });
    return () => { refTamirat.off('value'); };
}

function tamiratEkle() {
    logEvent('item_add', { module: 'tamirat' });
    const is      = document.getElementById('tamiratIs').value.trim();
    const oncelik = document.getElementById('tamiratOncelik').value;
    if (!is) return showToast('Tamirat işi yazın.', 'error');
    ref('tamirat').push({ is, oncelik, durum: 'bekliyor', ts: Date.now() });
    document.getElementById('tamiratIs').value = '';
    showToast('✅ Listeye eklendi!');
}

async function tamiratAiSor() {
    const soru = document.getElementById('tamiratSoru').value.trim();
    if (!soru) return showToast('Sorunuzu yazın.', 'error');
    const el = document.getElementById('tamiratAiSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:12px;">🔧 Asistan düşünüyor...</p>';
    const prompt = `Sen deneyimli bir ev tamiratçısısın. Şu soruya Türkçe, pratik ve anlaşılır cevap ver. Eğer kişi kendisi yapabilirse adımları açıkla; tehlikeli veya uzmanlık gerektiriyorsa usta çağırmasını tavsiye et: ${soru}`;
    const cevap = await callGemini(prompt);
    el.innerHTML = `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;margin-top:10px;color:#92400e;line-height:1.7;font-size:13px;">${renderAiText(cevap)}</div>`;
}

// ==========================================
// 🌿 BİTKİLER
// ==========================================
function loadBitkiler() {
    const refBitkiler = ref('bitkiler');
    refBitkiler.on('value', snap => {
        const list = document.getElementById('bitkilerList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) { list.innerHTML = '<p class="empty-msg">Henüz bitki eklenmedi 🌿</p>'; return; }
        list.innerHTML = items.map(item => `
            <div class="item-row">
                <div style="flex:1;">
                    <div style="font-weight:600;">🌱 ${escapeHtml(item.name)}</div>
                    <div style="font-size:12px;color:#888;">Son sulama: ${item.sonSulama || 'kayıt yok'}</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="sulamaKaydet('${item.id}')" style="background:#0ea5e9;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;">💧</button>
                    <button onclick="deleteItem('bitkiler','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                </div>
            </div>`).join('');
    });
    return () => { refBitkiler.off('value'); };
}

function sulamaKaydet(id) {
    logEvent('action', { module: 'bitkiler', action: 'sulama' });
    ref('bitkiler/' + id).update({ sonSulama: new Date().toLocaleDateString('tr-TR') });
    showToast('💧 Sulama kaydedildi!');
}

async function bitkiDanisAsistan() {
    const soru = document.getElementById('bitkiSoru').value.trim();
    if (!soru) return showToast('Sorunuzu yazın.', 'error');
    const el = document.getElementById('bitkiCevap');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">🌿 Bitki Doktoru düşünüyor...</p>';
    const cevap = await callGemini('Sen bir bitki bakım uzmanısın. Şu soruya Türkçe, pratik ve anlaşılır cevap ver: ' + soru);
    el.innerHTML = `<div style="background:#f0fff4;border:1px solid #86efac;border-radius:12px;padding:14px;margin-top:10px;color:#15803d;line-height:1.7;font-size:13px;">🌿 ${renderAiText(cevap)}</div>`;
}

// ==========================================
// 🐾 CANLAR
// ==========================================
async function loadCanlar() {
    if (!activePath) return;
    const DB = 'https://evdeki-hesap-6b079-default-rtdb.europe-west1.firebasedatabase.app';
    try {
        const token = await firebase.auth().currentUser.getIdToken();

        // Canlar
        const rC = await fetch(`${DB}/${activePath}/canlar.json?auth=${token}`);
        const dC = await rC.json();
        const listC = document.getElementById('canlarList');
        if (listC) {
            if (!dC) {
                listC.innerHTML = '<p class="empty-msg">Evcil hayvan eklenmedi 🐾</p>';
            } else {
                const items = Object.entries(dC).map(([k,v]) => ({ id: k, ...v }));
                const em = { kedi:'🐱', kopek:'🐶', kus:'🐦', balik:'🐟', diger:'🐾' };
                listC.innerHTML = items.map(item => `
                    <div class="item-row">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${em[item.tur]||'🐾'} ${escapeHtml(item.ad)}</div>
                            <div style="font-size:12px;color:#888;">${item.tur||''} ${item.dogumTarihi ? '🎂 ' + tarihGoster(item.dogumTarihi) : ''} ${item.sonVet ? '• 🏥 ' + tarihGoster(item.sonVet) : ''}</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button onclick="canlarDuzenle('${item.id}','${escapeHtml(item.ad)}','${item.tur||'diger'}','${item.dogumTarihi||''}','${item.sonVet||''}')" style="background:none;border:none;cursor:pointer;font-size:16px;">✏️</button>
                            <button onclick="canlarSil('${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                        </div>
                    </div>`).join('');
            }
        }

        // Takvim
        const rT = await fetch(`${DB}/${activePath}/canTakvim.json?auth=${token}`);
        const dT = await rT.json();
        const listT = document.getElementById('canTakvimList');
        if (listT) {
            if (!dT) {
                listT.innerHTML = '<p class="empty-msg">Takvim kaydı yok 📅</p>';
            } else {
                const items = Object.entries(dT).map(([k,v]) => ({ id: k, ...v }));
                const bugun = new Date().toISOString().split('T')[0];
                listT.innerHTML = items.reverse().map(item => `
                    <div class="item-row" style="${item.tarih === bugun ? 'background:#fff7ed;border-color:#fb923c;' : item.tarih < bugun ? 'opacity:0.5;' : ''}">
                        <div style="flex:1;">
                            <div style="font-weight:600;">${escapeHtml(item.isim)} — ${escapeHtml(item.islem)} ${item.tarih === bugun ? '🔔' : ''}</div>
                            <div style="font-size:12px;color:#888;">${tarihGoster(item.tarih)}</div>
                        </div>
                        <button onclick="deleteItem('canTakvim','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                    </div>`).join('');
            }
        }
    } catch(e) {
        console.error('loadCanlar hata:', e);
    }
}
function canlarSil(id) {
    if (!activePath) return;
    rtdb.ref(activePath + '/canlar/' + id).remove().then(() => setTimeout(loadCanlar, 300));
}

function canlarDuzenle(id, ad, tur, dogumTarihi, sonVet) {
    document.getElementById('editCanId').value          = id;
    document.getElementById('editCanAd').value          = ad;
    document.getElementById('editCanTur').value         = tur;
    document.getElementById('editCanDogumTarihi').value = dogumTarihi;
    document.getElementById('editCanSonVet').value      = sonVet;
    const modal = document.getElementById('canEditModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function canlarKaydet() {
    const id          = document.getElementById('editCanId').value;
    const ad          = document.getElementById('editCanAd').value.trim();
    const tur         = document.getElementById('editCanTur').value;
    const dogumTarihi = document.getElementById('editCanDogumTarihi').value;
    const sonVet      = document.getElementById('editCanSonVet').value;
    if (!id || !ad) return showToast('Ad boş olamaz.', 'error');
    rtdb.ref(activePath + '/canlar/' + id).update({ ad, tur, dogumTarihi, sonVet })
        .then(() => {
            canlarEditKapat();
            showToast('✅ ' + ad + ' güncellendi!');
            setTimeout(loadCanlar, 300);
        })
        .catch(err => showToast('Hata: ' + err.message, 'error'));
}

function canlarEditKapat() {
    const modal = document.getElementById('canEditModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
function canEkle() {
    logEvent('item_add', { module: 'canlar' });
    const adEl    = document.getElementById('canAd');
    const turEl   = document.getElementById('canTur');
    const vetEl   = document.getElementById('canSonVet');
    const dogumEl = document.getElementById('canDogumTarihi');

    const ad          = adEl ? adEl.value.trim() : '';
    const tur         = turEl ? turEl.value : 'diger';
    const sonVet      = vetEl ? vetEl.value : '';
    const dogumTarihi = dogumEl ? dogumEl.value : '';

    if (!ad) return showToast('Hayvan adı gerekli.', 'error');

    ref('canlar').push({ ad, tur, sonVet, dogumTarihi, ts: Date.now() })
        .then(() => {
            if (adEl)    adEl.value    = '';
            if (vetEl)   vetEl.value   = '';
            if (dogumEl) dogumEl.value = '';
            if (turEl)   turEl.value   = 'kedi';
            showToast('✅ ' + ad + ' eklendi!');
            setTimeout(loadCanlar, 500);
        })
        .catch(err => showToast('Hata: ' + err.message, 'error'));
}

function _renderCanlarOnce() {
    rtdb.ref(activePath + '/canlar').once('value').then(snap => {
        const list = document.getElementById('canlarList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg">Evcil hayvan eklenmedi 🐾</p>';
            return;
        }
        const em = { kedi:'🐱', kopek:'🐶', kus:'🐦', balik:'🐟', diger:'🐾' };
        list.innerHTML = items.map(item => `
            <div class="item-row">
                <div style="flex:1;">
                    <div style="font-weight:600;">${em[item.tur]||'🐾'} ${escapeHtml(item.ad)}</div>
                    <div style="font-size:12px;color:#888;">${item.tur||''} ${item.dogumTarihi ? '🎂 ' + tarihGoster(item.dogumTarihi) : ''} ${item.sonVet ? '• 🏥 ' + tarihGoster(item.sonVet) : ''}</div>
                </div>
<div style="display:flex;gap:6px;">
    <button onclick="canlarDuzenle('${item.id}','${escapeHtml(item.ad)}','${item.tur||'diger'}','${item.dogumTarihi||''}','${item.sonVet||''}')" style="background:none;border:none;cursor:pointer;font-size:16px;">✏️</button>
    <button onclick="deleteItem('canlar','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
</div>
            </div>`).join('');
    });
}

function canTakvimEkle() {
    const isim  = document.getElementById('canTakvimIsim').value.trim();
    const islem = document.getElementById('canTakvimIslem').value.trim();
    const tarih = document.getElementById('canTakvimTarih').value;
    if (!isim || !islem) return showToast('İsim ve işlem gerekli.', 'error');
    ref('canTakvim').push({ isim, islem, tarih, ts: Date.now() });
    document.getElementById('canTakvimIsim').value = '';
    document.getElementById('canTakvimIslem').value = '';
    document.getElementById('canTakvimTarih').value = '';
    showToast('✅ Takvime eklendi!');
}

// ==========================================
// ⚡ ENERJİ TASARRUFU TAKİBİ
// ==========================================
function loadEnerji() {
    // Birim fiyatı yükle
    ref('enerji_ayar/birimFiyat').once('value', snap => {
        const fiyat = snap.val();
        if (fiyat) {
            const el = document.getElementById('birimFiyat');
            if (el) el.value = fiyat;
            const gEl = document.getElementById('birimFiyatGoster');
            if (gEl) gEl.textContent = 'Kayıtlı birim fiyat: ' + fiyat + ' ₺/kWh';
        }
    });

    const refEnerji = ref('enerjiCihazlar');
    refEnerji.on('value', snap => {
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        _enerjiRender(items);
        _enerjiOzetGuncelle(items);
    });
    return () => { refEnerji.off('value'); };
}

function _enerjiOzetGuncelle(items) {
    const ozetEl = document.getElementById('enerjiOzet');
    if (!ozetEl) return;
    if (!items.length) { ozetEl.innerHTML = ''; return; }

    ref('enerji_ayar/birimFiyat').once('value', snap => {
        const fiyat = parseFloat(snap.val() || 0);
        let toplamKwh = 0;
        items.forEach(item => {
            const kwh = (parseFloat(item.watt || 0) * parseFloat(item.saat || 0) * 30) / 1000;
            toplamKwh += kwh;
        });
        const toplamMaliyet = toplamKwh * fiyat;
        const enCokTuketen = [...items]
            .sort((a, b) => {
                const kwhA = (parseFloat(a.watt||0) * parseFloat(a.saat||0) * 30) / 1000;
                const kwhB = (parseFloat(b.watt||0) * parseFloat(b.saat||0) * 30) / 1000;
                return kwhB - kwhA;
            }).slice(0, 3);

        ozetEl.innerHTML = `
        <div style="background:linear-gradient(135deg,#f26522,#d35400);border-radius:16px;padding:18px 20px;color:white;">
            <div style="font-size:12px;font-weight:700;opacity:.8;margin-bottom:10px;">⚡ AYLIK ENERJİ ÖZETİ</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:12px;text-align:center;">
                    <div style="font-size:22px;font-weight:900;">${toplamKwh.toFixed(1)}</div>
                    <div style="font-size:11px;opacity:.85;">kWh / ay</div>
                </div>
                <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:12px;text-align:center;">
                    <div style="font-size:22px;font-weight:900;">${fiyat > 0 ? toplamMaliyet.toLocaleString('tr-TR', {maximumFractionDigits:0}) + ' ₺' : '—'}</div>
                    <div style="font-size:11px;opacity:.85;">Tahmini maliyet</div>
                </div>
            </div>
            ${enCokTuketen.length ? `
            <div style="font-size:11px;font-weight:700;opacity:.8;margin-bottom:6px;">EN ÇOK TÜKETEN</div>
            ${enCokTuketen.map((item, i) => {
                const kwh = ((parseFloat(item.watt||0) * parseFloat(item.saat||0) * 30) / 1000).toFixed(1);
                return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                    <span>${i===0?'🥇':i===1?'🥈':'🥉'} ${escapeHtml(item.ad)}</span>
                    <span style="font-weight:700;">${kwh} kWh</span>
                </div>`;
            }).join('')}` : ''}
        </div>`;
    });
}

function _enerjiRender(items) {
    const list = document.getElementById('enerjiList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<p class="empty-msg">Henüz cihaz eklenmedi ⚡<br>Ev aletlerinizi ekleyerek tüketimi takip edin.</p>';
        return;
    }
    list.innerHTML = items.map(item => {
        const kwh    = ((parseFloat(item.watt||0) * parseFloat(item.saat||0) * 30) / 1000).toFixed(1);
        return `
        <div class="item-row" style="flex-direction:column;align-items:flex-start;gap:6px;padding:14px 15px;">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
                <div>
                    <div style="font-weight:700;font-size:14px;">⚡ ${escapeHtml(item.ad)}</div>
                    ${item.marka || item.model ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(item.marka||'')} ${escapeHtml(item.model||'')}</div>` : ''}
                </div>
                <button onclick="deleteItem('enerjiCihazlar','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;width:100%;">
                <span style="background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #fed7aa;">🔌 ${item.watt || '?'} W</span>
                <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #bfdbfe;">⏱ ${item.saat || '?'} saat/gün</span>
                <span style="background:#f0fdf4;color:#15803d;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #86efac;">📊 ${kwh} kWh/ay</span>
            </div>
        </div>`;
    }).join('');
}

function birimFiyatKaydet() {
    const fiyat = document.getElementById('birimFiyat').value;
    if (!fiyat) return showToast('Birim fiyat girin.', 'error');
    ref('enerji_ayar/birimFiyat').set(parseFloat(fiyat));
    document.getElementById('birimFiyatGoster').textContent = 'Kayıtlı birim fiyat: ' + fiyat + ' ₺/kWh';
    showToast('✅ Birim fiyat kaydedildi!');
    // Özeti güncelle
    ref('enerjiCihazlar').once('value', snap => {
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        _enerjiOzetGuncelle(items);
    });

}
async function geminiTarifeSor() {
    const el = document.getElementById('tarifeAiSonuc');
    el.innerHTML = '<p style="font-size:12px;color:#888;padding:8px 0;text-align:center;">🤖 Asistan tarifeleri derliyor...</p>';

    const prompt = `Sen bir enerji danışmanısın. Türkiye'deki güncel mesken (ev) elektrik tarifeleri hakkında bilgi ver.
Lütfen şunları kısa, öz ve anlaşılır bir şekilde açıkla:
1. Tek zamanlı tarife (Düşük tüketim 1. kademe ve yüksek tüketim 2. kademe yaklaşık birim fiyatları, vergiler dahil).
2. Çok zamanlı tarife (Gündüz, Puant, Gece yaklaşık fiyatları).
3. Kullanıcının kendi faturasında hangi tarifede olduğunu ve net birim fiyatını faturaya bakarak (Toplam Ödenecek Tutar / Toplam Tüketim kWh) nasıl kolayca hesaplayabileceği.
Kullanıcıya, kendisine en uygun olan fiyatı veya hesapladığı rakamı yukarıdaki kutucuğa manuel girmesi gerektiğini samimi bir dille hatırlat. Türkçe yaz.`;

    const cevap = await callGemini(prompt);
    
    // Yanıtı mavi şık bir kutu içinde gösteriyoruz
    el.innerHTML = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-top:10px;color:#1d4ed8;line-height:1.7;font-size:13px;">${renderAiText(cevap)}</div>`;
}
async function geminiWattTahmin() {
    const ad    = document.getElementById('enerjiCihazAd').value.trim();
    const marka = document.getElementById('enerjiMarka').value.trim();
    const model = document.getElementById('enerjiModel').value.trim();
    if (!ad) return showToast('Önce cihaz adını girin.', 'error');
    const el = document.getElementById('wattTahminSonuc');
    el.innerHTML = '<p style="font-size:12px;color:#888;padding:6px 0;">🤖 Gemini tahmin ediyor...</p>';
    const prompt = `Sen bir enerji uzmanısın. "${ad}${marka ? ' ' + marka : ''}${model ? ' ' + model : ''}" cihazının tipik güç tüketimini (watt) tahmin et.
Sadece şu JSON formatında yanıt ver: {"watt": sayı, "aciklama": "kısa açıklama (max 1 cümle)", "guven": "yuksek|orta|dusuk"}
Başka hiçbir şey yazma.`;
    const cevap = await callGemini(prompt);
    try {
        const parsed = JSON.parse(cevap.replace(/```json|```/g, '').trim());
        document.getElementById('enerjiWatt').value = parsed.watt;
        const guvenRenk = { yuksek: '#16a34a', orta: '#d97706', dusuk: '#dc2626' };
        el.innerHTML = `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;color:#15803d;">
            ✅ Tahmini: <b>${parsed.watt} W</b> — ${escapeHtml(parsed.aciklama)}
            <span style="color:${guvenRenk[parsed.guven]||'#888'};margin-left:6px;font-weight:700;">(${parsed.guven} güven)</span>
        </div>`;
    } catch(e) {
        el.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 10px;font-size:12px;color:#dc2626;">⚠️ Tahmin edilemedi. Watt değerini manuel girin.</div>`;
    }
}

function enerjiCihazEkle() {
    const ad    = document.getElementById('enerjiCihazAd').value.trim();
    const marka = document.getElementById('enerjiMarka').value.trim();
    const model = document.getElementById('enerjiModel').value.trim();
    const watt  = document.getElementById('enerjiWatt').value;
    const saat  = document.getElementById('enerjiSaat').value;
    if (!ad)   return showToast('Cihaz adı gerekli.', 'error');
    if (!watt) return showToast('Watt değeri gerekli.', 'error');
    if (!saat) return showToast('Günlük kullanım saati gerekli.', 'error');
    ref('enerjiCihazlar').push({
        ad, marka, model,
        watt: parseFloat(watt),
        saat: parseFloat(saat),
        ts: Date.now()
    });
    ['enerjiCihazAd','enerjiMarka','enerjiModel','enerjiWatt','enerjiSaat'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('wattTahminSonuc').innerHTML = '';
    showToast('✅ Cihaz eklendi!');
}

async function enerjiAiAnaliz() {
    const snap = await ref('enerjiCihazlar').once('value');
    const fiyatSnap = await ref('enerji_ayar/birimFiyat').once('value');
    const fiyat = parseFloat(fiyatSnap.val() || 0);
    const items = [];
    snap.forEach(c => items.push(c.val()));
    if (!items.length) return showToast('Önce cihaz ekleyin.', 'error');
    const el = document.getElementById('enerjiAiSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">⚡ Analiz yapılıyor...</p>';

    const cihazListesi = items.map(item => {
        const kwh = ((parseFloat(item.watt||0) * parseFloat(item.saat||0) * 30) / 1000).toFixed(1);
        return `${item.ad}${item.marka ? ' (' + item.marka + ')' : ''}: ${item.watt}W, ${item.saat} saat/gün, ${kwh} kWh/ay`;
    }).join('\n');

    let toplamKwh = 0;
    items.forEach(item => { toplamKwh += (parseFloat(item.watt||0) * parseFloat(item.saat||0) * 30) / 1000; });

    const prompt = `Sen bir enerji tasarrufu uzmanısın. Aşağıdaki ev cihazlarını analiz et:

${cihazListesi}

Toplam aylık tüketim: ${toplamKwh.toFixed(1)} kWh
${fiyat > 0 ? 'Birim fiyat: ' + fiyat + ' ₺/kWh → Tahmini maliyet: ' + (toplamKwh * fiyat).toFixed(0) + ' ₺/ay' : ''}

Lütfen şunları değerlendir:
1. Genel enerji tüketim yorumu
2. En çok tüketen cihazlar için somut tasarruf önerileri
3. Kullanım alışkanlıklarına dair pratik ipuçları
4. Tahmini tasarruf potansiyeli (₺/ay)

Türkçe, kısa ve uygulanabilir öneriler ver.`;

    const cevap = await callGemini(prompt);
    el.innerHTML = `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;margin-top:12px;color:#92400e;line-height:1.7;font-size:13px;">${renderAiText(cevap)}</div>`;
}

// ==========================================
// 💧 SU TASARRUF TAKİBİ
// ==========================================
function loadSu() {
    const refSu = ref('su_mesajlar');
    refSu.on('value', snap => {
        const el = document.getElementById('suMesajlari');
        if (!el) return;
        const msgs = [];
        snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
        if (!msgs.length) { el.innerHTML = '<p class="empty-msg">Su hakemi hazır 💧<br>Fatura bilgilerinizi girin!</p>'; return; }
        el.innerHTML = msgs.map(m => {
            const sinif = m.type === 'user' ? 'benim-mesajim' : 'bot-mesaji';
            return `<div class="mesaj-balonu ${sinif}">
                <div class="mesaj-yazani">${escapeHtml(m.kim || 'Kullanıcı')}</div>
                <div>${renderAiText(m.text)}</div>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    });
    return () => { refSu.off('value'); };
}

function suFaturasiKaydet() {
    const tonInput = document.getElementById('su-ton')?.value;
    const tlInput  = document.getElementById('su-tl')?.value;
    if (!tonInput || !tlInput) return showToast('Tüketim ve fatura tutarını girin.', 'error');
    const ton = parseFloat(tonInput);
    const idealTon = 12;
    const damacanaSayisi = Math.round(ton * 52.6);
    let sonuc = `Evinize bu ay <b>${damacanaSayisi} damacana</b> su girdi! 💧<br><br>`;
    if (ton <= idealTon) {
        sonuc += `🌟 <b>Harika!</b> İdeal tüketim seviyesindesiniz.`;
        suBekcisiBildir('Takdir', `${ton} m³ su tüketildi — ideal seviyede!`);
    } else {
        const fark = (ton - idealTon).toFixed(1);
        sonuc += `⚠️ İdeal tüketimin <b>${fark} m³</b> üzerindesiniz. Kaçak kontrolü yapmanızı öneririz.`;
        suBekcisiBildir('Uyarı', `${ton} m³ su tüketildi — idealin ${fark} m³ üzerinde!`);
    }
    const el = document.getElementById('damacana-sonuc');
    const kart = document.getElementById('damacana-karti');
    if (el) el.innerHTML = sonuc;
    if (kart) kart.style.display = 'block';
}

function suBekcisiBildir(tip, mesaj) {
    if (!activePath) return;
    const kim = localStorage.getItem('evdeki_displayName') || 'Aile Üyesi';
    ref('su_mesajlar').push({ text: `[${tip}] ${mesaj}`, kim, type: 'user', ts: Date.now() });
    aiSuHakemiCagir(tip, mesaj);
}

async function aiSuHakemiCagir(tip, mesaj) {
    const loadingRef = ref('su_mesajlar').push();
    await loadingRef.set({ text: '💧 Su Hakemi değerlendiriyor...', kim: '🤖 Su Hakemi', type: 'ai-loading', ts: Date.now() });
    const prompt = `Sen ailenin adil "Su Hakemi"sin. Şu bildirim geldi: "[${tip}] ${mesaj}". Uyarıysa tasarruf öneri ver, takdirse motive et. Kısa ve samimi Türkçe yanıt ver.`;
    const cevap = await callGemini(prompt);
    await loadingRef.remove();
    ref('su_mesajlar').push({ text: cevap, kim: '🤖 Su Hakemi', type: 'ai', ts: Date.now() });
}

// ==========================================
// 📱 DİJİTAL DENGE VE EKRAN SÜRESİ
// ==========================================
function loadDijital() {
    const refDijital = ref('dijital_mesajlar');
// Ailem'den kişileri yükle
ref('ailem').once('value', snap => {
    const select = document.getElementById('dijital-kisi');
    if (!select) return;
    // Mevcut options temizle (ilk "Kişi Seç..." hariç)
    while (select.options.length > 1) select.remove(1);
    const kisiler = [];
    snap.forEach(c => { const v = c.val(); if (v && v.name) kisiler.push(v.name); });
    if (!kisiler.length) {
        // Ailem modülü boşsa varsayılan seçenekler
        ['Anne', 'Baba', 'Çocuk'].forEach(k => {
            const opt = document.createElement('option');
            opt.value = k; opt.textContent = k;
            select.appendChild(opt);
        });
        return;
    }
    kisiler.forEach(isim => {
        const opt = document.createElement('option');
        opt.value = isim; opt.textContent = isim;
        select.appendChild(opt);
    });
});
    refDijital.on('value', snap => {
        const el = document.getElementById('dijitalMesajlari');
        if (!el) return;
        const msgs = [];
        snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
        if (!msgs.length) { el.innerHTML = '<p class="empty-msg">Dijital koçunuz hazır 📱<br>Ekran sürenizi kaydedin!</p>'; return; }
        el.innerHTML = msgs.map(m => {
            const sinif = m.type === 'user' ? 'benim-mesajim' : 'bot-mesaji';
            return `<div class="mesaj-balonu ${sinif}">
                <div class="mesaj-yazani">${escapeHtml(m.kim || 'Kullanıcı')}</div>
                <div>${renderAiText(m.text)}</div>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    });
    return () => { refDijital.off('value'); };
}

function ekranSuresiKaydet() {
    const kisi = document.getElementById('dijital-kisi')?.value;
    const sure = parseFloat(document.getElementById('dijital-sure')?.value);
    const el   = document.getElementById('dijital-sonuc');
    if (!kisi || isNaN(sure)) return showToast('Kişi seçin ve süreyi girin.', 'error');
    const idealSure = 3;
    let mesaj = `<b>${escapeHtml(kisi)}</b> bugün ekran karşısında <b>${sure} saat</b> geçirdi.<br>`;
    if (sure <= idealSure) {
        mesaj += `🌟 Harika! Dijital dengeyi koruyorsun.`;
        dijitalBekciBildir('Takdir', `${kisi} bugün ${sure} saat ekran kullandı — hedef tutturuldu!`);
    } else {
        const ceza = Math.ceil(sure - idealSure) * 10;
        mesaj += `⚠️ İdeal süreyi aştın! Dijital Kumbaraya <b>${ceza} ceza puanı</b> yazıldı.`;
        dijitalBekciBildir('Uyarı', `${kisi} bugün ${sure} saat ekran kullandı — kotayı aştı!`);
    }
    if (el) { el.innerHTML = mesaj; el.style.display = 'block'; }
}

let _orucZamanlayici;
let _gecenSaniye = 0;

function _guncelleKronometre() {
    _gecenSaniye++;
    const s = String(_gecenSaniye % 60).padStart(2,'0');
    const m = String(Math.floor((_gecenSaniye % 3600) / 60)).padStart(2,'0');
    const h = String(Math.floor(_gecenSaniye / 3600)).padStart(2,'0');
    const el = document.getElementById('oruc-kronometre');
    if (el) el.innerText = `${h}:${m}:${s}`;
}

function orucBaslat() {
    const baslat = document.getElementById('btn-oruc-baslat');
    const bitir  = document.getElementById('btn-oruc-bitir');
    if (baslat) baslat.style.display = 'none';
    if (bitir)  bitir.style.display  = 'inline-block';
    _gecenSaniye = 0;
    const el = document.getElementById('oruc-kronometre');
    if (el) el.innerText = '00:00:00';
    _orucZamanlayici = setInterval(_guncelleKronometre, 1000);
    dijitalBekciBildir('Takdir', 'Ekran Orucu başlatıldı! Telefonlar sepete gitti 📵');
}

function orucBitir() {
    clearInterval(_orucZamanlayici);
    const baslat = document.getElementById('btn-oruc-baslat');
    const bitir  = document.getElementById('btn-oruc-bitir');
    if (baslat) baslat.style.display = 'inline-block';
    if (bitir)  bitir.style.display  = 'none';
    const dakika = Math.floor(_gecenSaniye / 60);
    dijitalBekciBildir('Takdir', `Ekran Orucu sona erdi! ${dakika} dakika boyunca ekranlardan uzak kaldınız 🎉`);
}

function dijitalBekciBildir(tip, mesaj) {
    if (!activePath) return;
    const kim = localStorage.getItem('evdeki_displayName') || 'Aile Üyesi';
    ref('dijital_mesajlar').push({ text: `[${tip}] ${mesaj}`, kim, type: 'user', ts: Date.now() });
    aiDijitalHakemCagir(tip, mesaj);
}

async function aiDijitalHakemCagir(tip, mesaj) {
    const loadingRef = ref('dijital_mesajlar').push();
    await loadingRef.set({ text: '💭 Yaşam Koçu değerlendiriyor...', kim: '🤖 Yaşam Koçu', type: 'ai-loading', ts: Date.now() });
    const prompt = `Sen ailenin "Dijital Yaşam Koçu"sun. Şu bildirim geldi: "[${tip}] ${mesaj}". Uyarıysa nazikçe fırçala ve alternatif aktivite öner, takdirse motive et. Kısa ve samimi Türkçe yanıt ver.`;
    const cevap = await callGemini(prompt);
    await loadingRef.remove();
    ref('dijital_mesajlar').push({ text: cevap, kim: '🤖 Yaşam Koçu', type: 'ai', ts: Date.now() });
}

// ==========================================
// 📚 KÜTÜPHANE
// ==========================================
let _kutuphaneAktifFiltre = 'tumu';

const KAT_ETIKET = {
    kitap:    '📗 Kitap',    roman:   '📘 Roman',
    dergi:    '📰 Dergi',    akademik:'🎓 Akademik',
    dijital:  '💾 Dijital',  diger:   '📦 Diğer'
};
const DURUM_RENK = { okunacak:'#f59e0b', okunuyor:'#3b82f6', okundu:'#10b981' };
const DURUM_TEXT = { okunacak:'📖 Okunacak', okunuyor:'📗 Okunuyor', okundu:'✅ Okundu' };

function loadKutuphane() {
    // Form başta kapalı
    const form = document.getElementById('kutuphaneForm');
    if (form) form.style.display = 'none';

    const refKitaplar = ref('kitaplar');
    refKitaplar.on('value', snap => {
        const tumItems = [];
        snap.forEach(c => tumItems.push({ id: c.key, ...c.val() }));
        _kutuphaneRender(tumItems);
    });
    return () => { refKitaplar.off('value'); };
}

function _kutuphaneRender(tumItems) {
    // İstatistikler
    const statsEl = document.getElementById('kutuphaneStats');
    if (statsEl) {
        const oduncte = tumItems.filter(i => i.oduncKisi && !i.oduncIade).length;
        const stats = [
            { label: 'Toplam',   val: tumItems.length,                                     renk: '#6b7280', bg: '#f9fafb' },
            { label: 'Okunacak', val: tumItems.filter(i => i.durum==='okunacak').length,   renk: '#d97706', bg: '#fffbeb' },
            { label: 'Okunuyor', val: tumItems.filter(i => i.durum==='okunuyor').length,   renk: '#3b82f6', bg: '#eff6ff' },
            { label: 'Ödünçte',  val: oduncte,                                             renk: '#7c3aed', bg: '#faf5ff' },
        ];
        statsEl.innerHTML = stats.map(s => `
            <div style="background:${s.bg};border-radius:12px;padding:10px 6px;text-align:center;border:1px solid #e5e7eb;">
                <div style="font-size:18px;font-weight:800;color:${s.renk};">${s.val}</div>
                <div style="font-size:10px;color:#6b7280;font-weight:600;">${s.label}</div>
            </div>`).join('');
    }

    // Filtre uygula
    let items = tumItems;
    if (_kutuphaneAktifFiltre === 'odunc')    items = tumItems.filter(i => i.oduncKisi && !i.oduncIade);
    else if (_kutuphaneAktifFiltre !== 'tumu') items = tumItems.filter(i => i.durum === _kutuphaneAktifFiltre);

    const list = document.getElementById('kitaplarList');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<p class="empty-msg">Bu kategoride materyal yok 📚</p>';
        return;
    }

    list.innerHTML = items.map(item => {
        const oduncte = item.oduncKisi && !item.oduncIade;
        const turEtiket = KAT_ETIKET[item.tur] || '📗 Kitap';
        const durumRenk = oduncte ? '#7c3aed' : (DURUM_RENK[item.durum] || '#888');
        const durumText = oduncte ? '🤝 Ödünçte' : (DURUM_TEXT[item.durum] || '');
        const arkaPlan  = oduncte ? '#faf5ff' : (item.durum === 'okundu' ? '#f9fafb' : 'white');
        const kenarRenk = oduncte ? '#c4b5fd' : '#f1f1f1';

        return `<div class="item-row" style="background:${arkaPlan};border-color:${kenarRenk};flex-direction:column;align-items:flex-start;gap:6px;padding:14px 15px;">
            <!-- Üst satır: tür + başlık + butonlar -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:10px;font-weight:700;color:#9ca3af;margin-bottom:2px;">${escapeHtml(turEtiket)}</div>
                    <div style="font-weight:700;font-size:14px;color:#1f2937;${item.durum==='okundu'&&!oduncte?'text-decoration:line-through;color:#9ca3af;':''}">${escapeHtml(item.ad)}</div>
                    ${item.yazar ? `<div style="font-size:12px;color:#6b7280;margin-top:1px;">${escapeHtml(item.yazar)}${item.yayinYili ? ' · ' + escapeHtml(String(item.yayinYili)) : ''}${item.yayinevi ? ' · ' + escapeHtml(item.yayinevi) : ''}</div>` : ''}
                </div>
                <div style="display:flex;gap:5px;margin-left:8px;flex-shrink:0;">
                    <button onclick="kitapDetayAc('${item.id}')" style="background:#f3f4f6;border:none;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;" title="Düzenle">✏️</button>
                    <button onclick="deleteItem('kitaplar','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;padding:4px;" title="Sil">🗑</button>
                </div>
            </div>
            <!-- Alt satır: durum + etiketler + aksiyon -->
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;width:100%;">
                <span style="background:${durumRenk}18;color:${durumRenk};font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid ${durumRenk}40;">${durumText}</span>
                ${item.hediyeden ? `<span style="background:#fdf4ff;color:#9333ea;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;">🎁 ${escapeHtml(item.hediyeden)}</span>` : ''}
                ${oduncte ? `<span style="background:#faf5ff;color:#7c3aed;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;">👤 ${escapeHtml(item.oduncKisi)} · ${item.oduncTarih ? new Date(item.oduncTarih + 'T12:00:00').toLocaleDateString('tr-TR') : ''}</span>` : ''}
                ${item.notlar ? `<span style="font-size:11px;color:#6b7280;font-style:italic;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(item.notlar)}">📝 ${escapeHtml(item.notlar)}</span>` : ''}
            </div>
            <!-- Aksiyon butonları -->
            <div style="display:flex;gap:6px;width:100%;flex-wrap:wrap;">
                ${!oduncte && item.durum !== 'okundu' ? `<button onclick="kitapDurumGuncelle('${item.id}','${item.durum}')" style="background:#10b981;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">▶ ${item.durum==='okunacak'?'Okumaya Başla':'Okundu İşaretle'}</button>` : ''}
                ${!oduncte ? `<button onclick="oduncModalAc('${item.id}', '${escapeHtml(item.ad).replace(/'/g, "\\'").replace(/"/g, "&quot;")}')" style="background:#7c3aed;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">🤝 Ödünç Ver</button>` : `<button onclick="oduncIade('${item.id}')" style="background:#10b981;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">↩️ İade Alındı</button>`}
            </div>
        </div>`;
    }).join('');
}

function kutuphaneFiltrele(filtre, btn) {
    _kutuphaneAktifFiltre = filtre;
    document.querySelectorAll('#s-kutuphane .nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Mevcut veriyle tekrar render
    ref('kitaplar').once('value', snap => {
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        _kutuphaneRender(items);
    });
}

function kutuphaneFOrmuToggle() {
    const form  = document.getElementById('kutuphaneForm');
    const arrow = document.getElementById('kutuphaneFormArrow');
    if (!form) return;
    const gizli = form.style.display === 'none' || form.style.display === '';
    form.style.display   = gizli ? 'block' : 'none';
    if (arrow) arrow.style.transform = gizli ? 'rotate(180deg)' : '';
}

function kitapDurumGuncelle(id, mevcutDurum) {
    const siradaki = { okunacak: 'okunuyor', okunuyor: 'okundu' };
    ref('kitaplar/' + id).update({ durum: siradaki[mevcutDurum] || 'okundu' });
}

// ── Kapak / Barkod Fotoğrafı ile Otomatik Doldurma ──────────────
// 📖 Kitap Kapak Okuma (OCR)
async function kitapKapakOku(input) {
    logEvent('ai_use', { module: 'kutuphane_ai' });
    const file = input.files[0];
    if (!file) return;

    const sonucEl = document.getElementById('kapakTaramaSonuc');
    sonucEl.innerHTML = `<div style="background:#dbeafe;border-radius:8px;padding:10px;font-size:13px;color:#1d4ed8;font-weight:600;">
        <span style="display:inline-block;animation:shimmer 1.2s infinite;">📖 Kapak okunuyor, bilgiler çıkarılıyor...</span>
    </div>`;

    const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
    const mimeType = file.type || 'image/jpeg';
    const previewUrl = URL.createObjectURL(file);

    try {
        const prompt = `Bu fotoğraf bir kitap, dergi veya dijital materyale ait kapak ya da arka kapak görüntüsüdür.
Fotoğraftaki yazılı bilgileri okuyarak aşağıdaki JSON formatında yanıt ver:
{
  "ad": "materyalin tam adı",
  "yazar": "yazar veya editör adı (birden fazlaysa virgülle ayır)",
  "yayinevi": "yayınevi adı",
  "yayinYili": yıl sayısı veya null,
  "tur": "kitap | roman | dergi | akademik | dijital | diger",
  "guven": "yuksek | orta | dusuk"
}
Eğer bir bilgi görünmüyorsa veya okunamıyorsa null yaz. Sadece JSON döndür.`;
        
        // Backend API çağrısı
        const parsed = await callGeminiVision(prompt, base64, mimeType);

        const alEt = (id, deger) => {
            const el = document.getElementById(id);
            if (el && deger) el.value = deger;
        };

        alEt('kitapAd',       parsed.ad);
        alEt('kitapYazar',    parsed.yazar);
        alEt('kitapYayinevi', parsed.yayinevi);
        if (parsed.yayinYili) alEt('kitapYil', String(parsed.yayinYili));
        if (parsed.tur) {
            const turEl = document.getElementById('kitapTur');
            if (turEl) turEl.value = parsed.tur;
        }

        const guvenRenk = { yuksek: '#16a34a', orta: '#d97706', dusuk: '#dc2626' };
        const guvenText = { yuksek: '✅ Yüksek güven', orta: '⚠️ Orta güven — kontrol edin', dusuk: '⚠️ Düşük güven — lütfen kontrol edin' };
        const renk = guvenRenk[parsed.guven] || '#6b7280';
        const gMetin = guvenText[parsed.guven] || 'Kontrol edin';

        sonucEl.innerHTML = `
            <div style="display:flex;gap:10px;align-items:flex-start;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px;">
                <img src="${escapeHtml(previewUrl)}" style="width:52px;height:70px;object-fit:cover;border-radius:6px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:700;color:${renk};margin-bottom:4px;">${gMetin}</div>
                    ${parsed.ad       ? `<div style="font-size:12px;font-weight:600;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(parsed.ad)}</div>` : ''}
                    ${parsed.yazar    ? `<div style="font-size:11px;color:#6b7280;">${escapeHtml(parsed.yazar)}</div>` : ''}
                    ${parsed.yayinevi ? `<div style="font-size:11px;color:#6b7280;">${escapeHtml(parsed.yayinevi)}${parsed.yayinYili ? ' · ' + parsed.yayinYili : ''}</div>` : ''}
                    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">👆 Alanları yukarıda kontrol edip düzenleyebilirsiniz.</div>
                </div>
            </div>`;

    } catch(e) {
        sonucEl.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#dc2626;">
            ⚠️ Kapak okunamadı: ${escapeHtml(e.message)}<br>
            <span style="color:#6b7280;">Bilgileri manuel olarak girebilirsiniz.</span>
        </div>`;
    }
    input.value = ''; 
}

function kitapEkle() {
    logEvent('item_add', { module: 'kutuphane' });
    const ad        = document.getElementById('kitapAd')?.value?.trim() || '';
    const yazar     = document.getElementById('kitapYazar')?.value?.trim() || '';
    const yayinevi  = document.getElementById('kitapYayinevi')?.value?.trim() || '';
    const yayinYili = document.getElementById('kitapYil')?.value || null;
    const tur       = document.getElementById('kitapTur')?.value || 'kitap';
    const durum     = document.getElementById('kitapDurum')?.value || 'okunacak';
    const hediyeden = document.getElementById('kitapHediyeden')?.value?.trim() || '';
    const notlar    = document.getElementById('kitapNot')?.value?.trim() || '';
    if (!ad) return showToast('Materyal adı gerekli.', 'error');
    ref('kitaplar').push({ ad, yazar, yayinevi, yayinYili: yayinYili || null, tur, durum, hediyeden, notlar, ts: Date.now() });
    ['kitapAd','kitapYazar','kitapYayinevi','kitapYil','kitapHediyeden','kitapNot'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const turEl   = document.getElementById('kitapTur');
    const durumEl = document.getElementById('kitapDurum');
    if (turEl)   turEl.value   = 'kitap';
    if (durumEl) durumEl.value = 'okunacak';
    kutuphaneFOrmuToggle();
    showToast('✅ Kütüphaneye eklendi!');
}

// ── Ödünç işlemleri ────────────────────────────────────────────
function oduncModalAc(id, ad) {
    document.getElementById('oduncKitapId').value = id;
    document.getElementById('oduncKitapAd').textContent = ad;
    document.getElementById('oduncKisi').value  = '';
    // Bugünün tarihini varsayılan yap
    document.getElementById('oduncTarih').value = new Date().toISOString().split('T')[0];
    document.getElementById('oduncModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function oduncModalKapat() {
    document.getElementById('oduncModal').classList.add('hidden');
    document.body.style.overflow = '';
}

function oduncKaydet() {
    const id    = document.getElementById('oduncKitapId').value;
    const kisi  = document.getElementById('oduncKisi').value.trim();
    const tarih = document.getElementById('oduncTarih').value;
    if (!kisi) return showToast('Kişi adı gerekli.', 'error');
    ref('kitaplar/' + id).update({ oduncKisi: kisi, oduncTarih: tarih, oduncIade: null });
    oduncModalKapat();
    showToast('🤝 Ödünç kaydedildi: ' + kisi);
}

function oduncIade(id) {
    ref('kitaplar/' + id).update({ oduncKisi: null, oduncTarih: null, oduncIade: true });
    showToast('↩️ İade alındı, kayıt güncellendi.');
}

// ── Detay / Düzenleme Modalı ───────────────────────────────────
function kitapDetayAc(id) {
    ref('kitaplar/' + id).once('value', snap => {
        const v = snap.val();
        if (!v) return;
        document.getElementById('editKitapId').value          = id;
        document.getElementById('editKitapAd').value          = v.ad || '';
        document.getElementById('editKitapYazar').value       = v.yazar || '';
        document.getElementById('editKitapYayinevi').value    = v.yayinevi || '';
        document.getElementById('editKitapYil').value         = v.yayinYili || '';
        document.getElementById('editKitapTur').value         = v.tur || 'kitap';
        document.getElementById('editKitapDurum').value       = v.durum || 'okunacak';
        document.getElementById('editKitapHediyeden').value   = v.hediyeden || '';
        document.getElementById('editKitapNot').value         = v.notlar || '';
        document.getElementById('kitapDetayModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });
}

function kitapDetayKapat() {
    document.getElementById('kitapDetayModal').classList.add('hidden');
    document.body.style.overflow = '';
}

function kitapKaydet() {
    const id = document.getElementById('editKitapId').value;
    if (!id) return;
    const guncelleme = {
        ad:        document.getElementById('editKitapAd').value.trim(),
        yazar:     document.getElementById('editKitapYazar').value.trim(),
        yayinevi:  document.getElementById('editKitapYayinevi').value.trim(),
        yayinYili: document.getElementById('editKitapYil').value || null,
        tur:       document.getElementById('editKitapTur').value,
        durum:     document.getElementById('editKitapDurum').value,
        hediyeden: document.getElementById('editKitapHediyeden').value.trim(),
        notlar:    document.getElementById('editKitapNot').value.trim(),
    };
    if (!guncelleme.ad) return showToast('Materyal adı gerekli.', 'error');
    ref('kitaplar/' + id).update(guncelleme)
        .then(() => { kitapDetayKapat(); showToast('✅ Güncellendi!'); })
        .catch(err => showToast('⚠️ Hata: ' + err.message, 'error'));
}

// ==========================================
// 💳 ABONELİKLER
// ==========================================
function loadAbonelikler() {
    const refAbonelik = ref('abonelikler');
    refAbonelik.on('value', snap => {
        const list    = document.getElementById('aboneliklerList');
        const totalEl = document.getElementById('abonelikToplam');
        if (!list) return;
        const items = [];
        let toplam = 0;
        snap.forEach(c => { const v = c.val(); items.push({ id: c.key, ...v }); toplam += Number(v.ucret||0); });
        if (totalEl) totalEl.textContent = toplam.toLocaleString('tr-TR') + ' ₺/ay';
        if (!items.length) { list.innerHTML = '<p class="empty-msg">Abonelik kaydı yok 📺</p>'; return; }
        list.innerHTML = items.map(item => `
            <div class="item-row">
                <div style="flex:1;">
                    <div style="font-weight:600;">📱 ${escapeHtml(item.ad)}</div>
                    <div style="font-size:12px;color:#888;">${item.gun ? 'Her ay '+escapeHtml(item.gun)+'. günü ödenir' : ''} ${item.plan ? '• '+escapeHtml(item.plan) : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:#dc2626;">${Number(item.ucret||0).toLocaleString('tr-TR')} ₺</span>
                    <button onclick="deleteItem('abonelikler','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                </div>
            </div>`).join('');
    });
    return () => { refAbonelik.off('value'); };
}

function abonelikHizliEkle(platform) {
    document.getElementById('abonelikAd').value = platform;
    document.getElementById('abonelikAd').focus();
    showToast(platform + ' seçildi, ücreti girin.');
}

// [FIX #3] abonelikPlan artık HTML'de var ve doğru kaydediliyor
function abonelikEkle() {
    logEvent('item_add', { module: 'abonelik' });
    const ad    = document.getElementById('abonelikAd').value.trim();
    const ucret = document.getElementById('abonelikUcret').value;
    const gun   = document.getElementById('abonelikGun').value;
    const plan  = document.getElementById('abonelikPlan')?.value.trim() || '';
    if (!ad || !ucret) return showToast('Platform ve ücret gerekli.', 'error');
    ref('abonelikler').push({ ad, ucret: parseFloat(ucret), gun, plan, ts: Date.now() });
    document.getElementById('abonelikAd').value = '';
    document.getElementById('abonelikUcret').value = '';
    document.getElementById('abonelikGun').value = '';
    const planEl = document.getElementById('abonelikPlan');
    if (planEl) planEl.value = '';
    showToast('✅ Abonelik eklendi!');
}

// ==========================================
// 📅 AJANDA
// ==========================================
// [FIX #9] orderByChild kaldırıldı → Firebase index uyarısı yok, client-side sort
function loadAjanda() {
    const KAT_EMOJI = { genel:'📌', saglik:'🏥', okul:'🎒', is:'💼', aile:'👨‍👩‍👧‍👦', finans:'💰', diger:'📝' };
    const refAjanda = ref('ajanda');
    refAjanda.on('value', snap => {
        const list = document.getElementById('ajandaListesi');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        items.sort((a, b) => {
            const ta = (a.tarih||'') + (a.saat||'');
            const tb = (b.tarih||'') + (b.saat||'');
            return ta.localeCompare(tb);
        });
        if (!items.length) { list.innerHTML = '<p class="empty-msg">Ajanda boş 📅</p>'; return; }
        const bugun = new Date().toISOString().split('T')[0];
        list.innerHTML = items.map(item => `
            <div class="item-row" style="${item.tarih < bugun ? 'opacity:0.4;' : item.tarih === bugun ? 'background:#fff7ed;border-color:#fb923c;' : ''}">
                <div style="flex:1;">
                    <div style="font-weight:600;">${KAT_EMOJI[item.kategori]||'📌'} ${escapeHtml(item.etkinlik)} ${item.tarih === bugun ? '🔔' : ''}</div>
                    <div style="font-size:12px;color:#888;">${tarihGosterUzun(item.tarih)}${item.saat ? ' · ⏰ ' + item.saat : ''}</div>
                </div>
                <button onclick="deleteItem('ajanda','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
            </div>`).join('');
    });
    return () => { refAjanda.off('value'); };
}

function ajandayaEkle() {
    logEvent('item_add', { module: 'ajanda' });
    const etkinlik = document.getElementById('ajandaAd').value.trim();
    const tarih    = document.getElementById('ajandaTarih').value;
    const saat     = document.getElementById('ajandaSaat')?.value || '';
    const kategori = document.getElementById('ajandaKategori')?.value || 'genel';
    if (!etkinlik || !tarih) return showToast('Etkinlik adı ve tarih gerekli.', 'error');
    ref('ajanda').push({ etkinlik, tarih, saat, kategori, ts: Date.now() });
    document.getElementById('ajandaAd').value = '';
    document.getElementById('ajandaTarih').value = '';
    if (document.getElementById('ajandaSaat')) document.getElementById('ajandaSaat').value = '';
    showToast('✅ Ajandaya eklendi!');
}

// ==========================================
// 👨‍👩‍👧‍👦 AİLEM
// ==========================================
function loadAilem() {
    const listEl = document.getElementById('ailemList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="empty-msg">Yükleniyor...</p>';
    const refAilem = rtdb.ref(activePath + '/ailem');
    refAilem.on('value', snap => {
        const items = [];
        snap.forEach(c => { if (c.val()) items.push({ id: c.key, ...c.val() }); });
        if (!items.length) {
            listEl.innerHTML = '<p class="empty-msg">Aile profili eklenmedi 👨‍👩‍👧‍👦</p>';
            return;
        }
        const bugun = new Date();
        let html = '';
        for (const item of items) {
            let yasMetin = '';
            let dogumGunuUyari = '';
            try {
                if (item.dogumTarihi) {
                    const dt = new Date(item.dogumTarihi + 'T12:00:00');
                    const yas = bugun.getFullYear() - dt.getFullYear()
                        - (bugun < new Date(bugun.getFullYear(), dt.getMonth(), dt.getDate()) ? 1 : 0);
                    yasMetin = yas + ' yaşında';
                    const buYil = new Date(bugun.getFullYear(), dt.getMonth(), dt.getDate());
                    const fark = Math.round((buYil - bugun) / 86400000);
                    if (fark === 0) dogumGunuUyari = `<div style="background:#fff7ed;border:1.5px solid #fb923c;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;color:#c2410c;margin-top:6px;">🎂 Bugün doğum günü!</div>`;
                    else if (fark > 0 && fark <= 7) dogumGunuUyari = `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;color:#92400e;margin-top:6px;">🎂 ${fark} gün sonra doğum günü!</div>`;
                }
            } catch(e) {}

            const yakinlikEmoji = {'Eş':'💑','Çocuk':'👶','Anne':'👩','Baba':'👨','Kardeş':'🧑','Diğer':'👤'};
            const emoji = yakinlikEmoji[item.yakinlik] || '👤';

            html += `<div class="item-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
                <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
                    <div>
                        <span style="font-size:11px;color:var(--primary);font-weight:700;">${emoji} ${escapeHtml(item.yakinlik||'')}</span>
                        <div style="font-weight:700;font-size:15px;color:#1f2937;">${item.name||'İsimsiz'}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="aileEditAc('${item.id}')" style="background:#f3f4f6;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;">✏️</button>
                        <button onclick="deleteItem('ailem','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑</button>
                    </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;">
                    ${item.dogumTarihi ? `<span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;">🎂 ${tarihGoster(item.dogumTarihi)} · ${yasMetin}</span>` : ''}
                    ${item.kanGrubu ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;">🩸 ${escapeHtml(item.kanGrubu)}</span>` : ''}
                </div>
                ${item.ilac ? `<div style="font-size:12px;color:#7c3aed;margin-top:2px;">💊 <b>İlaç:</b> ${escapeHtml(item.ilac)}</div>` : ''}
                ${item.alerji ? `<div style="font-size:12px;color:#dc2626;margin-top:2px;">⚠️ <b>Alerji:</b> ${escapeHtml(item.alerji)}</div>` : ''}
                ${item.kisaBilgi ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">📝 ${escapeHtml(item.kisaBilgi)}</div>` : ''}
                ${dogumGunuUyari}
            </div>`;
        }
        listEl.innerHTML = html;
    });
    return () => { refAilem.off('value'); };
}


function ailemEkle() {
    logEvent('item_add', { module: 'ailem' });
    const name        = document.getElementById('aileAd').value.trim();
    const yakinlik    = document.getElementById('aileYakinlik').value;
    const dogumTarihi = document.getElementById('aileDogumTarihi').value;
    const kanGrubu    = document.getElementById('aileKanGrubu').value;
    const ilac        = document.getElementById('aileIlac').value.trim();
    const alerji      = document.getElementById('aileAlerji').value.trim();
    const kisaBilgi   = document.getElementById('aileKisaBilgi').value.trim();
    const note        = document.getElementById('aileNot').value.trim();
    if (!name) return showToast('Ad gerekli.', 'error');

    ref('ailem').push({ name, yakinlik, dogumTarihi, kanGrubu, ilac, alerji, kisaBilgi, note, ts: Date.now() })
        .then(() => {
            ['aileAd','aileIlac','aileAlerji','aileKisaBilgi','aileNot'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            document.getElementById('aileDogumTarihi').value = '';
            document.getElementById('aileKanGrubu').value = '';
            showToast('✅ Profil eklendi!');
        })
        .catch(err => showToast('⚠️ Kaydedilemedi: ' + err.message, 'error'));
}

function aileEditAc(id) {
    ref('ailem/' + id).once('value', snap => {
        const v = snap.val();
        if (!v) return;
        document.getElementById('editAileId').value        = id;
        document.getElementById('editAileAd').value        = v.name || '';
        document.getElementById('editAileYakinlik').value  = v.yakinlik || 'Diğer';
        document.getElementById('editAileDogumTarihi').value = v.dogumTarihi || '';
        document.getElementById('editAileKanGrubu').value  = v.kanGrubu || '';
        document.getElementById('editAileIlac').value      = v.ilac || '';
        document.getElementById('editAileAlerji').value    = v.alerji || '';
        document.getElementById('editAileKisaBilgi').value = v.kisaBilgi || '';
        document.getElementById('editAileNot').value       = v.note || '';
        document.getElementById('aileEditModal').classList.remove('hidden');
    });
}

function aileKaydet() {
    const id = document.getElementById('editAileId').value;
    if (!id) return;
    const guncelleme = {
        name:        document.getElementById('editAileAd').value.trim(),
        yakinlik:    document.getElementById('editAileYakinlik').value,
        dogumTarihi: document.getElementById('editAileDogumTarihi').value,
        kanGrubu:    document.getElementById('editAileKanGrubu').value,
        ilac:        document.getElementById('editAileIlac').value.trim(),
        alerji:      document.getElementById('editAileAlerji').value.trim(),
        kisaBilgi:   document.getElementById('editAileKisaBilgi').value.trim(),
        note:        document.getElementById('editAileNot').value.trim(),
    };
    if (!guncelleme.name) return showToast('Ad gerekli.', 'error');
    ref('ailem/' + id).update(guncelleme)
        .then(() => { aileEditKapat(); showToast('✅ Profil güncellendi!'); })
        .catch(err => showToast('⚠️ Güncellenemedi: ' + err.message, 'error'));
}

function aileEditKapat() {
    document.getElementById('aileEditModal').classList.add('hidden');
}

// Doğum günü uyarısı — uygulama açılışında kontrol
function dogumGunuUyariKontrol() {
    if (!activePath) return;
    const bugun = new Date();

    // Aile üyeleri
    ref('ailem').once('value', snap => {
        snap.forEach(c => {
            const v = c.val();
            if (!v.dogumTarihi) return;
            const dt = new Date(v.dogumTarihi + 'T12:00:00');
            const buYil = new Date(bugun.getFullYear(), dt.getMonth(), dt.getDate());
            const fark = Math.round((buYil - bugun) / 86400000);
            if (fark === 0) {
                showToast(`🎂 Bugün ${v.name}'in doğum günü!`, 'success');
                bildirimGonder('🎂 Doğum Günü!', `Bugün ${v.name}'in doğum günü! Kutlamayı unutma!`, 'dogumgunu-' + c.key);
            } else if (fark === 1) {
                showToast(`🎂 Yarın ${v.name}'in doğum günü!`, 'success');
                bildirimGonder('🎂 Yarın Doğum Günü!', `Yarın ${v.name}'in doğum günü. Hazırlıklarını yap!`, 'dogumgunu-' + c.key);
            } else if (fark <= 7 && fark > 1) {
                bildirimGonder('🎂 Yaklaşan Doğum Günü', `${fark} gün sonra ${v.name}'in doğum günü.`, 'dogumgunu-' + c.key);
            }
        });
    });

    // Evcil hayvanlar
    ref('canlar').once('value', snap => {
        snap.forEach(c => {
            const v = c.val();
            if (!v.dogumTarihi) return;
            const dt = new Date(v.dogumTarihi + 'T12:00:00');
            const buYil = new Date(bugun.getFullYear(), dt.getMonth(), dt.getDate());
            const fark = Math.round((buYil - bugun) / 86400000);
            if (fark === 0) {
                showToast(`🐾 Bugün ${v.ad}'in doğum günü!`, 'success');
                bildirimGonder('🐾 Hayvan Doğum Günü!', `Bugün ${v.ad}'in doğum günü!`, 'can-dogumgunu-' + c.key);
            } else if (fark === 1) {
                bildirimGonder('🐾 Yarın Doğum Günü!', `Yarın ${v.ad}'in doğum günü.`, 'can-dogumgunu-' + c.key);
            }
        });
    });
}

// Varlık uyarıları — garanti, bakım, muayene
function varlikUyariKontrol() {
    if (!activePath) return;
    ref('servetim').once('value', snap => {
        const bugun = new Date();
        snap.forEach(c => {
            const v = c.val();
            if (!v.ad) return;
            if (v.garantiBitis) {
                const fark = Math.round((new Date(v.garantiBitis + 'T12:00:00') - bugun) / 86400000);
                if (fark >= 0 && fark <= 30)
                    bildirimGonder('⚠️ Garanti Bitiyor — ' + v.ad, `${fark} gün içinde garanti süresi doluyor.`, 'garanti-' + c.key);
            }
            if (v.sonrakiBakim) {
                const fark = Math.round((new Date(v.sonrakiBakim + 'T12:00:00') - bugun) / 86400000);
                if (fark >= 0 && fark <= 14)
                    bildirimGonder('🔧 Bakım Zamanı — ' + v.ad, `${fark} gün içinde bakım tarihi geliyor.`, 'bakim-' + c.key);
                else if (fark < 0)
                    bildirimGonder('🔧 Bakım Gecikti! — ' + v.ad, 'Bakım tarihi geçti, en kısa sürede yapın.', 'bakim-' + c.key);
            }
            if (v.muayeneBitis) {
                const fark = Math.round((new Date(v.muayeneBitis + 'T12:00:00') - bugun) / 86400000);
                if (fark >= 0 && fark <= 30)
                    bildirimGonder('📋 Muayene Yaklaşıyor — ' + v.ad, `${fark} gün içinde muayene tarihi geliyor.`, 'muayene-' + c.key);
                else if (fark < 0)
                    bildirimGonder('🚨 Muayene Süresi Doldu! — ' + v.ad, 'Araç muayenesi gecikti, en kısa sürede yaptırın!', 'muayene-' + c.key);
            }
        });
    });
}

// ==========================================
// 💰 SERVETİM
// ==========================================
const VARLIK_KATEGORILER = {
    arac:          { label: '🚗 Araç',           renk: '#1d4ed8', arka: '#eff6ff' },
    beyazeşya:     { label: '🫧 Beyaz Eşya',     renk: '#0891b2', arka: '#ecfeff' },
    elektronik:    { label: '📺 Elektronik',      renk: '#374151', arka: '#f9fafb' },
    gayrimenkul:   { label: '🏠 Gayrimenkul',     renk: '#16a34a', arka: '#f0fdf4' },
    diger:         { label: '📦 Diğer',           renk: '#6b7280', arka: '#f9fafb' },
    yok:           { label: '🌳 Ağaçsızlar',      renk: '#92400e', arka: '#fffbeb' }
};

function loadVarliklar() {
    const refVarliklar = ref('servetim');
    refVarliklar.on('value', snap => {
        const list = document.getElementById('varliklarList');
        if (!list) return;
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        if (!items.length) {
            list.innerHTML = '<p class="empty-msg">💰 Henüz servetinize bir şey eklemediniz.<br>Araç, gayrimenkul, eşya, cihazlarınızı ekleyin!</p>';
            return;
        }
        const bugun = new Date();
        list.innerHTML = items.map(item => {
            const kat = VARLIK_KATEGORILER[item.kategori] || VARLIK_KATEGORILER.diger;
            const uyarilar = [];
            if (item.garantiBitis) {
                const fark = Math.round((new Date(item.garantiBitis + 'T12:00:00') - bugun) / 86400000);
                if (fark < 0)      uyarilar.push(`<span style="color:#dc2626;font-size:11px;font-weight:700;">⛔ Garanti bitti</span>`);
                else if (fark<=30) uyarilar.push(`<span style="color:#d97706;font-size:11px;font-weight:700;">⚠️ Garanti ${fark} gün kaldı</span>`);
            }
            if (item.sonrakiBakim) {
                const fark = Math.round((new Date(item.sonrakiBakim + 'T12:00:00') - bugun) / 86400000);
                if (fark < 0)      uyarilar.push(`<span style="color:#dc2626;font-size:11px;font-weight:700;">🔧 Bakım gecikti!</span>`);
                else if (fark<=14) uyarilar.push(`<span style="color:#d97706;font-size:11px;font-weight:700;">🔧 Bakım ${fark} gün kaldı</span>`);
            }
            if (item.muayeneBitis) {
                const fark = Math.round((new Date(item.muayeneBitis + 'T12:00:00') - bugun) / 86400000);
                if (fark < 0)      uyarilar.push(`<span style="color:#dc2626;font-size:11px;font-weight:700;">🚨 Muayene süresi doldu!</span>`);
                else if (fark<=30) uyarilar.push(`<span style="color:#f59e0b;font-size:11px;font-weight:700;">📋 Muayene ${fark} gün kaldı</span>`);
            }

            // Gayrimenkul satırları
            const gayrimenkulSatir = item.kategori === 'gayrimenkul' ? `
                ${item.konum    ? `<div style="font-size:12px;color:#6b7280;">📍 ${escapeHtml(item.konum)}</div>` : ''}
                ${item.metrekare ? `<div style="font-size:12px;color:#6b7280;">📐 ${item.metrekare} m²</div>` : ''}
                ${item.tapu     ? `<div style="font-size:12px;color:#6b7280;">📋 ${escapeHtml(item.tapu)}</div>` : ''}
                ${item.tahminiDeger && !isAile ? `<div style="font-size:13px;font-weight:700;color:#16a34a;">💰 ${Number(item.tahminiDeger).toLocaleString('tr-TR')} ₺</div>` : ''}
            ` : '';

            return `<div style="background:${kat.arka};border-left:4px solid ${kat.renk};border-radius:12px;padding:14px;margin:0 15px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="flex:1;">
                        <div style="font-size:11px;font-weight:700;color:${kat.renk};margin-bottom:3px;">${kat.label}</div>
                        <div style="font-weight:700;font-size:14px;color:#1f2937;">${escapeHtml(item.ad)}</div>
                        ${item.marka ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(item.marka)} ${item.model ? '• '+escapeHtml(item.model) : ''}</div>` : ''}
                        ${item.km ? `<div style="font-size:12px;color:#6b7280;">🛣️ ${Number(item.km).toLocaleString('tr-TR')} km</div>` : ''}
                        ${item.sarjSeviye ? `<div style="font-size:12px;color:#16a34a;">🔋 Şarj: %${item.sarjSeviye}</div>` : ''}
                        ${item.ariza ? `<div style="font-size:12px;color:#dc2626;margin-top:3px;">🚨 ${escapeHtml(item.ariza)}</div>` : ''}
                        ${gayrimenkulSatir}
                        ${uyarilar.length ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">${uyarilar.join('')}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="varlikDuzenle('${item.id}')" style="background:none;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;padding:4px 8px;color:#6b7280;">✏️</button>
                        <button onclick="deleteItem('servetim','${item.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;padding:2px;">🗑</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    });
    return () => { refVarliklar.off('value'); };
}

function varlikDuzenle(id) {
    ref('servetim').child(id).once('value', snap => {
        const v = snap.val();
        if (!v) return;
        const isGayrimenkul = v.kategori === 'gayrimenkul';
        const isArac        = v.kategori === 'arac';
        showConfirmCustom(`
            <h3 style="margin-bottom:14px;">✏️ Serveti Düzenle</h3>
            <input id="veAd"     class="ve-input" placeholder="Ad"    value="${escapeHtml(v.ad||'')}">
            <input id="veMarka"  class="ve-input" placeholder="Marka" value="${escapeHtml(v.marka||'')}">
            <input id="veModel"  class="ve-input" placeholder="Model / Yıl" value="${escapeHtml(v.model||'')}">
            ${isArac ? `
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">KM</label>
            <input id="veKm"   class="ve-input" type="number" placeholder="KM" value="${v.km||''}">
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">Şarj (%)</label>
            <input id="veSarj" class="ve-input" type="number" placeholder="%" value="${v.sarjSeviye||''}">
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">Muayene Bitiş</label>
            <input id="veMuayene" class="ve-input" type="date" value="${v.muayeneBitis||''}">
            <input id="veAriza" class="ve-input" placeholder="Arıza / Not" value="${escapeHtml(v.ariza||'')}">
            ` : ''}
            ${isGayrimenkul ? `
            <input id="veKonum" class="ve-input" placeholder="Konum" value="${escapeHtml(v.konum||'')}">
            <input id="veMetrekare" class="ve-input" type="number" placeholder="m²" value="${v.metrekare||''}">
            ${!isAile ? `
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">Tahmini Değer (₺)</label>
            <input id="veTahminiDeger" class="ve-input" type="number" placeholder="₺" value="${v.tahminiDeger||''}">
            ` : ''}
            ` : ''}
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">Garanti Bitiş</label>
            <input id="veGaranti" class="ve-input" type="date" value="${v.garantiBitis||''}">
            <label style="font-size:11px;color:#888;margin-bottom:3px;display:block;">Sonraki Bakım</label>
            <input id="veBakim" class="ve-input" type="date" value="${v.sonrakiBakim||''}">
            <style>.ve-input{width:100%;padding:10px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:10px;font-family:var(--font);font-size:13px;}</style>
        `, () => {
            const guncelleme = {
                ad:           document.getElementById('veAd').value.trim() || v.ad,
                marka:        document.getElementById('veMarka')?.value.trim() || '',
                model:        document.getElementById('veModel')?.value.trim() || '',
                garantiBitis: document.getElementById('veGaranti')?.value || '',
                sonrakiBakim: document.getElementById('veBakim')?.value || '',
                km:           document.getElementById('veKm')?.value ? parseInt(document.getElementById('veKm').value) : null,
                sarjSeviye:   document.getElementById('veSarj')?.value ? parseInt(document.getElementById('veSarj').value) : null,
                muayeneBitis: document.getElementById('veMuayene')?.value || '',
                ariza:        document.getElementById('veAriza')?.value.trim() || '',
                konum:        document.getElementById('veKonum')?.value.trim() || '',
                metrekare:    document.getElementById('veMetrekare')?.value ? parseInt(document.getElementById('veMetrekare').value) : null,
                tahminiDeger: (!isAile && document.getElementById('veTahminiDeger')?.value)
                                ? parseFloat(document.getElementById('veTahminiDeger').value) : null,
                kategori:     v.kategori,
                ts:           v.ts
            };
            ref('servetim').child(id).update(guncelleme);
            showToast('✅ Servet güncellendi!');
        }, 'Kaydet');
    });
}

function varlikEkle() {
    logEvent('item_add', { module: 'varlik' });
    const ad           = document.getElementById('varlikAd').value.trim();
    const kategori     = document.getElementById('varlikKategori').value;
    const marka        = document.getElementById('varlikMarka').value.trim();
    const model        = document.getElementById('varlikModel').value.trim();
    const garantiBitis = document.getElementById('varlikGaranti').value;
    const sonrakiBakim = document.getElementById('varlikBakim').value;
    const muayeneBitis = document.getElementById('varlikMuayene')?.value || '';
    const km           = document.getElementById('varlikKm')?.value || '';
    const sarjSeviye   = document.getElementById('varlikSarj')?.value || '';
    const ariza        = document.getElementById('varlikAriza')?.value.trim() || '';
    const konum        = document.getElementById('varlikKonum')?.value.trim() || '';
    const metrekare    = document.getElementById('varlikMetrekare')?.value || '';
    const tapu         = document.getElementById('varlikTapu')?.value || '';
    const tahminiDeger = (!isAile && document.getElementById('varlikTahminiDeger')?.value)
                            ? parseFloat(document.getElementById('varlikTahminiDeger').value) : null;

    if (!ad) return showToast('Varlık adı gerekli.', 'error');

    ref('servetim').push({
        ad, kategori, marka, model,
        garantiBitis, sonrakiBakim, muayeneBitis,
        km:          km         ? parseInt(km)         : null,
        sarjSeviye:  sarjSeviye ? parseInt(sarjSeviye) : null,
        ariza, konum, tapu,
        metrekare:   metrekare  ? parseInt(metrekare)  : null,
        tahminiDeger,
        ts: Date.now()
    });

    ['varlikAd','varlikMarka','varlikModel','varlikGaranti','varlikBakim',
     'varlikMuayene','varlikKm','varlikSarj','varlikAriza',
     'varlikKonum','varlikMetrekare','varlikTahminiDeger']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const tapuEl = document.getElementById('varlikTapu');
    if (tapuEl) tapuEl.value = '';

    showToast('✅ Servete eklendi!');
}

function varlikKategoriDegisti(kategori) {
    document.getElementById('aracAlanlari').style.display =
        kategori === 'arac' ? 'block' : 'none';
    document.getElementById('gayrimenkulAlanlari').style.display =
        kategori === 'gayrimenkul' ? 'block' : 'none';
    const tahmini = document.getElementById('tahminiBedelAlani');
    if (tahmini) tahmini.style.display =
        (kategori === 'gayrimenkul' && !isAile) ? 'block' : 'none';
}

async function varlikAiSor() {
    const soru = document.getElementById('varlikSoru').value.trim();
    if (!soru) return showToast('Sorunuzu yazın.', 'error');
    const el = document.getElementById('varlikAiSonuc');
    el.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">🔧 Asistan düşünüyor...</p>';
    const cevap = await callGemini('Sen bir teknik servis uzmanı ve gayrimenkul danışmanısın. Şu soruya Türkçe, pratik ve anlaşılır bir şekilde cevap ver: ' + soru);
    el.innerHTML = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-top:10px;color:#1d4ed8;line-height:1.7;font-size:13px;">${renderAiText(cevap)}</div>`;
}

// ==========================================
// ⚙️ AYARLAR
// ==========================================

// [FIX #2] Hesap silme butonu Ayarlar'a eklendi — fonksiyon zaten vardı
async function hesabiSil() {
    showConfirm(
        '⚠️ Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinizden emin misiniz?',
        () => showConfirm(
            '🚨 Son onay: TÜM VERİLERİNİZ SİLİNECEK. Bu işlem geri alınamaz!',
            () => {
                const sifre = prompt('Güvenlik için şifrenizi girin:');
                if (!sifre) return;
                const user = auth.currentUser;
                if (!user) return;
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, sifre);
                user.reauthenticateWithCredential(credential)
                    .then(async () => {
                        try {
                            if (activePath) await rtdb.ref(activePath).remove();
                            if (activePath !== user.uid) await rtdb.ref(user.uid).remove();
                            await user.delete();
                            ['evdeki_isim','evdeki_apiKey','evdeki_avatar','evdeki_sonGiris','cookieAccepted']
                                .forEach(k => localStorage.removeItem(k));
                            showToast('Hesabınız ve tüm verileriniz silindi.', 'error');
                        } catch (err) {
                            showToast('Hata: ' + err.message, 'error');
                        }
                    })
                    .catch(() => showToast('⚠️ Şifre yanlış. Hesap silinmedi.', 'error'));
            }
        )
    );
}

// ==========================================
// 🤖 YAPAY ZEKA — MERKEZİ SİSTEM (Firebase Functions)
// ==========================================
function _jsonParse(metin) {
    if (!metin) throw new Error('Boş yanıt');
    let temiz = metin.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const bas = temiz.indexOf('{');
    if (bas === -1) throw new Error('JSON bulunamadı');
    temiz = temiz.substring(bas);
    const son = temiz.lastIndexOf('}');
    const tam = son !== -1 ? temiz.substring(0, son + 1) : temiz;
    if (son !== -1) { try { return JSON.parse(tam); } catch(e1) {} }
    if (son !== -1) { try { const f = tam.replace(/"((?:[^"\\]|\\.)*)"/g, (_,v) => '"'+v.replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"'); return JSON.parse(f); } catch(e2) {} }
    try {
        let p = temiz.replace(/[\x00-\x1F\x7F]/g,' ').replace(/,\s*$/,'');
        if ((p.match(/"/g)||[]).length % 2 !== 0) p += '"';
        const o=(p.match(/{/g)||[]).length, c=(p.match(/}/g)||[]).length;
        for (let i=0;i<o-c;i++) p+='}';
        return JSON.parse(p);
    } catch(e3) { throw new Error('JSON Parse error: '+e3.message); }
}
// ==========================================
// 🪟 MODAL
// ==========================================
const modalContents = {
    gizlilik: `
        <h2>🔒 Şeffaflık Sözümüz</h2>
        <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">Evdeki Hesap olarak verilerinizin güvenliği bizim için en önemli önceliktir.</p>
        <h3>🔐 Uçtan Uca Şifreleme</h3>
        <p>Tüm verileriniz HTTPS üzerinden Google Firebase altyapısıyla Avrupa sunucularında (Belçika) saklanır.</p>
        <h3>🛡️ Üçüncü Partiler</h3>
        <p>Bilgileriniz <b>asla</b> reklam şirketlerine satılmaz veya paylaşılmaz.</p>
        <h3>⚙️ Kontrol Sizde</h3>
        <p>Hesabınızı ve tüm verilerinizi dilediğiniz an kalıcı olarak silebilirsiniz.</p>
        <h3>🚫 Reklama Tıklatmıyoruz</h3>
        <p>Evdeki Hesap olur olmaz karşınıza çıkan reklamlar yayınlamayacak.</p>
        <h3>🛑 Sakın Tıklamayın</h3>
        <p>Siz talep etmediğiniz sürece hiçbir zaman link göndermeyiz. Böyle bir mesaj alırsanız dolandırıcılık girişimi olabilir.</p>
        <h3>🤫 Özeliniz Size Özel</h3>
        <p>TC kimlik, banka bilgisi, sosyal medya şifresi gibi hassas bilgilerinizi <b>asla istemeyiz.</b></p>`,
    sozlesme: `
        <h2>📄 Kullanıcı Sözleşmesi</h2>
        <h3>Hizmet Tanımı</h3>
        <p>Evdeki Hesap, aile ve bireyler için dijital yaşam asistanlığı hizmeti sunan bir PWA uygulamasıdır.</p>
        <h3>Kullanım Koşulları</h3>
        <ul>
            <li>Uygulama 13 yaş üstü bireyler için tasarlanmıştır.</li>
            <li>Hesap güvenliğinizden siz sorumlusunuz.</li>
            <li>Uygulamayı kötüye kullanmamayı kabul edersiniz.</li>
        </ul>
        <h3>Sorumluluk Sınırı</h3>
        <p>AI önerileri bilgi amaçlıdır; finansal veya sağlık kararlarında profesyonellere danışınız.</p>`,
    sss: `
        <h2>❓ Sıkça Sorulan Sorular</h2>

        <h3>Cebimden para çıkacak mı?</h3>
        <p>Hayır! Evdeki Hesap olabildiğince <b>ücretsiz</b> tutulmaya çalışılan bir girişim. Zorunlu değil ama uygulamanın sürdürülebilirliğine katkı sağlamak isteyenler için isteğe bağlı <b>Evdeki Hesap Premium</b> seçeneği yakında eklenecek — tüm ödemeler Shopier altyapısıyla güvenli ve yasal şekilde gerçekleştirilecektir.</p>

        <h3>Aile modunu nasıl kullanırım?</h3>
        <p>Mod seçiminden Aile Grubu'na geçip bir grup adı ve şifresi belirleyin. Aynı bilgilerle giriş yapan herkes listeleri canlı olarak paylaşır.</p>

        <h3>İnternet olmadan çalışır mı?</h3>
        <p>Evet! PWA altyapımız sayesinde uygulama internetsiz de açılır. Değişiklikler internete bağlandığınızda otomatik senkronize olur.</p>

        <h3>🤖 AI özellikleri nasıl çalışıyor?</h3>
<p>Evdeki Hesap'ın yapay zeka özellikleri herhangi bir kurulum gerektirmez — ek bir şey yapmanıza gerek yok. AI asistan giriş yaptığınız anda tüm sekmelerde hazır olarak sizi bekler.</p>

        <h3>🔔 Bildirimleri nasıl açarım?</h3>
        <p>Uygulamaya ilk giriş yaptığınızda tarayıcı otomatik olarak bildirim izni sorar. <b>"İzin Ver"</b> demeniz yeterli. İzin verdiyseniz fatura son ödeme tarihleri, abonelik yenilemeleri ve alışveriş listesi güncellemeleri için bildirim alırsınız.</p>
        <p style="margin-top:6px;">İzni kaçırdıysanız: Tarayıcının adres çubuğunda sol taraftaki <b>kilit / bilgi ikonuna</b> tıklayın → <b>Bildirimler</b> → <b>İzin Ver</b> seçin → sayfayı yenileyin.</p>

        <h3>📵 Bildirim almak istemiyorum, nasıl kapatırım?</h3>
        <p>Tarayıcının adres çubuğunda kilit ikonuna tıklayın → Bildirimler → <b>Engelle</b> seçin.</p>

        <h3>🔄 Uygulama eski görünüyor, güncellenmiyor</h3>
        <p>Sayfayı kapatıp tekrar açın — çoğunlukla bu yeterlidir. Hâlâ eski görünüyorsa tarayıcıda <b>Ctrl+Shift+R</b> (Mac'te Cmd+Shift+R) ile sayfayı önbelleği temizleyerek yenileyin.</p>
        <p style="margin-top:6px;">Telefonda: Uygulamayı tamamen kapatıp yeniden açın.</p>

	<h3>💛 Uygulamayı nasıl destekleyebilirim?</h3>
        <p>Evdeki Hesap tamamen ücretsiz — hiçbir şey yapmanıza gerek yok. Ama sunucu maliyetleri, AI altyapısı gibi masrafları karşılamak için yakında <b>Evdeki Hesap Premium</b> eklenecek. İsteyenler 1 Aylık/3 Aylık Dijital Hizmet Aboneliği katkısıyla bu projenin büyümesine ortak olabilecek. 😊</p>

        <h3>🧩 Hangi sekmeleri göreceğimi seçebilir miyim?</h3>
        <p>Evet! <b>Ayarlar</b> sekmesine gidin — "Aktif Modüller" bölümünden istediğiniz sekmeleri açıp kapatabilirsiniz. Kapattığınız modüller kaybolmaz, arka planda dinlemeye devam eder; istediğiniz zaman geri açabilirsiniz.</p>

        <h3>Aksaklık ve öneriler için?</h3>
        <p><b>destek@evdekihesap.app</b> adresine yazabilirsiniz.</p>`,
    iletisim: `
        <h2>📬 İletişim</h2>
        <p>📧 <b>Dijital Asistan Hizmet Paketi:</b> destek@evdekihesap.app</p>
        <p style="margin-top:8px;">📣 <b>Reklam & İş Birliği:</b> admin@evdekihesap.app</p>
        <p style="margin-top:8px;">🌐 <b>Web:</b> evdekihesap.app</p>`,
    kurulum: `
        <h2>📲 Uygulamayı Telefona Kur</h2>
        <h3>📱 iPhone / iPad (Safari)</h3>
        <ul>
            <li>Safari'de evdekihesap.app adresini açın</li>
            <li>Paylaş butonuna (□↑) dokunun</li>
            <li>"Ana Ekrana Ekle"ye dokunun</li>
        </ul>
        <h3>🤖 Android (Chrome)</h3>
        <ul>
            <li>Chrome'da evdekihesap.app adresini açın</li>
            <li>Sağ üstteki ⋮ menüsüne dokunun</li>
            <li>"Ana ekrana ekle"ye dokunun</li>
        </ul>
        <h3>🔔 Bildirimleri Açın</h3>
        <p>Uygulamaya ilk girişinizde tarayıcı bildirim izni soracak — <b>"İzin Ver"</b> demeniz yeterli.</p>
        <p style="margin-top:8px;">Bildirimler sayesinde şunları alırsınız:</p>
        <ul style="margin-top:6px;">
            <li>🧾 Fatura ve taksit son ödeme hatırlatmaları</li>
            <li>💳 Abonelik yenileme uyarıları</li>
            <li>🛒 Alışveriş listesi güncellemeleri</li>
            <li>🎂 Doğum günü hatırlatmaları</li>
        </ul>
        <p style="margin-top:10px;color:#888;font-size:13px;">İzin kutusunu kaçırdıysanız: Adres çubuğundaki kilit ikonuna tıklayın → Bildirimler → İzin Ver → sayfayı yenileyin.</p>`
};

function epostaCopyYap(adres) {
    navigator.clipboard.writeText(adres)
        .then(() => showToast('📋 Kopyalandı: ' + adres))
        .catch(() => showToast(adres, 'success')); // kopyalama başarısız olursa toast'ta göster
}

function openModal(tip) {
    const overlay = document.getElementById('modalOverlay');
    const body    = document.getElementById('modalBody');
    if (!overlay || !body) return;
    body.innerHTML = modalContents[tip] || '<p>İçerik bulunamadı.</p>';
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ==========================================
// ⌨️ ENTER TUŞU DESTEĞİ
// ==========================================
function _setupEnterListeners() {
    const pairs = [
        ['mInp',           () => addItem('market', { text: document.getElementById('mInp').value }, 'mInp')],
        ['ajandaAd',       ajandayaEkle],
        ['yeniMesajInput', mesajGonder],
        ['bitkiSoru',      bitkiDanisAsistan],
        ['aracSoru',       aracAiSor],
        ['tamiratIs',      tamiratEkle],
        ['kitapAd',        kitapEkle],
        ['oduncKisi',     oduncKaydet],
        ['butceAciklama',  butceEkle]
    ];
    pairs.forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keypress', e => { if (e.key === 'Enter') fn(); });
    });
}

// ==========================================
// 👤 AVATAR SİSTEMİ
// ==========================================

// DiceBear API - ücretsiz, telif gerektirmez
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';

const AVATAR_STYLES = {
    kadin:  { style: 'adventurer',      seed: 'kadin-default',  bg: '#fce7f3' },
    erkek:  { style: 'adventurer-neutral', seed: 'erkek-default', bg: '#eff6ff' },
    kiz:    { style: 'adventurer',      seed: 'kiz-default',    bg: '#fdf4ff' },
    oglan:  { style: 'adventurer-neutral', seed: 'oglan-default', bg: '#f0fdf4' },
    notr:   { style: 'adventurer-neutral', seed: 'notr-default',  bg: '#f9fafb' },
    robot:  { style: 'bottts-neutral',  seed: 'robot-default',  bg: '#fff7ed' },
};

function avatarTikla() {
    document.getElementById('avatarFileInput').click();
}

function avatarDosyaSecildi(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const srcImg = new Image();
        srcImg.onload = () => {
            // 200×200 canvas ile yeniden boyutlandır + sıkıştır (~15KB)
            const MAX = 200;
            let w = srcImg.width, h = srcImg.height;
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(srcImg, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.75);
            _avatarGoster(base64, 'photo');
            _avatarKaydet({ type: 'photo', data: base64 });
        };
        srcImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function defaultAvatarSec(tip) {
    const cfg = AVATAR_STYLES[tip];
    if (!cfg) return;
    const url = `${DICEBEAR_BASE}/${cfg.style}/svg?seed=${cfg.seed}&backgroundColor=${cfg.bg.replace('#','')}`;
    _avatarGoster(url, 'dicebear');
    _avatarKaydet({ type: 'dicebear', url, bg: cfg.bg });
}

function _avatarGoster(src, type) {
    const img  = document.getElementById('avatarImg');
    const wrap = document.getElementById('avatarSvgWrap');
    if (!img || !wrap) return;
    img.onerror = () => { img.style.display = 'none'; wrap.style.display = 'flex'; };
    if (type === 'photo') {
        img.src = src;
        img.style.display = 'block';
        wrap.style.display = 'none';
    } else {
        img.src = src;
        img.style.display = 'block';
        wrap.style.display = 'none';
    }
    // header'daki küçük avatar
    const hAvatar = document.getElementById('headerAvatar');
    if (hAvatar) {
        hAvatar.style.backgroundImage = `url('${src}')`;
        hAvatar.style.backgroundSize = 'cover';
        hAvatar.textContent = '';
    }
}

function _avatarKaydet(obj) {
    // localStorage'a kaydet
    try {
        localStorage.setItem('evdeki_avatar', JSON.stringify(obj));
    } catch(e) {
        showToast('Fotoğraf kaydedilemedi, depolama dolu olabilir.', 'error');
    }
    // Firebase'e de kaydet (sıkıştırılmış foto ~15KB, dicebear URL küçük — ikisi de güvenli)
    if (auth.currentUser) {
        const val = obj.type === 'photo' ? obj.data : obj.url;
        if (val) rtdb.ref(auth.currentUser.uid + '/avatarUrl').set(val);
    }
}

function avatarYukle() {
    if (auth.currentUser) {
        rtdb.ref(auth.currentUser.uid + '/avatarUrl').once('value', snap => {
            const val = snap.val();
            if (val) {
                // data:image = sıkıştırılmış foto, değilse dicebear URL
                const type = val.startsWith('data:image') ? 'photo' : 'dicebear';
                _avatarGoster(val, type);
                return;
            }
            _avatarLocaldenYukle();
        });
    } else {
        _avatarLocaldenYukle();
    }
}

function _avatarLocaldenYukle() {
    try {
        const stored = localStorage.getItem('evdeki_avatar');
        if (stored) {
            const obj = JSON.parse(stored);
            _avatarGoster(obj.data || obj.url, obj.type);
        }
    } catch(e) {}
}

// ==========================================
// 👤 AVATAR MİNİ MENÜ & ÇIKIŞ
// ==========================================
function toggleAvatarMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('avatarMenu');
    if (menu) menu.classList.toggle('hidden');
}

// Ekranda menü dışına tıklanınca menüyü otomatik kapat
document.addEventListener('click', (e) => {
    const menu = document.getElementById('avatarMenu');
    // Eğer menü açıksa ve tıklanan yer menünün kendisi veya header avatarı değilse kapat
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#avatarMenu')) {
        menu.classList.add('hidden');
    }
});

function cikisYap() {
    showConfirm('Evdeki Hesap\'tan çıkış yapmak istediğinize emin misiniz?', () => {
        auth.signOut().then(() => {
            showToast('Çıkış yapıldı 👋');
            // auth.onAuthStateChanged otomatik olarak giriş ekranına yönlendirecek
        }).catch(err => showToast('Çıkış hatası: ' + err.message, 'error'));
    });
}

// ==========================================
// 📤 PAYLAŞ — Web Share API + Fallback Modal
// ==========================================
async function paylas(baslik, metin) {
    const tamMetin = metin + '\n\n🏡 evdekihesap.app';
    if (navigator.share) {
        try {
            await navigator.share({ title: baslik, text: tamMetin, url: 'https://evdekihesap.app' });
            return;
        } catch(e) { if (e.name === 'AbortError') return; }
    }
    _paylasModal(baslik, tamMetin);
}

function _paylasModal(baslik, metin) {
    const wUrl = 'https://wa.me/?text=' + encodeURIComponent(metin);
    const mUrl = 'mailto:?subject=' + encodeURIComponent(baslik) + '&body=' + encodeURIComponent(metin);
    const body    = document.getElementById('modalBody');
    const overlay = document.getElementById('modalOverlay');
    if (!body || !overlay) return;
    const tUrl = 'https://t.me/share/url?url=https%3A%2F%2Fevdekihesap.app&text=' + encodeURIComponent(metin);
    body.innerHTML = `
        <h2>📤 Paylaş</h2>
        <div style="background:#f9fafb;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#374151;line-height:1.7;white-space:pre-wrap;max-height:120px;overflow-y:auto;">${escapeHtml(metin)}</div>
        <a href="${escapeHtml(wUrl)}" target="_blank" rel="noopener" class="btn" style="background:#25d366;color:white;margin-bottom:8px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;">💬 WhatsApp ile Gönder</a>
        <a href="${escapeHtml(tUrl)}" target="_blank" rel="noopener" class="btn" style="background:#229ED9;color:white;margin-bottom:8px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;">✈️ Telegram ile Gönder</a>
        <a href="${escapeHtml(mUrl)}" class="btn" style="background:#4285f4;color:white;margin-bottom:8px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;">📧 E-posta ile Gönder</a>
        <button id="_paylasKopyalaBtn" class="btn" style="background:#374151;color:white;">📋 Panoya Kopyala</button>
    `;
    document.getElementById('_paylasKopyalaBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(metin)
            .then(() => { showToast('📋 Kopyalandı!'); closeModal(); })
            .catch(() => showToast('Kopyalanamadı.', 'error'));
    });
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function headerPaylas() {
    const tab = document.querySelector('.nav-btn.active')?.dataset?.tab || '';
    const dispatch = { market: marketPaylas, butce: butcePaylas, tatil: tatilPaylas, tamirat: tamiratPaylas, ajanda: ajandaPaylas };
    if (dispatch[tab]) dispatch[tab]();
    else paylas('Evdeki Hesap \u2014 Dijital Ev Asistanı',
        '🏡 Evdeki Hesap\'ı keşfettim, sana da tavsiye etmek istedim!\n\n' +
        'Alışveriş listesi, aile bütçesi, abonelik takibi, AI asistan ve çok daha fazlası. Ücretsiz, reklamsız, veriler sende.\n\n' +
        '👉 evdekihesap.app\n' +
        '📸 instagram.com/evdekihesapapp');
}

async function tavsiyeEt() {
    const isim = localStorage.getItem('evdeki_displayName') || '';
    const gonderen = isim ? isim + ' sana ' : '';
    const metin =
'🏡 ' + gonderen + 'Evdeki Hesap\'ı öneriyor!\n\n' +
'Ücretsiz, reklamsız, veriler sende — alışveriş listesi, aile bütçesi, abonelik takibi, AI asistan ve çok daha fazlası. İndirme yok, yer kaplamaz.\n\n' +
'👉 evdekihesap.app\n\n' +
'Bizi takip edin:\n' +
'📸 instagram.com/evdekihesapapp\n' +
'▶️ youtube.com/@EvdekiHesapApp\n\n' +
'"çarşıya uysun diye!" 🛒';
    await paylas('Evdeki Hesap\'ı Dene!', metin);
}

async function marketPaylas() {
    const snap = await ref('market').once('value');
    const bekleyen = [], alinan = [];
    snap.forEach(c => { const v = c.val(); (v.done ? alinan : bekleyen).push('• ' + v.text); });
    if (!bekleyen.length && !alinan.length) return showToast('Liste boş.', 'error');
    let metin = '🛒 Alışveriş Listem\n';
    if (bekleyen.length) metin += '\nAlınacaklar:\n' + bekleyen.join('\n');
    if (alinan.length)   metin += '\n\nAlınanlar ✓:\n' + alinan.join('\n');
    await paylas('Alışveriş Listesi', metin);
}

async function butcePaylas() {
    const [gelirSnap, sabitSnap, taksitSnap] = await Promise.all([ref('butce_gelir').once('value'), ref('sabitGider').once('value'), ref('taksitler').once('value')]);
    const gelir = Number(gelirSnap.val() || 0);
    let sabitT = 0, taksitT = 0;
    sabitSnap.forEach(c  => sabitT  += Number(c.val().miktar     || 0));
    taksitSnap.forEach(c => taksitT += Number(c.val().aylikTutar || 0));
    const metin = `💰 Bütçe Özetim\n\nAylık Gelir:      ${gelir.toLocaleString('tr-TR')} ₺\nSabit Giderler:   ${sabitT.toLocaleString('tr-TR')} ₺\nTaksit Yükü:      ${taksitT.toLocaleString('tr-TR')} ₺\n──────────────────\nSerbest Pay:      ${(gelir-sabitT-taksitT).toLocaleString('tr-TR')} ₺`;
    await paylas('Bütçe Özeti', metin);
}

async function tatilPaylas() {
    const snap = await ref('tatilMesajlar').once('value');
    const aiMsgs = [];
    snap.forEach(c => { if (c.val().type === 'ai') aiMsgs.push(c.val().text); });
    if (!aiMsgs.length) return showToast('Paylaşılacak tatil planı yok.', 'error');
    const son = aiMsgs[aiMsgs.length - 1].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    await paylas('Tatil Planım', '✈️ Tatil Planım\n\n' + son);
}

async function tamiratPaylas() {
    const snap = await ref('tamirat').once('value');
    const bekleyen = [], tamamlanan = [];
    snap.forEach(c => { const v = c.val(); (v.durum === 'tamamlandi' ? tamamlanan : bekleyen).push('• ' + v.is); });
    if (!bekleyen.length && !tamamlanan.length) return showToast('Liste boş.', 'error');
    let metin = '🔧 Tamirat Listesi\n';
    if (bekleyen.length)   metin += '\nYapılacaklar:\n' + bekleyen.join('\n');
    if (tamamlanan.length) metin += '\n\nTamamlananlar ✓:\n' + tamamlanan.join('\n');
    await paylas('Tamirat Listesi', metin);
}

async function ajandaPaylas() {
    const snap = await ref('ajanda').once('value');
    const items = [];
    snap.forEach(c => { const v = c.val(); if (v.tarih >= new Date().toISOString().split('T')[0]) items.push(`📅 ${tarihGoster(v.tarih)} — ${v.etkinlik}`); });
    if (!items.length) return showToast('Yaklaşan etkinlik yok.', 'error');
    items.sort();
    await paylas('Ajandamdakiler', '📅 Ajandamdakiler\n\n' + items.join('\n'));
}

// ==========================================
// 🍪 ÇEREZ BİLDİRİMİ
// ==========================================
window.addEventListener('load', () => {
    if (!localStorage.getItem('cookieAccepted')) {
        setTimeout(() => document.querySelector('.cookie-banner')?.classList.add('show'), 2000);
    }
});

function acceptCookie() {
    localStorage.setItem('cookieAccepted', '1');
    document.querySelector('.cookie-banner')?.classList.remove('show');
}
// lansman fix

/* === EVDEKIHESAP_UYGULAMA_GORUNUMU BASLANGIC === */

(function(){
  if (window.__ugYuklendi) return; window.__ugYuklendi = true;

  /* >>> AYARLAR <<< */
  var OTOMATIK_SOR     = true;   /* true: ilk açılışta herkese seçim ekranı çıkar (tercih kaydedilince bir daha sorulmaz, sadece Ayarlar'dan değişir) */
  var AVATAR_ANA_EKRAN = true;   /* true: uygulama modunda avatara dokun → ana ekran (false: yüzen ⌂) */
  var FIREBASE_SENKRON = true;   /* true: tercihi cihazlar arası senkronla (uid/ayarlar/gorunum) */

  /* data-tab → ikon + gradyan (senin gerçek tab'ların) */
  var HARITA = {
    market:['🛒','#ffb15a','#f26522'], tatil:['✈️','#5ad6e6','#1aa3c4'], butce:['💰','#5fe08a','#16a34a'],
    kiyafet:['👔','#c89bff','#8b5cf6'], diyet:['🥗','#b6e85a','#65a30d'], arac:['🚗','#a5b4fc','#4f46e5'],
    tamirat:['🔧','#b6bdc8','#6b7280'], bitkiler:['🌱','#7eeab0','#10b981'], canlar:['🐾','#ffab85','#ff6b3d'],
    kutuphane:['📚','#f0a868','#c2410c'], abonelikler:['📺','#ff7b7b','#e0234e'], ajanda:['📅','#84a9ff','#3b5bdb'],
    ailem:['👨‍👩‍👧','#ff9bbd','#ec4899'], varliklar:['🏠','#ffe08a','#eab308'], enerji:['⚡','#ffd34e','#f59e0b'],
    su:['💧','#6cc6ff','#2196f3'], dijital:['📱','#b388ff','#7c3aed'], ayarlar:['⚙️','#c8cfd9','#8a94a6'],
    mutfak:['🍳','#ffb07b','#d76d77'], asistan:['🍳','#ffb07b','#d76d77'], servetim:['🏠','#ffe08a','#eab308']
  };
  function ugCfg(k){ k=(k||'').toString().toLowerCase().replace(/[^a-z0-9çğıöşü]/g,''); return HARITA[k] || ['📦','#cbd2dc','#8a94a6']; }

  function ugNavBul(){
    var sec=['.nav-btn','[data-tab]','.nav-item','.tab-btn','nav button'];
    for(var i=0;i<sec.length;i++){
      var hep=document.querySelectorAll(sec[i]); var gor=[];
      for(var j=0;j<hep.length;j++){ if(hep[j].getClientRects().length) gor.push(hep[j]); }
      if(gor.length>=3) return gor;
    }
    return [];
  }
  function ugAnahtar(el){ return el.getAttribute('data-tab')||el.getAttribute('data-sekme')||el.id||(el.textContent||'').trim(); }
  function ugAd(el){
    var t=el.getAttribute('data-ad')||el.getAttribute('aria-label')||(el.textContent||'');
    t=t.replace(/\s+/g,' ').trim(); t=t.replace(/^[^0-9A-Za-zÇĞİÖŞÜçğıöşü]+/,'').trim();
    return t||ugAnahtar(el);
  }

  var CSS='.ug-wrap{position:fixed;inset:0;z-index:99990;font-family:"Plus Jakarta Sans",system-ui,sans-serif}'
  +'.ug-wall{position:absolute;inset:0;background:linear-gradient(158deg,#ffcf8b 0%,#f6873f 30%,#ef5a86 62%,#9b6bd6 100%)}'
  +'.ug-wall:after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.5px);background-size:19px 19px;mix-blend-mode:overlay}'
  +'.ug-col{position:absolute;inset:0;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,16px) + 14px) 0 calc(env(safe-area-inset-bottom,0px) + 16px)}'
  +'.ug-greet{display:flex;align-items:center;gap:12px;padding:0 22px 16px}'
  +'.ug-ava{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;font-size:23px;box-shadow:0 5px 14px rgba(0,0,0,.18)}'
  +'.ug-gt b{display:block;color:#fff;font-size:17px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.22)}'
  +'.ug-gt span{font-size:13px;color:rgba(255,255,255,.88);text-shadow:0 1px 2px rgba(0,0,0,.18)}'
  +'.ug-folder{margin:0 14px;background:rgba(255,255,255,.17);-webkit-backdrop-filter:blur(26px) saturate(150%);backdrop-filter:blur(26px) saturate(150%);border:1px solid rgba(255,255,255,.3);border-radius:34px;padding:20px 12px;box-shadow:0 24px 56px -18px rgba(0,0,0,.45);overflow:auto;animation:ugpop .42s cubic-bezier(.2,.85,.25,1.18)}'
  +'@keyframes ugpop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}'
  +'.ug-ftitle{text-align:center;color:#fff;font-weight:700;font-size:19px;margin-bottom:18px;text-shadow:0 1px 3px rgba(0,0,0,.28)}'
  +'.ug-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 6px;max-width:430px;margin:0 auto}'
  +'.ug-app{display:flex;flex-direction:column;align-items:center;gap:7px;border:none;background:none;padding:0;cursor:pointer;transition:transform .1s}'
  +'.ug-app:active{transform:scale(.9)}'
  +'.ug-ic{width:60px;height:60px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:31px;box-shadow:0 8px 16px -5px rgba(0,0,0,.4)}'
  +'.ug-lbl{font-size:11px;font-weight:600;color:#fff;text-align:center;line-height:1.15;max-width:74px;min-height:13px;text-shadow:0 1px 2px rgba(0,0,0,.3)}'
  +'.ug-sp{flex:1}'
  +'.ug-switch{margin:10px auto 0;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.32);color:#fff;font-weight:600;font-size:13px;padding:9px 18px;border-radius:30px;cursor:pointer}'
  +'.ug-home{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 78px);z-index:99980;width:52px;height:52px;border-radius:50%;border:none;background:#f26522;color:#fff;font-size:26px;line-height:1;box-shadow:0 10px 24px -6px rgba(242,101,34,.6);cursor:pointer;display:flex;align-items:center;justify-content:center}'
  +'.ug-gs{position:fixed;inset:0;z-index:99995;background:radial-gradient(120% 80% at 50% 0%,#fff8ef 0%,#f8f1e6 55%,#f1e8da 100%);font-family:"Plus Jakarta Sans",system-ui,sans-serif;overflow:auto}'
  +'.ug-gsin{max-width:460px;margin:0 auto;padding:calc(env(safe-area-inset-top,16px) + 24px) 22px 30px}'
  +'.ug-gslogo{display:flex;align-items:center;justify-content:center;gap:9px}'
  +'.ug-gsd{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ffb15a,#f26522);box-shadow:0 6px 14px -4px rgba(242,101,34,.55)}'
  +'.ug-gslogo b{font-size:16px;font-weight:800}'
  +'.ug-gsh{text-align:center;margin:30px 0 4px}'
  +'.ug-gsh h1{font-size:26px;font-weight:800;color:#1a1a1a}'
  +'.ug-gsh p{font-size:13.5px;color:#8a8275;margin-top:8px;line-height:1.5}'
  +'.ug-opt{background:#fff;border:1px solid #ece7df;border-radius:22px;padding:15px;margin-top:16px;display:flex;gap:14px;align-items:center;box-shadow:0 12px 30px -20px rgba(0,0,0,.22);cursor:pointer;transition:transform .15s}'
  +'.ug-opt:active{transform:scale(.985)}'
  +'.ug-new{border-color:#ffd9c2;background:linear-gradient(180deg,#fff,#fff8f3)}'
  +'.ug-th{width:74px;height:108px;border-radius:14px;flex-shrink:0;border:1px solid #ece7df;overflow:hidden;position:relative;background:#f4f0e9}'
  +'.ug-th1 i{position:absolute;left:9px;right:9px;border-radius:4px;background:#ece6dc}'
  +'.ug-th1 i:nth-child(1){top:9px;height:9px}.ug-th1 i:nth-child(2){top:24px;height:26px}.ug-th1 i:nth-child(3){top:56px;height:26px}'
  +'.ug-th1 .bar{position:absolute;left:0;right:0;bottom:0;height:20px;background:#fff;border-top:1px solid #eee;display:flex;justify-content:space-around;align-items:center}'
  +'.ug-th1 .bar s{width:7px;height:7px;border-radius:2px;background:#d9d3c8}.ug-th1 .bar s:first-child{background:#f26522}'
  +'.ug-th2{background:linear-gradient(158deg,#ffc987,#f4794a,#ee6286)}'
  +'.ug-th2 span{position:absolute;width:17px;height:17px;border-radius:5px;background:rgba(255,255,255,.85)}'
  +'.ug-th2 span:nth-child(1){left:11px;top:14px}.ug-th2 span:nth-child(2){left:34px;top:14px}.ug-th2 span:nth-child(3){left:57px;top:14px}.ug-th2 span:nth-child(4){left:11px;top:40px}.ug-th2 span:nth-child(5){left:34px;top:40px}.ug-th2 span:nth-child(6){left:57px;top:40px}'
  +'.ug-m{flex:1;min-width:0}'
  +'.ug-tag{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.6px;color:#fff;background:#f26522;padding:2px 8px;border-radius:20px;margin-bottom:7px}'
  +'.ug-m h3{font-size:16px;font-weight:700;color:#1a1a1a}'
  +'.ug-m p{font-size:12.5px;color:#8a8275;margin-top:5px;line-height:1.45}'
  +'.ug-go{margin-top:11px;font-size:13px;font-weight:700;color:#f26522}'
  +'.ug-foot{text-align:center;font-size:11.5px;color:#b3ada1;margin-top:22px;line-height:1.6}'
  +'.ug-ayarbtn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;margin:14px 0;padding:14px 16px;border:1px solid #ece7df;border-radius:14px;background:#fff;color:#1a1a1a;font:600 14px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;text-align:left}'
  +'.ug-ayarbtn span.ok{color:#d3cdc1;font-size:18px}';

  var ugNavCache=[]; var ugAvatarBagli=false; var ugIlkSorduMu=false;

  /* ---- opsiyonel Firebase senkron (uid/ayarlar/gorunum — users/ ÖN EKİ YOK) ---- */
  function ugFbRef(){ try{ if(typeof firebase==='undefined'||!firebase.database||!firebase.auth) return null; var u=firebase.auth().currentUser; if(!u) return null; return firebase.database().ref(u.uid + '/ayarlar/gorunum'); }catch(e){ return null; } }
  function ugFbYaz(d){ if(!FIREBASE_SENKRON) return; var r=ugFbRef(); if(r){ try{ r.set(d); }catch(e){} } }
  function ugFbSenkron(){ if(!FIREBASE_SENKRON) return; var r=ugFbRef(); if(!r) return; try{ r.once('value').then(function(s){ var v=s.val(); var m=''; try{m=localStorage.getItem('gorunum')||'';}catch(e){} if(v && v!==m){ try{localStorage.setItem('gorunum',v);}catch(e){} ugUygulaPref(); } }).catch(function(){}); }catch(e){} }

  function ugInit(){
    if(document.getElementById('ug-stil')) return;
    var st=document.createElement('style'); st.id='ug-stil'; st.textContent=CSS; document.head.appendChild(st);

    var L=document.createElement('div'); L.id='ug-launcher'; L.className='ug-wrap'; L.style.display='none';
    L.innerHTML='<div class="ug-wall"></div><div class="ug-col"><div class="ug-greet"><div class="ug-ava">🏡</div><div class="ug-gt"><b>Merhaba 👋</b><span>Bugün ne yapalım?</span></div></div><div class="ug-folder"><div class="ug-ftitle">Evdeki Hesap</div><div class="ug-grid" id="ug-grid"></div></div><div class="ug-sp"></div><button class="ug-switch" id="ug-switch">‹ Görünümü değiştir</button></div>';
    document.body.appendChild(L);

    var S=document.createElement('div'); S.id='ug-secici'; S.className='ug-gs'; S.style.display='none';
    S.innerHTML='<div class="ug-gsin"><div class="ug-gslogo"><span class="ug-gsd"></span><b>Evdeki Hesap</b></div><div class="ug-gsh"><h1>Nasıl görünsün?</h1><p>Uygulamayı sana en uygun şekilde kullan. Bu seçimi istediğin an değiştirebilirsin.</p></div><div class="ug-opt" data-ug="klasik"><div class="ug-th ug-th1"><i></i><i></i><i></i><div class="bar"><s></s><s></s><s></s><s></s></div></div><div class="ug-m"><h3>Klasik Görünüm</h3><p>Alıştığın sekmeli düzen. Bölümler arasında alt menüden geçiş.</p><div class="ug-go">Bunu kullan →</div></div></div><div class="ug-opt ug-new" data-ug="uygulama"><div class="ug-th ug-th2"><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="ug-m"><div class="ug-tag">✨ YENİ</div><h3>Uygulama Görünümü</h3><p>Her bölüm telefon ana ekranındaki gibi ayrı bir uygulama. Dokun, içine gir.</p><div class="ug-go">Bunu kullan →</div></div></div><div class="ug-foot">Verilerin ve tüm özellikler her iki görünümde de aynıdır.</div></div>';
    document.body.appendChild(S);

    var H=document.createElement('button'); H.id='ug-home'; H.className='ug-home'; H.innerHTML='⌂'; H.title='Ana ekran'; H.style.display='none';
    document.body.appendChild(H);

    S.addEventListener('click',function(e){ var t=e.target.closest('[data-ug]'); if(!t)return; ugSec(t.getAttribute('data-ug')); });
    document.getElementById('ug-switch').addEventListener('click',function(){ ugGizleL(); ugGosterS(); });
    H.addEventListener('click',function(){ ugGosterL(); });
  }

  /* Ayarlar sekmesine "Görünümü Değiştir" düğmesini otomatik ekle (#s-ayarlar) */
  function ugAyarlarButonu(){
    var sec=document.getElementById('s-ayarlar'); if(!sec) return;
    if(document.getElementById('ug-ayar-btn')) return;
    var b=document.createElement('button'); b.id='ug-ayar-btn'; b.type='button'; b.className='ug-ayarbtn';
    b.innerHTML='<span>🎨 Görünümü Değiştir</span><span class="ok">›</span>';
    b.addEventListener('click',function(){ ugGosterS(); });
    sec.appendChild(b);
  }

  function ugGridKur(){
    var nav=ugNavBul(); if(!nav.length) return false; ugNavCache=nav;
    var g=document.getElementById('ug-grid'); if(!g) return false; g.innerHTML='';
    for(var i=0;i<nav.length;i++){ (function(el){
      var c=ugCfg(ugAnahtar(el)); var ad=ugAd(el);
      var b=document.createElement('button'); b.className='ug-app';
      b.innerHTML='<span class="ug-ic" style="background:linear-gradient(150deg,'+c[1]+','+c[2]+')">'+c[0]+'</span><span class="ug-lbl">'+ad+'</span>';
      b.addEventListener('click',function(){
        ugGizleL(); var k=ugAnahtar(el);
        try{ if(typeof window.switchTab==='function'){ window.switchTab(k, el); } else { el.click(); } }catch(err){ try{ el.click(); }catch(e2){} }
      });
      g.appendChild(b);
    })(nav[i]); }
    return true;
  }

  function ugGosterL(){ var g=document.getElementById('ug-grid'); if(g && !g.children.length) ugGridKur(); var e=document.getElementById('ug-launcher'); if(e) e.style.display='block'; }
  function ugGizleL(){ var e=document.getElementById('ug-launcher'); if(e) e.style.display='none'; }
  function ugGosterS(){ var e=document.getElementById('ug-secici'); if(e) e.style.display='block'; }
  function ugGizleS(){ var e=document.getElementById('ug-secici'); if(e) e.style.display='none'; }
  function ugSec(d){ try{ localStorage.setItem('gorunum',d); }catch(e){} ugFbYaz(d); ugGizleS(); if(d==='uygulama') ugGosterL(); else ugGizleL(); }

  function ugUygulaPref(){ var m=''; try{ m=localStorage.getItem('gorunum')||''; }catch(e){} if(m==='uygulama') ugGosterL(); }
  function ugIlkAcilis(){ if(ugIlkSorduMu) return; ugIlkSorduMu=true; var m=''; try{ m=localStorage.getItem('gorunum')||''; }catch(e){} var dene=/[?&]gorunum=dene/.test(location.search); if(!m && (OTOMATIK_SOR||dene)) ugGosterS(); }
  function ugHomeBak(){ var H=document.getElementById('ug-home'); if(!H) return; if(ugAvatarBagli){ H.style.display='none'; return; } var m=''; try{ m=localStorage.getItem('gorunum')||''; }catch(e){} var L=document.getElementById('ug-launcher'); if(m==='uygulama' && L && L.style.display==='none' && ugNavCache.length) H.style.display='flex'; else H.style.display='none'; }

  function ugMain(){ ugInit(); ugGridKur(); ugAyarlarButonu(); ugUygulaPref(); ugIlkAcilis(); ugFbSenkron(); }

  /* AVATAR → ANA EKRAN (uygulama modunda bir modüldeyken). Klasik modda orijinal menü çalışır. */
  if (AVATAR_ANA_EKRAN && typeof window.toggleAvatarMenu === 'function'){
    var _tam = window.toggleAvatarMenu;
    window.toggleAvatarMenu = function(ev){
      var m=''; try{ m=localStorage.getItem('gorunum')||''; }catch(e){}
      var L=document.getElementById('ug-launcher');
      if(m==='uygulama' && L && L.style.display==='none'){
        try{ if(ev&&ev.preventDefault)ev.preventDefault(); if(ev&&ev.stopPropagation)ev.stopPropagation(); }catch(e){}
        ugGosterL(); return false;
      }
      return _tam.apply(this, arguments);
    };
    ugAvatarBagli = true;
  }

  /* BAŞLATMA: mod seçiminden sonra _startApp çağrılınca launcher'ı kur/uygula */
  if (typeof window._startApp === 'function'){
    var _osa = window._startApp;
    window._startApp = function(){ var r=_osa.apply(this, arguments); setTimeout(ugMain, 60); return r; };
  }

  /* YEDEK: nav görünür olunca da başlat (PWA yeniden açılış vb.) */
  var ugDeneme=0;
  var ugTimer=setInterval(function(){ if(ugNavBul().length>=3){ ugMain(); clearInterval(ugTimer); } else if(++ugDeneme>