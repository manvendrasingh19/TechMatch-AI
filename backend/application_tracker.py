
import json
from contextlib import closing
from datetime import datetime, timezone

from saved_jobs import get_connection


VALID_STATUSES = {
    "Interested",
    "Applied",
    "Interview",
    "Offer",
    "Rejected",
}


def _current_timestamp():
    """Return the current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def initialize_application_database():
    """Create the application tracker table if it does not exist."""
    with closing(get_connection()) as connection:
        with connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    job_id TEXT NOT NULL,
                    job_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Interested',
                    application_date TEXT,
                    notes TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, job_id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                        ON DELETE CASCADE
                )
            """)

            connection.execute("""
                CREATE INDEX IF NOT EXISTS idx_applications_user
                ON applications(user_id)
            """)


def add_application(user_id, job, status="Interested", notes=""):
    """
    Add a job to the application tracker.

    If the job already exists for this user, refresh its job information
    without overwriting the existing status, notes, or application date.
    """
    if not isinstance(job, dict):
        raise ValueError("Job must be a dictionary.")

    if status not in VALID_STATUSES:
        raise ValueError("Invalid application status.")

    job_id = str(job.get("id") or job.get("apply_url") or "").strip()

    if not job_id:
        raise ValueError("Job must have an ID or application URL.")

    now = _current_timestamp()

    with closing(get_connection()) as connection:
        with connection:
            connection.execute("""
                INSERT INTO applications (
                    user_id,
                    job_id,
                    job_json,
                    status,
                    application_date,
                    notes,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(user_id, job_id) DO UPDATE SET
                    job_json = excluded.job_json,
                    updated_at = excluded.updated_at
            """, (
                user_id,
                job_id,
                json.dumps(job),
                status,
                now if status == "Applied" else None,
                notes,
                now,
                now,
            ))


def get_applications(user_id):
    """Return all applications belonging to a specific user."""
    with closing(get_connection()) as connection:
        rows = connection.execute("""
            SELECT *
            FROM applications
            WHERE user_id = ?
            ORDER BY updated_at DESC
        """, (user_id,)).fetchall()

    applications = []

    for row in rows:
        item = dict(row)
        item["job"] = json.loads(item.pop("job_json"))
        applications.append(item)

    return applications


def update_application(user_id, job_id, status=None, notes=None):
    """
    Update an application's status and/or notes.

    The application date is recorded the first time the status becomes
    Applied and is preserved on all subsequent updates.
    """
    if status is not None and status not in VALID_STATUSES:
        raise ValueError("Invalid application status.")

    now = _current_timestamp()

    with closing(get_connection()) as connection:
        with connection:
            existing = connection.execute("""
                SELECT status
                FROM applications
                WHERE user_id = ? AND job_id = ?
            """, (user_id, job_id)).fetchone()

            if not existing:
                return False

            new_status = (
                status if status is not None else existing["status"]
            )

            if notes is None:
                connection.execute("""
                    UPDATE applications
                    SET
                        status = ?,
                        application_date = CASE
                            WHEN ? = 'Applied'
                                AND application_date IS NULL
                            THEN ?
                            ELSE application_date
                        END,
                        updated_at = ?
                    WHERE user_id = ? AND job_id = ?
                """, (
                    new_status,
                    new_status,
                    now,
                    now,
                    user_id,
                    job_id,
                ))
            else:
                connection.execute("""
                    UPDATE applications
                    SET
                        status = ?,
                        notes = ?,
                        application_date = CASE
                            WHEN ? = 'Applied'
                                AND application_date IS NULL
                            THEN ?
                            ELSE application_date
                        END,
                        updated_at = ?
                    WHERE user_id = ? AND job_id = ?
                """, (
                    new_status,
                    notes,
                    new_status,
                    now,
                    now,
                    user_id,
                    job_id,
                ))

    return True


def delete_application(user_id, job_id):
    """Delete an application belonging to a specific user."""
    with closing(get_connection()) as connection:
        with connection:
            cursor = connection.execute("""
                DELETE FROM applications
                WHERE user_id = ? AND job_id = ?
            """, (user_id, job_id))

            deleted = cursor.rowcount > 0

    return deleted


def get_application_statistics(user_id):
    """Return application counts grouped by status for one user."""
    statistics = {
        status: 0 for status in VALID_STATUSES
    }

    with closing(get_connection()) as connection:
        rows = connection.execute("""
            SELECT status, COUNT(*) AS total
            FROM applications
            WHERE user_id = ?
            GROUP BY status
        """, (user_id,)).fetchall()

    for row in rows:
        if row["status"] in statistics:
            statistics[row["status"]] = row["total"]

    statistics["Total"] = sum(statistics.values())

    return statistics


initialize_application_database()
