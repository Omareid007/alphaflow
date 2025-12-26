-- Verification Script for Database Security Fixes
-- Run this AFTER implementing the fixes to verify everything is correct

\echo '================================================================'
\echo 'DATABASE SECURITY FIXES - VERIFICATION SCRIPT'
\echo '================================================================'
\echo ''

\echo '1. Checking for tables with missing userId columns...'
\echo '   Expected: All counts should be 0'
\echo ''

SELECT
  'trades' as table_name,
  COUNT(*) as rows_without_userid
FROM trades
WHERE user_id IS NULL
UNION ALL
SELECT
  'positions' as table_name,
  COUNT(*) as rows_without_userid
FROM positions
WHERE user_id IS NULL
UNION ALL
SELECT
  'ai_decisions' as table_name,
  COUNT(*) as rows_without_userid
FROM ai_decisions
WHERE user_id IS NULL
UNION ALL
SELECT
  'orders' as table_name,
  COUNT(*) as rows_without_userid
FROM orders
WHERE user_id IS NULL;

\echo ''
\echo '2. Checking for userId indexes...'
\echo '   Expected: At least 4 indexes (one per table)'
\echo ''

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('trades', 'positions', 'ai_decisions', 'orders')
  AND indexname LIKE '%user_id%'
ORDER BY tablename, indexname;

\echo ''
\echo '3. Checking column types and constraints...'
\echo '   Expected: All userId columns should be VARCHAR with NOT NULL'
\echo ''

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('trades', 'positions', 'ai_decisions', 'orders')
  AND column_name = 'user_id'
ORDER BY table_name;

\echo ''
\echo '4. Checking foreign key constraints...'
\echo '   Expected: All userId columns should reference users(id) with CASCADE'
\echo ''

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('trades', 'positions', 'ai_decisions', 'orders')
  AND kcu.column_name = 'user_id'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

\echo ''
\echo '5. Checking data distribution per user...'
\echo '   Shows how data is distributed across users'
\echo ''

SELECT
  'trades' as table_name,
  user_id,
  COUNT(*) as row_count
FROM trades
GROUP BY user_id
UNION ALL
SELECT
  'positions' as table_name,
  user_id,
  COUNT(*) as row_count
FROM positions
GROUP BY user_id
UNION ALL
SELECT
  'ai_decisions' as table_name,
  user_id,
  COUNT(*) as row_count
FROM ai_decisions
GROUP BY user_id
UNION ALL
SELECT
  'orders' as table_name,
  user_id,
  COUNT(*) as row_count
FROM orders
GROUP BY user_id
ORDER BY table_name, user_id;

\echo ''
\echo '6. Checking for orphaned records (userId not in users table)...'
\echo '   Expected: All counts should be 0'
\echo ''

SELECT
  'trades' as table_name,
  COUNT(*) as orphaned_records
FROM trades t
LEFT JOIN users u ON t.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT
  'positions' as table_name,
  COUNT(*) as orphaned_records
FROM positions p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT
  'ai_decisions' as table_name,
  COUNT(*) as orphaned_records
FROM ai_decisions ad
LEFT JOIN users u ON ad.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT
  'orders' as table_name,
  COUNT(*) as orphaned_records
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.id IS NULL;

\echo ''
\echo '7. Performance check: Index usage stats...'
\echo '   Shows if indexes are being used'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('trades', 'positions', 'ai_decisions', 'orders')
  AND indexname LIKE '%user_id%'
ORDER BY tablename, indexname;

\echo ''
\echo '================================================================'
\echo 'VERIFICATION COMPLETE'
\echo '================================================================'
\echo ''
\echo 'Expected Results:'
\echo '  - Section 1: All counts should be 0'
\echo '  - Section 2: At least 4 indexes (one per table)'
\echo '  - Section 3: All columns VARCHAR, NOT NULL'
\echo '  - Section 4: All constraints reference users(id) ON DELETE CASCADE'
\echo '  - Section 5: Data distribution looks reasonable'
\echo '  - Section 6: All counts should be 0'
\echo '  - Section 7: Indexes should show usage after application runs'
\echo ''
\echo 'If any section fails, review the migration script and re-run.'
\echo '================================================================'
