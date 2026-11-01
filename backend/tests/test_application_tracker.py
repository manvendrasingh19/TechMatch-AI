import json
import sqlite3

import pytest

import application_tracker
import saved_jobs

@pytest.fixture
def tracker_db(tmp_path, monkeypatch):
    database_path = tmp_path / "test_applications.db"
    monkeypatch.setattr(
        saved_jobs, "DB_PATH", database_path
    )

    # Create the parent table required by the foreign key.
    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY
            )
        """)
        connection.execute(
            "INSERT INTO users (id) VALUES (1)"
        )

    application_tracker.initialize_application_database()

    return database_path


def sample_job(job_id="job-101"):
    return {
        "id": job_id,
        "title": "Python Developer",
        "company": "Tech Company",
        "apply_url": "https://example.com/apply",
    }


def test_initialize_application_database(tracker_db):
    with sqlite3.connect(tracker_db) as connection:
        result = connection.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = 'applications'
        """).fetchone()

    assert result is not None


def test_add_application_success(tracker_db):
    application_tracker.add_application(
        1, sample_job(), notes="Prepare for interview"
    )

    applications = application_tracker.get_applications(1)

    assert len(applications) == 1
    assert applications[0]["job"]["title"] == "Python Developer"
    assert applications[0]["status"] == "Interested"
    assert applications[0]["notes"] == "Prepare for interview"
    assert applications[0]["application_date"] is None


def test_add_application_with_applied_status(tracker_db):
    application_tracker.add_application(
        1, sample_job(), status="Applied"
    )

    application = application_tracker.get_applications(1)[0]

    assert application["status"] == "Applied"
    assert application["application_date"] is not None


def test_add_application_uses_apply_url_when_id_missing(tracker_db):
    job = {
        "title": "Backend Developer",
        "apply_url": "https://example.com/backend",
    }

    application_tracker.add_application(1, job)

    applications = application_tracker.get_applications(1)

    assert len(applications) == 1
    assert applications[0]["job_id"] == "https://example.com/backend"


def test_add_application_rejects_invalid_status(tracker_db):
    with pytest.raises(ValueError, match="Invalid application status"):
        application_tracker.add_application(
            1, sample_job(), status="Unknown"
        )


@pytest.mark.parametrize("job", [
    {},
    {"title": "Python Developer"},
    {"id": "", "apply_url": ""},
])
def test_add_application_rejects_job_without_identifier(
    tracker_db, job
):
    with pytest.raises(
        ValueError, match="Job must have an ID or application URL"
    ):
        application_tracker.add_application(1, job)



def test_add_application_preserves_tracking_data_on_duplicate_save(
    tracker_db
):
    application_tracker.add_application(
        1, sample_job(), notes="Original notes"
    )

    updated_job = {
        "id": "job-101",
        "title": "Senior Python Developer",
        "company": "Updated Company",
    }

    application_tracker.add_application(
        1,
        updated_job,
        status="Interview",
        notes="Interview scheduled",
    )

    applications = application_tracker.get_applications(1)

    assert len(applications) == 1

    # Job information should be refreshed.
    assert applications[0]["job"]["title"] == (
        "Senior Python Developer"
    )
    assert applications[0]["job"]["company"] == "Updated Company"

    # Existing tracking information should be preserved.
    assert applications[0]["status"] == "Interested"
    assert applications[0]["notes"] == "Original notes"
    assert applications[0]["application_date"] is None



def test_get_applications_returns_empty_list(tracker_db):
    assert application_tracker.get_applications(1) == []


def test_get_applications_only_returns_requested_users(tracker_db):
    application_tracker.add_application(1, sample_job("job-1"))
    application_tracker.add_application(1, sample_job("job-2"))

    assert len(application_tracker.get_applications(1)) == 2
    assert application_tracker.get_applications(2) == []


def test_update_application_status(tracker_db):
    application_tracker.add_application(1, sample_job())

    result = application_tracker.update_application(
        1, "job-101", status="Interview"
    )

    application = application_tracker.get_applications(1)[0]

    assert result is True
    assert application["status"] == "Interview"


