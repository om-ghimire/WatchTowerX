from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        from app.models import user, monitor, check_result, alert_channel, status_page  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

        # Lightweight schema upgrade path for existing Postgres databases.
        if conn.dialect.name == "postgresql":
            await conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS role VARCHAR(20),
                ADD COLUMN IF NOT EXISTS account_owner_id INTEGER;
            """))

            await conn.execute(text("""
                UPDATE users
                SET
                    role = COALESCE(role, 'admin'),
                    account_owner_id = COALESCE(account_owner_id, id)
                WHERE role IS NULL OR account_owner_id IS NULL;
            """))

            await conn.execute(text("""
                ALTER TABLE users
                ALTER COLUMN role SET DEFAULT 'admin',
                ALTER COLUMN role SET NOT NULL,
                ALTER COLUMN account_owner_id DROP NOT NULL;
            """))

            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_users_account_owner_id'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT fk_users_account_owner_id
                        FOREIGN KEY (account_owner_id) REFERENCES users(id) ON DELETE CASCADE;
                    END IF;
                END$$;
            """))

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_account_owner_id
                ON users(account_owner_id);
            """))

            await conn.execute(text("""
                ALTER TABLE monitors
                ADD COLUMN IF NOT EXISTS monitor_type VARCHAR(20),
                ADD COLUMN IF NOT EXISTS target VARCHAR(2048),
                ADD COLUMN IF NOT EXISTS port INTEGER,
                ADD COLUMN IF NOT EXISTS request_config JSON,
                ADD COLUMN IF NOT EXISTS retry_config JSON,
                ADD COLUMN IF NOT EXISTS notification_config JSON,
                ADD COLUMN IF NOT EXISTS check_settings JSON,
                ADD COLUMN IF NOT EXISTS advanced_config JSON,
                ADD COLUMN IF NOT EXISTS organization_config JSON,
                ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER,
                ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;
            """))

            # Backfill defaults so newly-added required fields are safe.
            await conn.execute(text("""
                UPDATE monitors
                SET
                    monitor_type = COALESCE(monitor_type, 'http'),
                    target = COALESCE(target, url),
                    request_config = COALESCE(request_config, '{}'::json),
                    retry_config = COALESCE(retry_config, '{}'::json),
                    notification_config = COALESCE(notification_config, '{}'::json),
                    check_settings = COALESCE(check_settings, '{}'::json),
                    advanced_config = COALESCE(advanced_config, '{}'::json),
                    organization_config = COALESCE(organization_config, '{}'::json),
                    consecutive_failures = COALESCE(consecutive_failures, 0)
                WHERE
                    monitor_type IS NULL
                    OR target IS NULL
                    OR request_config IS NULL
                    OR retry_config IS NULL
                    OR notification_config IS NULL
                    OR check_settings IS NULL
                    OR advanced_config IS NULL
                    OR organization_config IS NULL
                    OR consecutive_failures IS NULL;
            """))

            await conn.execute(text("""
                ALTER TABLE monitors
                ALTER COLUMN monitor_type SET DEFAULT 'http',
                ALTER COLUMN monitor_type SET NOT NULL,
                ALTER COLUMN target SET NOT NULL,
                ALTER COLUMN request_config SET DEFAULT '{}'::json,
                ALTER COLUMN request_config SET NOT NULL,
                ALTER COLUMN retry_config SET DEFAULT '{}'::json,
                ALTER COLUMN retry_config SET NOT NULL,
                ALTER COLUMN notification_config SET DEFAULT '{}'::json,
                ALTER COLUMN notification_config SET NOT NULL,
                ALTER COLUMN check_settings SET DEFAULT '{}'::json,
                ALTER COLUMN check_settings SET NOT NULL,
                ALTER COLUMN advanced_config SET DEFAULT '{}'::json,
                ALTER COLUMN advanced_config SET NOT NULL,
                ALTER COLUMN organization_config SET DEFAULT '{}'::json,
                ALTER COLUMN organization_config SET NOT NULL,
                ALTER COLUMN consecutive_failures SET DEFAULT 0,
                ALTER COLUMN consecutive_failures SET NOT NULL;
            """))
