# SIMULAB V4 — Ücretsiz Futbol Simülasyon, Fikstür ve Scout Sistemi

**Canlı site:** https://simulab-football.vercel.app

Bu web uygulaması beş büyük lig ile **UEFA Şampiyonlar Ligi** için gerçek fikstürleri ve sonuçları anahtar/abonelik olmadan alır. Türkiye Süper Ligi ve UEFA Avrupa Ligi eklenmez.

## V4 — anahtarsız otomatik fikstür

Site açıldığında 6 saatten uzun süredir kontrol yapılmadıysa fikstürler otomatik güncellenir. Ayrıca:
- **Ücretsiz güncelle**: tüm ligler için 2026-27 sezonu maç programını tekrar kontrol eder.
- **Görünüm:** Yaklaşan maçlar veya tamamlanmış maçlar
- **Turnuva:** Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Şampiyonlar Ligi veya hepsi
- **Tarih:** 7 / 30 / 90 gün / sezon
- **Takım arama**
- Karşılaşmaya tıklama → iki takım seçilir, model **1.000 / 5.000 / 10.000** koşu üretebilir.
- Tarih/saat, maç günü, skor, turnuva, tur/hafta bilgileri mevcutsa gösterilir.
- Kaynak UTC başlangıcı sağlıyorsa maç saati **Dubai saati (DXB)** olarak çevrilir. Yedek CSV saat dilimini açıkça vermiyorsa **kaynak saati** etiketi kullanılır.

### Kaynak sırası

1. **Fixture Download** — ücretsiz, API anahtarı gerektirmeyen 2026/27 JSON sezon akışları. Beş büyük lig ve Şampiyonlar Ligi: https://fixturedownload.com/ . Canlı kaynaktan skorlar, tarih/saat, turlar alınır. Veri doğruluğu garanti edilmez, sağlayıcı koşulları geçerlidir.
2. **open-matchday** — birincil kaynak erişilemiyorsa yedek, açık GitHub CSV arşivi. https://github.com/oladeeayo/open-matchday . **Sadece kişisel, bilgilendirici, ticari olmayan kullanım**; orijinal sağlayıcı hakları saklıdır.
3. **OpenFootball** — geçmiş lig sonuçları için CC0 kaynak: https://github.com/openfootball/football.json .
4. **OpenFootball Champions League** — V3'ten kalan 503 adet 2023/24–2025/26 UCL geçmiş maç sonucu projenin `ucl-history.json` dosyasında; güncel UCL fikstürü değildir.

Sunucu endpoint'i: `GET /api/fixtures?league=eng|esp|ger|ita|fra|ucl`.

## Ekranlar

**Maç Programı & Sonuç Merkezi**  
Altı turnuva, günlük maç grupları, takım arama, tarih/turnuva filtreleri, hızlı simülasyon bağlantıları.

**Simülasyon Stüdyosu**  
1X2, en yaygın skorlar, karşılıklı gol, 2,5 üst/alt, 3,5 üst, tahmini gol ve örnekleme belirsizliği. Model geçmiş maç skorları ve iç saha/deplasman ortalamalarından yararlanır; beklenen gol değerleri gerçek xG değildir.

**Scout & İlk 11**  
Formasyon ve manuel oyuncu isimleri, performans puanı/hazır oluş yüzdesi. Fotoğraf, tarayıcıda Tesseract OCR ile okunabilir; kullanıcı 11 ismi kontrol edip onaylamadan uygulanmaz. İsteğe bağlı scout CSV'leri `Player,Position,Minutes,Goals,Assists,Appearances,Positions` başlıklarıyla eklenebilir. Bu içerikler gerçekliğini kullanıcı beyanıyla taşır. Genel oyuncu profilleri için `/api/squad` football-data.org anahtarını gerektirir; bu **opsiyoneldir**, fikstür ve simülasyonlar bundan bağımsız çalışır.

**Haber & Psikoloji**  
Takım haberlerini Google News RSS üzerinden başlık düzeyinde kontrol eder. Başlıktaki olası eksik/dönüş/baskı senaryoları otomatik doğrulanmaz, yalnızca kullanıcı onaylarsa sınırlı simülasyon etkisi olur. Psikoloji ayarları gerçek klinik ölçüm değildir.

**FM Tarzı Maç Tekrarı**  
22 oyuncu işareti, saha, dakika, top ve gol animasyonu, skor senaryosu ve olası golcü ikilisi. Bunların tümü **temsili model çıktısıdır**; gerçek pozisyon/şut/pas takibi ve resmî maç istatistiği değildir. 0-0 ve 1-1 gibi gerçekçi skorlar yapay olarak elenmez.

## Proje ve dağıtım

- GitHub: `cakirizm/match-intelligence-bot/football-sim-v1`
- Vercel Root Directory: `football-sim-v1`
- Framework: Other, statik HTML + serverless API fonksiyonları
- **Kullanıcıdan hiçbir API anahtarı istenmez** — fikstür, maç sonucu arşivi, simülasyon çalışır.
- Ücretsiz servis sağlayıcıları kullanım sınırlarına ve lisans koşullarına tabidir.
- Yerel kayıtlar tarayıcının `localStorage` alanına yazılır; farklı cihazlara eşitlenmez.
- Fikstür, saat ve skor sağlayıcıda değişebilir; resmî maç programıyla kontrol edilmelidir.
- Site kesin bahis tahmini veya garantili sonuç üretmez.

## Kod

- `index.html`, `studio.css`, `studio-v3.css` — arayüz
- `studio.js` — veri senkronizasyonu, fikstür, model
- `scout-v3.js`, `replay-v3.js` — oyuncu katmanı ve canlandırma
- `api/fixtures.js` — anahtarsız gerçek 2026/27 fikstür sonuçları
- `api/news.js` — haber başlıkları
- `api/matches.js`, `api/squad.js` — ayrı opsiyonel football-data.org kaynakları; kullanılmaları zorunlu değil
- `ucl-history.json` — CC0 üç sezon UCL arşivi.
