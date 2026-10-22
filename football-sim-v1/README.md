# SIMULAB V4.1 — Ücretsiz Futbol Fikstürü ve Simülasyon

Beş büyük Avrupa ligi **Premier League, La Liga, Bundesliga, Serie A, Ligue 1** ve **UEFA Şampiyonlar Ligi** için tek tıkla fikstür, sonuçlar, kadro/scout girişi ve 1.000–10.000 Monte Carlo simülasyonu.

Türkiye Süper Ligi ve UEFA Avrupa Ligi bu sürüme dahil değildir.

## Kurulum maliyeti

- Ücretli API, kişisel API anahtarı ve hesap açma **gerekmez**.
- GitHub ve Vercel'in mevcut ücretsiz katmanlarında kullanım kotaları dahilinde çalışır.
- Ücretsiz veri kaynaklarının kapsamı ve güncelliği garanti değildir.

## Güncel veri akışı

`/api/fixtures?league=eng|esp|ger|ita|fra|ucl`

- İngiltere, İspanya, İtalya, Fransa: [OpenFootball 2026/27](https://github.com/openfootball/football.json) **CC0** tam sezona dayalı program ve kayıtlı sonuçlar.
- Almanya ve Şampiyonlar Ligi: [OpenLigaDB](https://www.openligadb.de/) **ODbL**, 2026/27 sezonu. Açık API, giriş/kişisel anahtar gerektirmez. ODbL attribution ve veri tabanı paylaşımı koşullarına uyulmalıdır.
- Altı turnuva: [TheSportsDB V1](https://www.thesportsdb.com/docs_api_guide.php) herkese açık **123 ücretsiz API anahtarı** üzerinden sınırlı yakın maç/sonuç güncellemesi.
- Tarihsel temel arşiv: OpenFootball CC0. Şampiyonlar Ligi'nin 2023–24, 2024–25 ve 2025–26 sezonları ayrıca `ucl-history.json` içinde (503 skor kaydı) bulunur.

### Kullanım

1. [https://simulab-football.vercel.app](https://simulab-football.vercel.app) adresini aç.
2. Otomatik güncelleme en fazla **6 saatte bir**, tarayıcın siteyi açtığında tetiklenir (arka planda sürekli çalışan tarama değildir).
3. Üstte **Fikstürü Ücretsiz Güncelle** veya **Verileri Güncelle → 6 turnuvayı ücretsiz güncelle** seç.
4. **Bugün / 7 Gün / 30 Gün / Yaklaşan / Sonuçlar / Tümü** filtreleriyle lig ve maç seç.
5. Maça tıkladığında simülasyon başlar. İstersen `1.000`, `5.000`, `10.000` Monte Carlo koşusu seç.
6. **Scout & İlk 11** bölümünden oyuncu adlarını manuel gir, kendi scout CSV dosyanı yükle veya kadro görselini cihazında OCR ile okut. OCR çıktısını onaylamadan oyuncu kaydedilmez.
7. **Haber & Psikoloji** bölümündeki RSS haber başlıkları öneri niteliğindedir, doğrulanmış bireysel psikolojik değerlendirme değildir.

**Önemli:** Bir veri kaynağı sadece kısmi fikstür döndürürse tarayıcıdaki eski gelecekteki maçları silmez. Tam sezon akışı yenilenirse ertelenmiş/silinen planlı maç kayıtları yeniden belirlenir. Eksik veri varsa arayüzde kaynak, zaman ve uyarı gösterilir.

## Gerçek veri ile simülasyon ayrımı

- Gerçek veriler: kaynaklı maç sonuçları, tarih/fikstür, kaynak tarafından sağlanıyorsa takım/kadro profilleri.
- Manuel: oyuncu puanları, fiziksel hazır oluş, psikolojik senaryo, kullanıcı scout CSV ve haber onayları.
- Simüle: olay konumları, dakika akışı, golcü ve asistçi adayları, şut/pas sahnesi. **Bunlar gerçekleşmiş maç olayları değildir**.
- Model: tarihsel gol ortalamaları, ev/deplasman, sınırlı oyuncu ve psikoloji senaryoları, Poisson/Monte Carlo.
- Tarihsel kayıt yetersizse düşük güven uyarısı ve açıkça belirtilen genel maç gol öncülleri kullanılır.
- Simülasyon yüzdeleri kalibre edilmiş profesyonel tahmin veya bahis tavsiyesi değildir.

## Kaynak hakları

OpenFootball CC0 ve OpenLigaDB ODbL uyumlulukları korunmalı. TheSportsDB, kendi ücretsiz API koşullarına tabidir. Başka servislerden izin olmadan tüm sezon verisi kopyalanıp tekrar yayımlanmaz. Takım adları ve ticari markalar ilgili sahiplerine aittir.

## Yapı

- `index.html`, `studio.css`, `studio-v3.css` — mobil uyumlu kullanıcı arayüzü
- `studio.js` — veri saklama/yenileme, lig filtreleri ve maç modeli
- `api/fixtures.js` — ücretsiz ve anahtarsız sonuç/fikstür birleştirme
- `api/news.js` — Google News RSS başlıkları; tam haber incelemesi değildir
- `api/squad.js` — isteğe bağlı **kendi** football-data.org ücretsiz API anahtarı gerektiren temel kadro kaynağı; ana akış için gerekli değildir
- `scout-v3.js` — fotoğraf OCR/manuel CSV ve ilk 11 kontrolü
- `replay-v3.js` — temsili oyunculu maç anlatımı ve 1.000–10.000 koşudan golcü senaryoları
- `ucl-history.json` — üç sezonluk açık Şampiyonlar Ligi geçmişi

## Sınırlamalar

- 2026/27 sezonu programları, ücretsiz topluluk verisi ve sağlayıcıların güncelleme sürelerine tabidir; doğruluk garantisi yoktur.
- TheSportsDB ücretsiz sürümde tek yakın maç / sınırlı sezon kaydı gönderebilir.
- Oyuncuların tam geçmiş dakika-mevki haritaları ve gerçek maçtaki pas/şut koordinatları otomatik olarak gelmez.
- Veriler ve kullanıcı ayarları tarayıcının `localStorage` alanında tutulur; cihazlar arası senkronizasyon yoktur.
- Vercel uygulamasının dağıtımı GitHub `main` dalındaki değişiklikler üzerinden otomatik tetiklenir.

SIMULAB — eğitim ve analiz amaçlı, ücretsiz altyapı.
