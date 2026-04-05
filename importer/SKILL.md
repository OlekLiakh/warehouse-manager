# CSV Імпортер — Склад Батьків

## Призначення
Імпортує дані з CSV файлів Google Sheets у базу даних Supabase.

## Команди
- `npm run validate path/to/file.csv` — перевірити файл
- `npm run import path/to/file.csv --dry-run` — тест без запису
- `npm run import path/to/file.csv` — реальний імпорт
- `npm test` — запустити unit тести

## Критичні правила
1. 1 рядок CSV = 1 товар. Завжди.
2. НЕ видаляти суфікси АНАЛОГ/БУ/(НОВИЙ) з артикулів
3. Завжди спочатку staging, потім prod
4. Завжди --dry-run перед реальним імпортом

## Середовище
- Staging Supabase: https://jpdojsrinkmafvnmnbes.supabase.co
- Prod Supabase: https://tzpluxqrzvxxzjnmaluz.supabase.co
- Ключі в .env.local (не в git!)
