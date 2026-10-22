# SIMULAB — Ücretsiz Futbol Simülasyon Merkezi (V1.1)

Altı lig için geçmiş maçları ücretsiz açık kaynaktan güncelleyen ve **gerçek sonuç istatistiklerine göre 1.000 Monte Carlo simülasyonu** yapan statik Vercel uygulaması.

## Gerçek veriler nasıl yüklenir?

1. Vercel siteni aç.
2. Sağ üst **Verileri Güncelle** düğmesine tıkla.
3. **6 Ligi Güncelle** veya **Seçili Ligi Güncelle** seçeneğine bas.
4. Kaynak üzerinden 2026-27, 2025-26, 2024-25, 2023-24, 2022-23 sezonları kontrol edilir.
5. Tamamlanmış maç sonuçları ve mevcut fikstürler **tarayıcının localStorage** alanına kaydedilir.
6. Takım eşleşmesi seç ve **1.000 Simülasyon Başlat** düğmesini kullan.

Veri kaynağı: [openfootball/football.json](https://github.com/openfootball/football.json), [CC0-1.0](https://github.com/openfootball/football.json/blob/master/LICENSE.md).
API anahtarı veya ücretli paket gerekmez.

## Ligler ve veri kapsamı

- İngiltere Premier League: `en.1`
- İspanya La Liga: `es.1`
- Almanya Bundesliga: `de.1`
- İtalya Serie A: `it.1`
- Fransa Ligue 1: `fr.1`
- Türkiye Süper Lig: `tr.1`

OpenFootball'da beş büyük ligin 2026-27 dosyalarını doğruladık. Türkiye 2026-27 dosyası 22 Ekim 2026 itibarıyla **mevcut değil**; doğrulanan en güncel Türkiye dosyası 2025-26. Bu nedenle Türkiye Süper Ligi için **2026-27 güncel form verisi garanti edilmez**. Arayüzde en son oynanmış maçın tarihi ve sezon eksikliği gösterilir.

OpenFootball JSON dosyaları her gün otomatik oluşturulabilse de kaynak Football.TXT içerik güncellemeleri anlık olmayabilir. Sonuçlar yalnızca upstream veri ne kadar yeniyse o kadar günceldir.

## Verinin işlenişi

Kaynak URL deseni: `https://raw.githubusercontent.com/openfootball/football.json/master/{season}/{league}.json`. Ağ erişim hatasında jsDelivr mirror denenir.

- `matches[].team1/team2/date` ile maç kimliği, `score.ft=[ev,dep]` veya `score=[ev,dep]` ile tamamlanmış maç sonucu okunur.
- **Bugünden ileri tarihli skorlar eğitim setine alınmaz**; skor bekleyen gelecekteki maçlar yalnızca fikstür olarak gösterilir.
- Aynı tarih/ev/deplasman kombinasyonları tekilleştirilir.
- Önceden elle yüklenmiş CSV maçları yeni senkronizasyonda korunur.
- Veri yalnızca sayfayı açan tarayıcıda saklanır, veritabanı veya cihazlar arası eşitleme yoktur.
- Her ligde son veri tarihi ve mevcut sezon dosyası bulunup bulunmadığı açıkça gösterilir.
- Bir kaynak dosyası mevcut değilse hata gizlenmez; o sezon atlanır ve mevcut yerel veriler silinmez.

## Tahmin motoru

Tarayıcıda çalışan Poisson gol modeli; takımın son maçları, iç/dış saha ayrımı ve hücum/savunma gol oranlarını kullanır. 1.000 bağımsız örnek oluşturur ve 1X2, muhtemel skor dağılımı, karşılıklı gol ve 2,5 üst oranlarını verir.

**Not:** Bu model saha içi gerçek pozisyon, xG, kadro ve sakatlık bilgisi üretmez. Oyuncu/şut koordinat simülasyonu değildir. Olasılıklar kalibre edilmiş veya doğrulanmış bahis tahmini olarak sunulmaz.

## Manuel CSV yedeği

Dilersen `Date,HomeTeam,AwayTeam,FTHG,FTAG` kolonları olan CSV dosyasını seçili lige yükleyebilirsin. Dosya içe aktarımı o ligin tarayıcıdaki kayıtlarını değiştirir. Veri kaynağının kullanım/lisans şartlarına uy.

## Yayınlama

Vercel projesi GitHub'dan `cakirizm/match-intelligence-bot` deposuna bağlı olmalı.
**Root Directory:** `football-sim-v1`. **Framework Preset:** Other. Build Command boş.
GitHub main dalına yapılan yeni commitler Vercel Git entegrasyonu etkinse otomatik yayınlanır.

## Sonraki sürüm

1. Türkiye Süper Lig 2026-27 için hukuken uygun ücretsiz güncel kaynak araştırma.
2. Maç ekran görüntüsünden takım ve fikstür tanıma.
3. Veri kalitesi, backtest, Elo ve kalibrasyon ekranları.
4. Gerekirse ücretsiz/uygun lisanslı xG ve olay verisi katmanı.
