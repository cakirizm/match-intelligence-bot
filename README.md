# Match Intelligence Bot — V1

`preview.html` dosyasını çift tıklayarak canlı API olmadan arayüzü hemen görebilirsin.

Tarayıcıdan çalışan, Sportmonks Football API üzerinden günlük fikstürü otomatik çeken ve her maçı birden çok sinyalle analiz eden Next.js uygulaması.

## V1'de çalışanlar

- Seçilen tarihteki erişilebilir tüm maçları, `has_more=false` olana kadar bütün API sayfalarını dolaşarak otomatik alma (50 maç/sayfa)
- 5 dakikada bir otomatik yenileme
- Lig/takım arama, VALUE / İZLE / PAS filtreleri
- 1X2 oranlarından bookmaker marjını (overround) temizleme
- Sağlayıcı prediction verisini ayrı sinyal olarak kullanma; piyasa verisiyle körü körüne aynı saymama
- Maç detayında son ~95 günlük iki takım formu, H2H, xG (varsa), sakat/cezalı verisi ve oranları birleştirme
- Veri eksikse güven ve veri kalitesini düşürme; modelin her maça zorla seçim üretmemesi
- API token yoksa çalışan demo modu

## Analiz mantığı

Motor tek bir "son 5 maç" kuralı değildir. Katmanlar:

1. Market model: 1/X/2 oranlarını implied probability'ye çevirir ve bookmaker marjını temizler.
2. Independent prediction signal: API'den varsa ayrı tahmin olasılığını kullanır.
3. Recent-form signal: son dönem puan/maç, gol farkı ve varsa xG farkını ölçer.
4. H2H: düşük ağırlıkla kullanılır; geçmiş karşılaşmalar ana belirleyici yapılmaz.
5. Availability: sakat/cezalı listesi varsa kadro riskini düzeltme sinyali üretir.
6. Data quality: hangi katmanların gerçekten mevcut olduğuna göre güveni sınırlar.
7. Edge: model olasılığı ile devig edilmiş piyasa olasılığı arasındaki farktır.
8. Decision gate: veri kalitesi + edge + güven eşiklerine göre VALUE / İZLE / PAS.

> V1 başlangıç motorudur. Gerçek para ile kullanılmadan önce geniş backtest, kalibrasyon, lig-bazlı katsayılar ve closing-line ölçümü yapılmalıdır.

## Canlı veriyi açma

1. Sportmonks'tan API token al.
2. Proje kökünde `.env.local` oluştur:

```bash
SPORTMONKS_API_TOKEN=TOKENIN
```

3. Kur ve çalıştır:

```bash
npm install
npm run dev
```

Tarayıcı: `http://localhost:3000`

## Vercel

Repo'yu Vercel'e import et, Environment Variables bölümüne `SPORTMONKS_API_TOKEN` ekle ve deploy et. Sonrasında ofis PC'sinde yalnızca URL'yi açman yeterlidir.

## "Tüm maçlar" ne demek?

Uygulama seçilen tarihte **Sportmonks aboneliğinin erişim verdiği tüm fikstürü** `has_more=false` olana kadar pagination ile alır. Kod artık ilk 30 sayfada durmaz; pratik güvenlik sınırı 25.000 maç/gündür. Veri sağlayıcının lig/özellik kapsamı abonelik planına göre değişebilir. Bu nedenle "dünyadaki fiziksel olarak her futbol maçı" garantisi verilmez.

## Sonraki üretim katmanı

- Kalıcı odds snapshot veritabanı ve opening → current → closing line history
- Lig-bazlı calibration / Brier Score / Log Loss
- Poisson + Dixon-Coles skor modeli
- Elo/Glicko takım gücü
- xG weighted rolling form
- Beklenen 11 oyuncu değer etkisi
- Haber NLP: rotasyon, teknik direktör değişimi, motivasyon, seyahat / dinlenme
- Weather ve venue düzeltmesi
- Bookmaker consensus ve outlier detection
- Alt/Üst, KG, Asian handicap market motorları
- Backtesting ekranı ve CLV takibi