def test_update_application_notes(tracker_db):
    application_tracker.add_application(1, sample_job())

    result = application_tracker.update_application(
        1, "job-101", notes="Follow up next week"
    )

    application = application_tracker.get_applications(1)[0]

    assert result is True
    assert application["notes"] == "Follow up next week"


def test_update_application_status_and_notes(tracker_db):
    application_tracker.add_application(1, sample_job())

    result = application_tracker.update_application(
        1,
        "job-101",
        status="Offer",
        notes="Offer received",
    )

    application = application_tracker.get_applications(1)[0]

    assert result is True
    assert application["status"] == "Offer"
    assert application["notes"] == "Offer received"


def test_update_application_rejects_invalid_status(tracker_db):
    application_tracker.add_application(1, sample_job())

    with pytest.raises(ValueError, match="Invalid application status"):
        application_tracker.update_application(
            1, "job-101", status="Unknown"
        )


def test_update_nonexistent_application_returns_false(tracker_db):
    result = application_tracker.update_application(
        1, "missing-job", status="Applied"
    )

    assert result is False


def test_delete_application_success(tracker_db):
    application_tracker.add_application(1, sample_job())

    result = application_tracker.delete_application(1, "job-101")

    assert result is True
    assert application_tracker.get_applications(1) == []


def test_delete_nonexistent_application_returns_false(tracker_db):
    result = application_tracker.delete_application(
        1, "missing-job"
    )

    assert result is False


def test_application_statistics(tracker_db):
    application_tracker.add_application(
        1, sample_job("job-1"), status="Applied"
    )
    application_tracker.add_application(
        1, sample_job("job-2"), status="Interview"
    )
    application_tracker.add_application(
        1, sample_job("job-3"), status="Rejected"
    )

    statistics = application_tracker.get_application_statistics(1)

    assert statistics["Applied"] == 1
    assert statistics["Interview"] == 1
    assert statistics["Rejected"] == 1
    assert statistics["Interested"] == 0
    assert statistics["Offer"] == 0
    assert statistics["Total"] == 3


def test_application_statistics_for_empty_user(tracker_db):
    statistics = application_tracker.get_application_statistics(2)

    assert statistics["Total"] == 0
    assert sum(
        statistics[status]
        for status in application_tracker.VALID_STATUSES
    ) == 0

def test_updating_status_to_applied_sets_application_date(tracker_db):
    application_tracker.add_application(
        1, sample_job(), status="Interested"
    )

    result = application_tracker.update_application(
        1, "job-101", status="Applied"
    )

    application = application_tracker.get_applications(1)[0]

    assert result is True
    assert application["status"] == "Applied"
    assert application["application_date"] is not None


def test_duplicate_save_preserves_applied_status_and_date(tracker_db):
    application_tracker.add_application(
        1, sample_job(), status="Applied"
    )

    original = application_tracker.get_applications(1)[0]
    original_date = original["application_date"]

    application_tracker.add_application(
        1,
        {
            "id": "job-101",
            "title": "Updated Python Developer",
            "company": "New Company",
        },
        status="Interested",
        notes="New notes",
    )

    updated = application_tracker.get_applications(1)[0]

    assert updated["status"] == "Applied"
    assert updated["application_date"] == original_date
    assert updated["notes"] == ""


def test_duplicate_save_does_not_set_applied_date_for_existing_record(
    tracker_db
):
    application_tracker.add_application(
        1, sample_job(), status="Interested"
    )

    application_tracker.add_application(
        1,
        sample_job(),
        status="Applied",
    )

    application = application_tracker.get_applications(1)[0]

    # A duplicate POST must not silently change tracking status.
    assert application["status"] == "Interested"
    assert application["application_date"] is None


def test_add_application_rejects_non_dictionary_job(tracker_db):
    with pytest.raises(ValueError, match="Job must be a dictionary"):
        application_tracker.add_application(1, "invalid job")


def test_deleting_user_cascades_to_applications(tracker_db):
    application_tracker.add_application(1, sample_job())

    connection = saved_jobs.get_connection()

    try:
        connection.execute("DELETE FROM users WHERE id = 1")
        connection.commit()

        remaining = connection.execute(
            "SELECT COUNT(*) FROM applications WHERE user_id = 1"
        ).fetchone()[0]
    finally:
        connection.close()

    assert remaining == 0
