-- Demo seed disabled — do not insert test data into production.
-- To remove existing demo rows: scripts/remove-demo-data.sql (or npm run remove-demo-data)

DO $seed$
BEGIN
  RAISE NOTICE 'Demo seed is disabled. Use scripts/remove-demo-data.sql to clean existing demo rows.';
END $seed$;
