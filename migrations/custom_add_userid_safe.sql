-- Safe migration: Add userId columns without data loss
-- Step 1: Add userId columns as NULLABLE first

-- Get the first user ID to use as default
DO $$
DECLARE
    default_user_id varchar;
BEGIN
    -- Get first user ID (or create admin user if none exists)
    SELECT id INTO default_user_id FROM users LIMIT 1;

    IF default_user_id IS NULL THEN
        -- No users exist, create a default admin user
        INSERT INTO users (id, username, password_hash)
        VALUES (gen_random_uuid()::text, 'system_admin', '$2b$10$placeholder')
        RETURNING id INTO default_user_id;

        RAISE NOTICE 'Created system_admin user with ID: %', default_user_id;
    END IF;

    RAISE NOTICE 'Using default user ID for backfill: %', default_user_id;

    -- Step 2: Add userId columns as NULLABLE
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS user_id varchar;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id varchar;
    ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id varchar;
    ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS user_id varchar;

    RAISE NOTICE 'Added nullable userId columns';

    -- Step 3: Backfill existing records with default user ID
    UPDATE positions SET user_id = default_user_id WHERE user_id IS NULL;
    UPDATE orders SET user_id = default_user_id WHERE user_id IS NULL;
    UPDATE trades SET user_id = default_user_id WHERE user_id IS NULL;
    UPDATE ai_decisions SET user_id = default_user_id WHERE user_id IS NULL;

    RAISE NOTICE 'Backfilled all userId columns';

    -- Step 4: Make columns NOT NULL
    ALTER TABLE positions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE ai_decisions ALTER COLUMN user_id SET NOT NULL;

    RAISE NOTICE 'Set userId columns to NOT NULL';

    -- Step 5: Add foreign key constraints with CASCADE
    ALTER TABLE positions ADD CONSTRAINT positions_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE orders ADD CONSTRAINT orders_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE trades ADD CONSTRAINT trades_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE ai_decisions ADD CONSTRAINT ai_decisions_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    RAISE NOTICE 'Added foreign key constraints';

    -- Step 6: Add indexes for performance
    CREATE INDEX IF NOT EXISTS positions_user_id_idx ON positions(user_id);
    CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
    CREATE INDEX IF NOT EXISTS trades_user_id_idx ON trades(user_id);
    CREATE INDEX IF NOT EXISTS ai_decisions_user_id_idx ON ai_decisions(user_id);

    RAISE NOTICE 'Added indexes on userId columns';

    -- Step 7: Add sessions table if it doesn't exist
    CREATE TABLE IF NOT EXISTS sessions (
        id text PRIMARY KEY,
        user_id varchar NOT NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    RAISE NOTICE 'Created sessions table';

    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Added userId to positions, orders, trades, ai_decisions';
    RAISE NOTICE '  - Backfilled % positions', (SELECT COUNT(*) FROM positions);
    RAISE NOTICE '  - Backfilled % orders', (SELECT COUNT(*) FROM orders);
    RAISE NOTICE '  - Backfilled % trades', (SELECT COUNT(*) FROM trades);
    RAISE NOTICE '  - Backfilled % ai_decisions', (SELECT COUNT(*) FROM ai_decisions);
    RAISE NOTICE '  - Created sessions table';
    RAISE NOTICE '  - All data preserved!';

END $$;
