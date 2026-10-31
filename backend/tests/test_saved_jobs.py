
import sqlite3

import saved_jobs


def create_legacy_database(database_path, include_legacy_backup=False):
    """Create the old saved_jobs table structure."""

    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE saved_jobs (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                company TEXT,
                job_json TEXT NOT NULL,
                saved_at TEXT NOT NULL
            )
        """)

        if include_legacy_backup:
            connection.execute("""
                CREATE TABLE saved_jobs_legacy (
                    id TEXT PRIMARY KEY
                )
            """)


def test_migrate_legacy_saved_jobs_table(tmp_path, monkeypatch):
    database_path = tmp_path / "legacy.db"
    monkeypatch.setattr(saved_jobs, "DB_PATH", database_path)

    create_legacy_database(database_path)

    saved_jobs.initialize_database()

    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute("""
                SELECT name FROM sqlite_master
                WHERE type = 'table'
            """).fetchall()
        }

        columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(saved_jobs)"
            ).fetchall()
        }

    assert "saved_jobs_legacy" in tables
    assert "user_id" in columns


def test_drop_old_table_when_legacy_backup_exists(
    tmp_path,
    monkeypatch
):
    database_path = tmp_path / "legacy_backup.db"
    monkeypatch.setattr(saved_jobs, "DB_PATH", database_path)

    create_legacy_database(
        database_path,
        include_legacy_backup=True
    )

    saved_jobs.initialize_database()

    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute("""
                SELECT name FROM sqlite_master
                WHERE type = 'table'
            """).fetchall()
        }

        columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(saved_jobs)"
            ).fetchall()
        }

    assert "saved_jobs_legacy" in tables
    assert "saved_jobs" in tables
    assert "user_id" in columns



def test_delete_nonexistent_saved_job_returns_false(
    tmp_path,
    monkeypatch
):
    database_path = tmp_path / "delete_test.db"
    monkeypatch.setattr(saved_jobs, "DB_PATH", database_path)

    # Create the parent table required by the foreign key.
    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY
            )
        """)

    saved_jobs.initialize_database()

    result = saved_jobs.delete_saved_job(
        "nonexistent-job",
        999
    )

    assert result is False


def test_get_nonexistent_saved_job_returns_none(
    tmp_path,
    monkeypatch
):
    database_path = tmp_path / "get_test.db"
    monkeypatch.setattr(saved_jobs, "DB_PATH", database_path)

    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY
            )
        """)

    saved_jobs.initialize_database()

    result = saved_jobs.get_saved_job(
        "nonexistent-job",
        999
    )

    assert result is None
