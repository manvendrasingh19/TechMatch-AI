
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent / "techmatch.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with get_connection() as connection:
        tables = connection.execute("""
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name = 'saved_jobs'
        """).fetchone()

        if tables:
            columns = connection.execute(
                "PRAGMA table_info(saved_jobs)"
            ).fetchall()

            column_names = [column["name"] for column in columns]

            if "user_id" not in column_names:
                legacy_exists = connection.execute("""
                    SELECT name FROM sqlite_master
                    WHERE type = 'table'
                    AND name = 'saved_jobs_legacy'
                """).fetchone()

                if not legacy_exists:
                    connection.execute(
                        "ALTER TABLE saved_jobs RENAME TO saved_jobs_legacy"
                    )
                else:
                    connection.execute("DROP TABLE saved_jobs")

        connection.execute("""
            CREATE TABLE IF NOT EXISTS saved_jobs (
                user_id INTEGER NOT NULL,
                id TEXT NOT NULL,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                company TEXT,
                job_json TEXT NOT NULL,
                saved_at TEXT NOT NULL,
                PRIMARY KEY (user_id, id),
                FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_jobs_user
            ON saved_jobs(user_id)
        """)


def save_job(job, user_id):
    job_id = str(job.get("id", "")).strip()
    title = str(job.get("title", "")).strip()
    source = str(job.get("source", "")).strip()

    if not job_id or not title or not source:
        raise ValueError("Job ID, title and source are required.")

    saved_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute("""
            INSERT INTO saved_jobs
            (user_id, id, source, title, company, job_json, saved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, id) DO UPDATE SET
                source = excluded.source,
                title = excluded.title,
                company = excluded.company,
                job_json = excluded.job_json
        """, (
            user_id,
            job_id,
            source,
            title,
            job.get("company", ""),
            json.dumps(job),
            saved_at
        ))

    return get_saved_job(job_id, user_id)


def get_saved_job(job_id, user_id):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT * FROM saved_jobs
            WHERE id = ? AND user_id = ?
        """, (job_id, user_id)).fetchone()

    if row is None:
        return None

    result = dict(row)
    result["job"] = json.loads(result.pop("job_json"))
    return result


def get_all_saved_jobs(user_id):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT * FROM saved_jobs
            WHERE user_id = ?
            ORDER BY saved_at DESC
        """, (user_id,)).fetchall()

    results = []

    for row in rows:
        item = dict(row)
        item["job"] = json.loads(item.pop("job_json"))
        results.append(item)

    return results


def delete_saved_job(job_id, user_id):
    with get_connection() as connection:
        cursor = connection.execute("""
            DELETE FROM saved_jobs
            WHERE id = ? AND user_id = ?
        """, (job_id, user_id))

    return cursor.rowcount > 0


initialize_database()
