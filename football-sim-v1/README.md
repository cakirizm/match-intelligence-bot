# SIMULAB V6 — Futbol Takım Profilleri ve Birleşik Simülasyon

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


---

## SIMULAB V6 — Tahmin doğrulama ve taktik laboratuvarı (Ekim 2026)

### V6 neleri değiştiriyor?

- **Elo güç derecelendirmesi:** maçın oynanmasından önceki tamamlanmış skorlarla güncellenen takım reytingi. Takım isimleri ve kaynak mükerrer kayıtları normalize edilir; farklı liglerdeki ortak takımlar rekabet verisini sınırlı biçimde birbirine bağlar.
- **Dixon–Coles düşük skor düzeltmesi:** 0-0, 1-0, 0-1 ve 1-1 olasılıkları birbirinden bağımsız Poisson yerine düzeltilmiş ortak skor dağılımından gelir. 0-0/1-1 gibi geçerli sonuçlar bilinçli olarak elenmez.
- **Rakip gücüne göre normalizasyon:** geçmiş gol atma/yeme oranları, ev/deplasman gol tabanları ve rakip Elo gücü kullanılarak kısmen dengelenir.
- **Güven ve veri kapsamı:** takımın kaç gerçek skoru bulunduğu, ne kadar eski olduğu, modelin veri kapsamı ve rho düzeltmesi raporda gösterilir.
- **Taktik senaryoları:** ev/deplasman yüksek pres, alçak blok, pas, direkt oyun, kontra. Bunların gol oranına etkisi **küçük manuel varsayımlardır**; gerçek takım oyun tarzının otomatik tespiti değildir.
- **İlk 11 alternatifi:** kullanıcı bir oyuncuyu çıkararak yerine ortalama kalitede aynı mevki oyuncusunun girdiği varsayımsal senaryonun olasılık değişimini karşılaştırabilir.
- **Kronolojik geriye dönük test:** seçilen lig için 80/130/220/500 geçmiş maçta maç öncesi mevcut olan sonuçlar kullanılarak Brier, log loss, 1X2 favori isabeti ve kalibrasyon aralıkları raporlanır. Referans her maçtan önceki son 140 lig sonucuna göre oluşturulur; **gelecek maçlar eğitimde kullanılmaz**.
- **Mobil performans:** tarayıcı destekliyorsa model testi Web Worker ile arka iş parçacığında çalışır; sayfa etkileşimi donmaz. Worker desteklenmezse tek iş parçacıklı hesap devreye girer.
- **Gerçek xG desteği (kullanıcı verisi):** isteğe bağlı `date,home,away,home_xg,away_xg,league,source` sütunlu CSV dosyası tarayıcı içinde işlenip cihazında saklanır. Yalnızca geçmiş, geçerli kayıtlar ve iki takıma ait yeterli örnek varsa sınırlı ağırlıkla kullanılır. **Ücretsiz fikstür kaynaklarından otomatik tam sezon xG alındığı iddia edilmez.**
- **Gelişmiş temsili canlandırma:** gol modeliyle tutarlı bitiş skorundan top kazanımı, paslarla ilerleme, ceza sahası girişi, şut ve goller içeren bağlantılı *kurgusal* pozisyon zincirleri üretilir. Bunlar maçın gerçek olay haritası değildir.

### Maç Merkezi kullanımı

1. Siteden turnuva ve maçı seç, kaynaklı takım/kadro sayfalarını incele.
2. V6 taktik panelinden kendi varsayımsal oyun planını seç.
3. 1.000, 5.000 veya 10.000 simülasyonu çalıştır; Monte Carlo ve Dixon–Coles dağılımına bak.
4. **Modeli test et. İlk 11'i karşılaştır.** bölümünden 80–500 geçmiş maçla doğrulama yap.
5. **İlk 11 senaryoları** bölümünden bir oyuncuyu çıkarıp aynı temeli kullanan alternatif sonuçları karşılaştır.
6. Kendi izinli gerçek xG verin varsa CSV ile içe aktar; ardından maçı yeniden simüle et.

### Mimari

- `v6-engine.js` — açık veriyle tarihsel güç değerlendirmesi, gol oranı, Dixon–Coles dağılımı ve kalibrasyon.
- `v6-ui.js` — taktikler, maç senaryosu, xG CSV, model raporu ve doğrulama arayüzü.
- `v6-backtest-worker.js` — kullanıcı cihazındaki Web Worker üzerinden kronolojik maç testi.
- `tests/v6-engine.test.cjs` — Node.js yerleşik test sistemi ile bağımsız sıfır bağımlılıklı kontrol. Yerelde `node --test tests/v6-engine.test.cjs`.

### Dikkat: modelin sınırları

Bu yapı **profesyonel seviyede kalibre edildiği ispatlanmış bir tahmin sistemi değildir**. Veri kalitesi, fikstür tarihinin doğruluğu, ücretsiz kaynakların oyuncu istatistiği eksikliği ve manuel senaryo ayarları belirleyici belirsizliklerdir. Taktik, oyuncu değişikliği ve psikoloji etkisi için kontrollü geçmiş doğrulama henüz yapılmadı; backtest yalnızca temel Elo/Dixon–Coles skorlu tahmin motorunu değerlendirir. Canlandırma kurgusaldır, sahadaki pozisyon takibi yoktur. Stat hava durumu, güncel resmî xG, optik tracking ve takım antrenman verileri bu sürümün içinde **yoktur**.

### Yayın durumu

GitHub ana dalındaki dosyalar güncellendi; bu, otomatik olarak Vercel canlı sitesinin güncellendiği anlamına gelmez. Vercel'in ücretsiz dağıtım günlük kotası dolarsa yeni üretim dağıtımı geçici olarak reddedilebilir. Canlı adresin son commit ile eşleştiği ayrıca kontrol edilmelidir.
