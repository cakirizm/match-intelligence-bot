# SIMULAB V5 — Futbol Takım Profilleri ve Birleşik Simülasyon

**Tamamen ücretsiz veri kaynaklarına dayanabilen** futbol analiz sitesi. Beş büyük Avrupa ligi (**Premier League, La Liga, Bundesliga, Serie A, Ligue 1**) ve **UEFA Şampiyonlar Ligi**. Türkiye Süper Ligi ve UEFA Avrupa Ligi yok.

## Kullanıcı akışı

1. Ana sayfadaki altı turnuvalı fikstür merkezinden bir karşılaşma seç.
2. **Takım Profilleri** sekmesinde kulübü aç: son formu, son 10 maçı, yaklaşan fikstürü, kaynaklı oyuncu listesini ve temel oyuncu profilini gör.
3. Sistem ücretsiz **TheSportsDB** takım bilgileri ile **Wikipedia açık lisanslı / topluluk kaynaklı kadro** listesini birleştirmeyi dener. Başarılıysa **muhtemel ilk 11 taslağı** önerebilir.
4. **Resmî ilk 11 doğrulanmış değildir.** Ücretsiz maç kadrosu sorgusu ayrı çalışır. TheSportsDB bedelsiz yanıtta en fazla 5 kayıt gösterebilir; eksik veri '11' gibi kullanılmaz.
5. İstersen seçilen takımın ilk 11'ini Scout ekranından manuel düzenle veya kadro fotoğrafı ile OCR'dan geçir. Bu bilgiler kaydedilmeden önce gözden geçirilmelidir.
6. Takım profilindeki bir oyuncuyu **oynamayacak / şüpheli / cezalı** olarak işaretlemek kullanıcının **senaryo varsayımıdır**; sağlık, ceza veya resmî kadro doğrulaması değildir. Modeli buna göre tekrar çalıştır.
7. **Maç Merkezi** bölümündeki tek **1.000 / 5.000 / 10.000 koşuluk simülasyon**, son sonuçlar, takımın iç/dış saha gol gücü, kaynakta eşleşen oyuncu rolü, manuel ilk 11/oyuncu performans girdileri, kontrollü moral/haber etkileri ve kayıtlı maçların dinlenme aralığını birleştirir. Olası skorlar, 1X2, karşılıklı gol, alt/üst, golcü senaryoları ve FM tarzı temsili animasyon burada.
8. **Birleşik açıklama raporu**, model güveni, mevcut XI veri kapsamı, takvim etkisi ve senaryo düzeltmelerini gösterir.

## Kaynak / veri kapsamı

| Veri | Kaynak | Ücretsiz | Güven sınırlaması |
|---|---|---|---|
| Beş büyük lig fikstür ve skor | OpenFootball JSON (CC0), OpenLigaDB (ODbL), TheSportsDB ücretsiz API | Evet | Kaynakların güncellenme sıklığı ve kapsamı farklı |
| Şampiyonlar Ligi tarihi sonuçları | OpenFootball Champions League CC0, `ucl-history.json` | Evet | 2023–24, 2024–25, 2025–26 toplam 503 maç |
| Mevcut takım profili | TheSportsDB ücretsiz arama | Evet | Sağlayıcıya göre eksik alanlar olabilir |
| Kadro oyuncu listesi | Wikipedia/MediaWiki açık lisanslı topluluk kadrosu; TheSportsDB temel oyuncu örneği | Evet | **Resmî kayıt, sakatlık, gerçek maç 11'i veya bütün oyuncuların eksiksiz istatistikleri değildir** |
| Bireysel sezon istatistiği | TheSportsDB `lookupplayerstats` | Evet, sınırlı | Veri yalnızca sağlayıcı döndürürse |
| Maç kadrosu kontrolü | TheSportsDB `lookuplineup` | Evet, sınırlı | Bedelsiz cevap eksik oyuncu içerebilir; iki takımın da 11'er oyuncusu yoksa doğrulanmış 11 sayılmaz |
| Maç haber başlıkları | Google News RSS | Evet | Yalnızca başlıklar ve bağlantılar okunur; doğrulama için kaynağa gidilmesi gerekir |
| Oyuncu dakika/mevki geçmişi | Kullanıcı scout CSV'si | Evet, manuel | Kullanıcının girdiği kayıtlara dayanır |
| Fotoğraftan kadro | Tarayıcıda Tesseract.js OCR | Evet | OCR hataları manuel gözden geçirilmelidir |

