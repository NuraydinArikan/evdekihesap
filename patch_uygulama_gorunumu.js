/* ============================================================
   Evdeki Hesap — "Uygulama Görünümü"  (v3 · SON · eklemeli)
   ------------------------------------------------------------
   • app.js'in SONUNA bağımsız blok ekler — mevcut kod DEĞİŞMEZ.
   • Senin gerçek fonksiyonların:
       - Navigasyon:  switchTab(id, btn)
       - Başlatma:    _startApp() sarmalanır
       - Ana ekran:   toggleAvatarMenu() sarmalanır (avatara dokun → launcher)
   • Ayarlar'a "🎨 Görünümü Değiştir" düğmesini OTOMATİK ekler (#s-ayarlar).
   • Tercih localStorage'da: 'gorunum' = 'klasik' | 'uygulama'
       (opsiyonel) FIREBASE_SENKRON=true → uid/ayarlar/gorunum ile cihazlar arası.
   • Tekrar çalıştırılabilir: önceki sürümü temizleyip yeniden yazar (çift blok olmaz).
   • sw.js +1 otomatik.

   ÇALIŞTIR:  node patch_uygulama_gorunumu.js
   SONRA:     firebase deploy --only hosting   (hotspot'tan)

   AÇILIŞ:
   • OTOMATIK_SOR=false → canlı kullanıcılar etkilenmez. Dene: ?gorunum=dene
   • İkona dokun → doğru sekme açılıyorsa OTOMATIK_SOR=true yap, tekrar deploy.
   ============================================================ */

const fs = require('fs');
const BASLA = '/* === EVDEKIHESAP_UYGULAMA_GORUNUMU BASLANGIC === */';
const BITIS = '/* === EVDEKIHESAP_UYGULAMA_GORUNUMU BITIS === */';
const ESKI  = ['/* === EVDEKIHESAP_UYGULAMA_GORUNUMU_V1 === */', '/* === EVDEKIHESAP_UYGULAMA_GORUNUMU_V2 === */'];
const log = [];
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ---- app.js'e eklenecek blok (String.raw: ters bölü/regex korunur) ---- */
const UG_BLOK = String.raw`
(function(){
  if (window.__ugYuklendi) return; window.__ugYuklendi = true;

  /* >>> AYARLAR <<< */
  var OTOMATIK_SOR     = false;  /* true: ilk açılışta herkese seçim ekranı çıkar */
  var AVATAR_ANA_EKRAN = true;   /* true: uygulama modunda avatara dokun → ana ekran (false: yüzen ⌂) */
  var FIREBASE_SENKRON = false;  /* true: tercihi cihazlar arası senkronla (uid/ayarlar/gorunum) */

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
  var ugTimer=setInterval(function(){ if(ugNavBul().length>=3){ ugMain(); clearInterval(ugTimer); } else if(++ugDeneme>40){ clearInterval(ugTimer); } },500);
  setInterval(ugHomeBak,400);

  window.gorunumSeciciAc=function(){ ugGizleL(); ugGosterS(); };
  window.gorunumAnaEkran=function(){ ugGosterL(); };
})();
`;

/* ---------------- app.js: eski sürümleri temizle + yeniden yaz ---------------- */
try {
  let app = fs.readFileSync('app.js', 'utf8');
  let vardiMi = false;

  // v1/v2 (dosya sonuna eklenmiş, bitiş işareti olmayan) blokları temizle
  let enErken = -1;
  ESKI.forEach(function (mk) { const i = app.indexOf(mk); if (i !== -1 && (enErken === -1 || i < enErken)) enErken = i; });
  if (enErken !== -1) { app = app.slice(0, enErken); vardiMi = true; }

  // v3 (BAŞLA..BİTİŞ) bloğunu temizle
  if (app.includes(BASLA)) { vardiMi = true; }
  app = app.replace(new RegExp(esc(BASLA) + '[\\s\\S]*?' + esc(BITIS), 'g'), '');

  app = app.replace(/\s+$/, '');
  app += '\n\n' + BASLA + '\n' + UG_BLOK + '\n' + BITIS + '\n';
  fs.writeFileSync('app.js', app, 'utf8');
  log.push(vardiMi ? '✅ app.js: önceki sürüm temizlenip güncel blok yazıldı' : '✅ app.js: "Uygulama Görünümü" bloğu eklendi (mevcut kod değişmedi)');
} catch (e) { log.push('⚠️ app.js okunamadı: ' + e.message); }

/* ---------------- sw.js versiyonu +1 ---------------- */
try {
  let sw = fs.readFileSync('sw.js', 'utf8');
  const m = sw.match(/evdeki-hesap-v(\d+)/);
  if (m) {
    const yeni = parseInt(m[1]) + 1;
    sw = sw.replace('evdeki-hesap-v' + m[1], 'evdeki-hesap-v' + yeni);
    fs.writeFileSync('sw.js', sw, 'utf8');
    log.push('✅ sw.js: v' + m[1] + ' → v' + yeni);
  } else {
    log.push('⚠️ sw.js: "evdeki-hesap-vXX" bulunamadı, elle +1 yap');
  }
} catch (e) { log.push('⚠️ sw.js okunamadı: ' + e.message); }

log.forEach(l => console.log(l));
console.log('—');
console.log('Sonraki: firebase deploy --only hosting');
console.log('Denemek için: evdekihesap.app?gorunum=dene');
