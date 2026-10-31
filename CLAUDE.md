# footballmatrix

19 milli takımın 1908–2026 turnuva kadro arşivi; statik Astro sitesi (TR/EN). Herkese açık projedir.
Veri modeli, adlandırma kuralları ve tasarım sistemi `docs/`, genel tanıtım `README.md` içindedir.

## Kurallar

- `data/raw/html/` kaynak arşivdir: salt okunur, düzenlenmez, yeniden adlandırılmaz. Kanonik veri `data/dist/` içindedir
  ve arşivden üretilir; elle düzeltme yapılmaz, üretici ya da doğrulayıcı güncellenir.
- Veri değişikliğinden sonra `tools/ts/` altındaki veri doğrulayıcı ve yol adlandırma denetçisi koşar.
- Mevki doğrulaması `tools/py/verify-positions.py` ile yapılır; kaynağı olmayan değer uydurulmaz.
- Site analitik, çerez ve üçüncü taraf istek içermez; bu özellik korunur.
- Kimlikler kebab-case, alanlar camelCase.
- Herkese açık depo: kişisel bilgi, makine yolu, sır ve altyapı ayrıntısı hiçbir dosyada, commit mesajında ya da
  PR metninde bulunmaz; yapay zekâ atfı da yazılmaz (§22).

## Git

`casoslab/footballmatrix` (SSH takma adı `github-casoslab`, casoslab kimliği `includeIf` ile seçilir). Commit ve push
uygun görüldüğünde atılır, `--force` yok.