### Güncelleme ve değişiklik günlüğü

- Takım profili tarayıcıda 8 saat saklanabilir, zorla güncelleme seçeneği vardır.
- Eski ve yeni kadro listesindeki farklı oyuncu adları kaydedilir. **Bu farklar transfer veya sağlık durumu kanıtı değildir.**
- Kaynak geçici olarak eksik kadro verirse önceki detaylı kaynak kaydı korunur ve eksiklik belirtilir.
- Maç fikstürü kullanıcı siteyi açtığında yaklaşık 6 saatlik aralıkla kontrol edilir; **sunucu 24/7 arka planda sürekli tarama yapmaz**.
- Kullanıcı manuel ilk 11'ini eklemişse otomatik öneri **üzerine yazmaz**.
- Gerçek maçta kimlerin başlayacağı açık kaynakta güvenilir biçimde bulunamazsa "tahmini / onaysız" etiketi kalır.

## Modelin bilerek yapmadıkları

- Oyuncunun psikolojisini gerçek biyolojik veya klinik veriymiş gibi ölçmez.
- Eksik oyuncu, sakatlık, mevki veya maç gol/şut/konum istatistiklerini gerçekmiş gibi uydurmaz.
- 1-1, 1-0, 0-0 gibi geçerli futbol skorlarını yapay olarak dışlamaz.
- Ücretsiz kaynakta bulunmayan tüm oyuncuların sezon boyu mevki/dakika, xG ve top konumu olaylarını otomatik getirmiş gibi davranmaz.
- Maç canlandırmasındaki toplu koşular, şutlar, paslar ve golcüler model tarafından oluşturulan **temsili olaylardır**.

Model **kalibre edilmiş profesyonel bahis tahmin sistemi değildir**. Zaman ve kadro örneklem belirsizliği vardır. Monte Carlo sonuçları örneklem rastgeleliği taşır.

## GitHub/Vercel

Proje deposu `cakirizm/match-intelligence-bot`, Vercel kök dizini `football-sim-v1`.

Önemli dosyalar:

- `index.html`, `studio.css`, `studio-v3.css`: Kullanıcı arayüzü
- `studio.js`: Ana fikstür/takım geçmişi, oyuncu senaryoları ve Monte Carlo motoru
- `team-v5.js`: Altı turnuva takım dizini, kaynaklı oyuncu verisi, XI taslağı, değişiklikler, maç raporu
- `scout-v3.js`: Manuel oyuncu CSV, ilk 11 fotoğraf OCR
- `replay-v3.js`: FM tarzı temsilî animasyon
- `api/fixtures.js`, `api/team.js`, `api/player.js`, `api/lineup.js`, `api/news.js`: Ücretsiz kaynak API proxy'leri
- `ucl-history.json`: Üç sezonluk açık Şampiyonlar Ligi arşivi

**Wikipedia attribution:** Wikipedia ve katkıda bulunanların yazıları uygun CC BY-SA koşullarına tabidir, takım profilinde doğrudan kaynak sayfasına bağlantı verilir. ODbL veri uyumluluğu ve TheSportsDB API kullanım şartları saklıdır.

### Dağıtım

GitHub main dalına commit sonrası Vercel Git entegrasyonu etkinse otomatik dağıtım beklenir. Vercel bağlantısının yetkisi yoksa yeni kod GitHub'da olsa bile canlı site güncellenmeyebilir. **GitHub commit kaydı, tek başına canlı dağıtımın doğrulandığı anlamına gelmez.**
