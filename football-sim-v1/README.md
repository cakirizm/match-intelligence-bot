# SIMULAB — Futbol Simülasyon Merkezi (V1)

Sıfır ücretli API bağımlılığıyla çalışan, 6 liglik ve 1.000 Monte Carlo maç simülasyonu yapan statik site.

## Çalışan özellikler
- Türkiye Süper Ligi, Premier League, La Liga, Bundesliga, Serie A, Ligue 1 seçimi
- CSV ile lig bazında gerçek geçmiş maç verisi içe aktarma (yalnızca tarayıcı localStorage)
- Gerçek veriler yokken açıkça etiketlenmiş **tamamen sentetik** takım ve maç demosu
- Ev/deplasman gol oranları + yakın geçmiş ağırlığı + Poisson gol simülasyonu
- 1.000 bağımsız koşu; 1×/10×/100× izleme, 1-X-2 dağılımı, en sık skor, KG ve 2.5 Üst

## Bilinen sınırlar
- **Verileri Güncelle** düğmesi yalnızca CSV içe aktarır. Gerçek zamanlı / otomatik veri sağlayıcısı sonraki aşamadadır.
- Maç ekran görüntülerinden takım algılama **henüz yok**.
- Saha top animasyonu temsili; gerçek şut, pas ve oyuncu koordinatlarını simüle etmez.
- Veri kullanıcının kendi tarayıcısında saklanır, cihazlar arasında paylaşılmaz.
- Tahmin motoru eğitimli/kalibre edilmiş bir profesyonel tahmin modeli değildir; performansı backtest ile doğrulanmalıdır.
- Harici CSV verisinin lisans ve kullanım koşullarına uyulmalıdır.

## Ücretsiz veri yükleme
CSV başlıkları: `Date,HomeTeam,AwayTeam,FTHG,FTAG`. Tarih: `YYYY-MM-DD` veya `DD/MM/YYYY`. Boş skorlar atlanır. Geçmiş maçlar yalnızca seçili lige yüklenmelidir.

## Vercel
Git deposu: `cakirizm/match-intelligence-bot`.
Vercel'de yeni proje oluştururken **Root Directory**: `football-sim-v1`; Framework Preset: **Other**; Build Command: boş (statik site).

## Yol haritası
1. GitHub'a ilk sürüm ✅
2. Vercel'de canlı site
3. Kullanım lisansı uygun ücretsiz veri kaynağına **Verileri Güncelle** işlevini bağlama
4. SS ile maç bulma, takım eşleştirme, xG verileri mümkünse geliştirme
5. Geçmiş maçlarla tahmin başarısı testi
