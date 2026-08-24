# Design — Football Matrix

Football Matrix'in kilitli uygulama tasarım sistemi. Bütün sayfalar bu dosyadaki
tema, tipografi, bileşen ve hareket kararlarını paylaşır; sayfa bazında yeni tema
üretilmez.

## Genre

Editorial — bir skor uygulamasından çok, taranması kolay bir spor almanağı.

## Sayfa düzenleri

- Ana sayfa: **Bento Grid** — gerçek veri kartları, iki CSS grafiği ve ülke dizini.
- Veri sayfaları: **Stat-Led** — ülke, oyuncu ve turnuva başlıkları ile sakin tablolar.
- Referans sayfaları: **Long Document** — veri kalitesi ve hakkında sayfalarında uzun okuma ritmi.

## Theme

- Paper: `oklch(98.5% 0.004 250)`; iki soğuk katman ve bir sıcak not yüzeyi.
- Ink: `oklch(24% 0.045 258)`; lacivert taban.
- Accent: `oklch(52% 0.155 28)`; yalnız odak, aktif bağlantı ve küçük işaretler.
- Charts: Dünya Kupası lacivert, kıtasal turnuvalar mavi, Olimpiyatlar hardal.
- Ülke renkleri `countries.json` verisinden gelir; yalnız başlık, rozet ve kart yüzeyinde kullanılır.
- Matris hücreleri renkle kodlanmaz; varlık yazı ağırlığı, yokluk en dash ile gösterilir.

## Typography

- Display: Newsreader Variable, weight 600, roman.
- Body: IBM Plex Sans, weight 400; arayüz vurguları 600.
- Outlier: JetBrains Mono; yalnız büyük sayılar ve veri hücreleri.
- Gövde tabanı 16 px, oran 1.25, metin ölçüsü en fazla 65ch.
- Bütün sayılar tabular; başlıklar italic değildir.

## Space, surfaces and controls

- Dört piksel tabanlı adlandırılmış ölçek; ham aralık değeri bileşen içine yazılmaz.
- Kartlar tek katmandır; kart-içinde-kart, kalın yan şerit ve yoğun gölge kullanılmaz.
- Kontrol yüksekliği en az 44 px; etiket her zaman kontrolün üstündedir.
- `html` ve `body` yatay taşmayı `clip` ile keser; tablolar kendi scrollport'unda kayar.
- N6 gazete masthead'i ve Ft4 yoğun kolofon bütün rotalarda ortaktır.

## Motion and interaction

- Ana sayfa sayacı oturumda bir kez çalışır.
- Ülke kartı hover/active durumunda yalnız 1 px dikey hareket eder.
- Filtre sonuç sayısı opacity ile güncellenir; tabloda sticky gölge işlevsel kalır.
- Focus halkası anında görünür. Reduced motion bütün uzamsal hareketi sıfırlar.
- Her etkileşim default, hover, focus-visible, active, disabled, loading, error ve success durumlarını kapsar.

## Per-page allowances

- Ana sayfa, uygulamanın en renkli ve yoğun keşif yüzeyidir.
- Ülke sayfası ülke rengini başlık ve küçük yüzeylerde kullanabilir; matris sakin kalır.
- Oyuncu ve turnuva sayfaları kimlik/veri bantları kullanır; tablolar değişmez.
- Veri kalitesi renk yanında metin ve `✓`/`!`/`?` işaretlerini birlikte kullanır.
- Hakkında sayfası kart ızgarası kullanmaz; uzun doküman ve veri kenar notu olarak akar.

## Non-negotiables

- Bütün metrikler `data/dist` üzerinden hesaplanır; elle sayı yazılmaz.
- Türkçe ve İngilizce aynı bileşenleri paylaşır; yeni metin iki sözlüğe birlikte girer.
- Analitik, telemetri, çerez, harici font, grafik kütüphanesi veya üçüncü taraf script yoktur.
- 320, 375, 414 ve 768 px genişliklerinde gövde yatay kaymaz; tıklanabilir metin iki satıra düşmez.

## Exports

Gerçek ve eksiksiz token kaynağı `site/tokens.css` dosyasıdır. Aşağıdaki eşlemeler
başka araçlara aktarım sözleşmesini gösterir.

### tokens.css

```css
:root {
  --color-paper: oklch(98.5% 0.004 250);
  --color-paper-2: oklch(96.2% 0.006 250);
  --color-ink: oklch(24% 0.045 258);
  --color-ink-muted: oklch(52% 0.03 258);
  --color-rule: oklch(88% 0.012 250);
  --color-accent: oklch(52% 0.155 28);
  --color-focus: oklch(55% 0.14 250);
  --font-display: "Newsreader Variable", ui-serif, serif;
  --font-body: "IBM Plex Sans", ui-sans-serif, sans-serif;
  --font-outlier: "JetBrains Mono", ui-monospace, monospace;
  --space-md: 1rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --radius-control: 8px;
}
```

### Tailwind v4

```css
@theme {
  --color-paper: oklch(98.5% 0.004 250);
  --color-ink: oklch(24% 0.045 258);
  --color-accent: oklch(52% 0.155 28);
  --font-display: "Newsreader Variable", ui-serif, serif;
  --font-body: "IBM Plex Sans", ui-sans-serif, sans-serif;
  --spacing-md: 1rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG

```json
{
  "color": {
    "paper": { "$value": "oklch(98.5% 0.004 250)", "$type": "color" },
    "ink": { "$value": "oklch(24% 0.045 258)", "$type": "color" },
    "accent": { "$value": "oklch(52% 0.155 28)", "$type": "color" }
  },
  "space": { "md": { "$value": "1rem", "$type": "dimension" } }
}
```

### shadcn/ui

```css
:root {
  --background: 98.5% 0.004 250;
  --foreground: 24% 0.045 258;
  --primary: 52% 0.155 28;
  --primary-foreground: 98.5% 0.004 250;
  --muted: 96.2% 0.006 250;
  --muted-foreground: 52% 0.03 258;
  --border: 88% 0.012 250;
  --ring: 55% 0.14 250;
  --radius: 8px;
}
```
