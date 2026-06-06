@echo off
cd /d "C:\Users\nuray\OneDrive\Desktop\evdeki_hesap_Claude"

echo [1/4] Lock dosyasi temizleniyor...
del /f ".git\index.lock" 2>nul

echo [2/4] Index onariliyor...
git read-tree HEAD

echo [3/4] Degisiklikler ekleniyor...
rmdir /s /q ".github\workflows\.github" 2>nul
git add -A

echo [4/4] Commit ve push...
git commit -m "Su/Dijital sekme AI guncelleme, workflow temizligi, geribildirim formu"
git push origin main

echo.
echo Tamamlandi! Bu pencereyi kapatabilirsiniz.
pause
