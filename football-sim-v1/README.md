# SIMULAB V2 — Futbol Maç Merkezi

Tamamen ücretsiz kullanılabilen, **beş büyük Avrupa ligi** için sonuç/fikstür gösteren, haber ve kadro bağlamını modele ekleyen Monte Carlo simülatörü. Mevcut Vercel projesinde `football-sim-v1` klasöründen yayınlanır.

## Beş lig

Premier League, La Liga, Bundesliga, Serie A, Ligue 1. **Türkiye Süper Lig bu sürümde bilerek gizlendi.** Eski yerel `tur` verileri silinmedi, ancak bu sürümde hesaplamalara dahil edilmiyor.

## Özellikler

- **Maç Merkezi**: beş ligi sekmelerden seç; yaklaşan fikstürler, son oynanmış sonuçlar, tüm maçlar ve takım araması. Bir maça tıklanınca iki takım seçilip **1.000 simülasyon otomatik başlar**.
- **1000 Monte Carlo koşusu**: 1X2 sonuç payları; en sık skorlar; 2,5 üst/alt; karşılıklı gol; 3,5 üst; gol yemeden bitirme, tahmini skor etkisi ve ± örnekleme belirsizliği.
- **İlk 11**: iki takım için 4-3-3, 4-2-3-1, 4-4-2, 3-5-2 dizilişi; 11 oyuncu adı, 1–10 kullanıcı puanı ve %50–100 fiziksel hazır oluş. Tarayıcı hafızasında takıma göre saklanır.
- **Haber analizi**: `/api/news?team=...` üzerinden Google News RSS başlıklarını gösterir. Sakatlık, ceza, dönüş, baskı gibi **anahtar kelime işaretlerini** yorum etiketine çevirir. Etki yalnızca **kullanıcı onayıyla** modele girer; haberin tamamı okunmaz, doğruluk teyidi yapılmaz.
- **Psikolojik senaryo**: son 5 sonuçtan objektif form göstergesi, son maçın tarihi; iki takım için manuel **moral, baskıyla başa çıkma, fiziksel hazırlık** -3…+3 senaryo kontrolleri. Bunlar psikolojik ölçüm değil, varsayımdır.
- **Veri kalitesi**: her ligde son skorun tarihini ve gecikmeyi gösterir; kaynak eskiyse uyarır.
- **Ücretsiz 5 sezon arşiv**: OpenFootball `football.json` (CC0), 2022–23 ile 2026–27 arasını kontrol eder; manuel CSV de mümkündür.
- **Opsiyonel daha güncel skorlar**: `/api/matches?league=eng|esp|ger|ita|fra` football-data.org ücretsiz API anahtarı ile güncel sezonun **gecikmeli** skorlarını ve fikstürünü getirir. Sunucuya gizli anahtar konulmadan aktif olmaz; OpenFootball özelliği çalışmaya devam eder.

## Uygulama nasıl kullanılır?

1. Siteyi aç. İlk kurulumda daha önce hiç veri yoksa beş lig için otomatik OpenFootball indirmesi başlar.
2. İstersen **Verileri Güncelle → Beş ligi güncelle**.
3. **Maç Merkezi**'nde fikstürden karşılaşmaya tıkla. 1.000 koşu başlar.
4. **İlk 11 & Oyuncular** sekmesinde manuel kadroları ve oyuncu senaryo puanlarını kaydet.
5. **Haber & Psikoloji** sekmesinde başlıklara git, kaynakları oku; geçerli gördüklerini manuel onayla. Psikolojik senaryo kaydırıcılarını düzenle.
6. **Maç Merkezi → 1.000 Maçı Simüle Et** ile yeni varsayımlarla sonucu tekrar hesapla.

## Sıfır maliyetle daha güncel veri nasıl kurulur?

Bu **zorunlu değildir**, ama OpenFootball'un güncellenmeyen maçlarına çözüm için önerilir.

1. [football-data.org](https://www.football-data.org/client/register) ücretsiz hesap aç.
2. Vercel Dashboard → `simulab-football` → Settings → Environment Variables → `FOOTBALL_DATA_API_KEY` değişkenine anahtarı ekle (Production/Preview).
3. Deployments → Redeploy (env değişikliği için).
4. Sitede **Verileri Güncelle → Ücretsiz API'den son sonuçları getir** seçeneğine tıkla.

Ücretsiz planın 12 turnuva, **gecikmeli** skor ve 10 istek/dakika sınırı vardır; oyuncu kadroları, resmî ilk 11, ayrıntılı sakatlık, psikolojik durum ve xG verisini **ücretsiz plan sağlamaz**. API anahtarı hiçbir zaman frontend JavaScript'e eklenmemelidir.

## Model açıklaması

Temel beklenen gol ortalamaları takımların geçmiş skorları, gol yeme, güncel forma göre ağırlık, ev/deplasman filtresinden türetilir. Buradaki **beklenen gol, gerçek xG değildir**. Monte Carlo Poisson sayımları 1.000 adet olup bağımsız örnekleme oynaklığı taşır. Oyuncu puanları ve fiziki hazırlık, haber onayı ve psikoloji kaydırıcıları **manuel senaryo varsayımları** olarak hücum/savunmayı belirli sınırlar içinde değiştirir. Haber etkisinin yönü, başlığın sözcüklerine dayalı ve teyit gerektirir.

Geçmiş bir maç seçilirse model o maçtan sonraki sonuçları kullanmamaya çalışır (maç tarihinden önceki sonuçlar). Bu işlem tam bir tarihsel backtest/kalibrasyon değildir.

## Veri sınırları

OpenFootball `football.json` dosyaları günlük yeniden oluşturuluyor olabilir, ancak **upstream Football.TXT** kaynağı günlük güncellenmediği için **son skor 2026-09-20 gibi geçmişte kalabilir**. Bu nedenle sistem bu kaynağın güncel olduğunu asla garanti etmez. Fikstürler de eksik veya değişmiş olabilir. Skor, oyuncu ve haber verileri farklı sağlayıcılara dayanır ve eşleştirme kontrolü gerekir.

Google News RSS servis erişimi kısıtlanabilir; haberler alınamazsa arayüz hata gösterir. Haber **başlığı** içerik özeti veya gerçek klinik/psikolojik değerlendirme değildir. Otomatik doğrulanmış oyuncu bilgisi sunulmaz.

Veriler ve kullanıcının manuel girdileri sadece cihazının `localStorage` alanında saklanır. Vercel ve GitHub ücretsiz katmanları kullanım kotalarına tabidir.

## Geliştirici

- `index.html` ana sayfa; `studio.css` arayüz; `studio.js` maç veri yönetimi, takımlar, ilk 11, senaryo ve simülatör.
- `api/news.js` ücretsiz RSS kaynak başlıkları API route.
- `api/matches.js` isteğe bağlı ücretsiz football-data.org API route.
- `studio-v2.html` ayrı test/önizleme sayfası; aynı işlevli V2 HTML.
- `openfootball.js` eski V1 bağımsız yükleyici, yeni HTML tarafından kullanılmaz.

© Simulab V2 — analiz/eğitim; kesin skor veya bahis tavsiyesi değildir.
