-- Operator setup: enable pg_cron in Supabase first. Run once in SQL Editor.
-- Old public data is already inaccessible at the month boundary without this job.
-- This job only removes expired private data. Inspect retention before enabling.
select cron.schedule('reme-purge-expired', '20 15 * * *', 'select reme_private.purge_expired()');
