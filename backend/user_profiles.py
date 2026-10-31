
import json

from saved_jobs import get_connection


def initialize_profiles_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id INTEGER PRIMARY KEY,
                preferred_location TEXT DEFAULT 'India',
                preferred_categories TEXT DEFAULT '[]',
                preferred_job_type TEXT DEFAULT 'Any',
                preferred_work_mode TEXT DEFAULT 'Any',
                resume_filename TEXT DEFAULT '',
                extracted_skills TEXT DEFAULT '[]',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        """)


def get_profile(user_id):
    with get_connection() as connection:
        connection.execute("""
            INSERT OR IGNORE INTO user_profiles (user_id)
            VALUES (?)
        """, (user_id,))

        row = connection.execute("""
            SELECT * FROM user_profiles WHERE user_id = ?
        """, (user_id,)).fetchone()

    profile = dict(row)
    profile["preferred_categories"] = json.loads(
        profile["preferred_categories"]
    )
    profile["extracted_skills"] = json.loads(
        profile["extracted_skills"]
    )

    return profile


def update_profile(user_id, data):
    with get_connection() as connection:
        connection.execute("""
            INSERT OR IGNORE INTO user_profiles (user_id)
            VALUES (?)
        """ , (user_id,))

        connection.execute("""
            UPDATE user_profiles
            SET preferred_location = ?,
                preferred_categories = ?,
                preferred_job_type = ?,
                preferred_work_mode = ?,
                resume_filename = ?,
                extracted_skills = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (
            data["preferred_location"],
            json.dumps(data["preferred_categories"]),
            data["preferred_job_type"],
            data["preferred_work_mode"],
            data["resume_filename"],
            json.dumps(data["extracted_skills"]),
            user_id
        ))

    return get_profile(user_id)


initialize_profiles_database()
