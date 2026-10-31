
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Use test-only authentication settings.
os.environ["JWT_SECRET"] = (
    "pytest-api-secret-key-for-isolated-testing-123456"
)
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_EXPIRE_MINUTES"] = "1440"

# Import the database module and redirect its initial
# initialization away from the real project database.
import saved_jobs

_IMPORT_TEST_DB = (
    Path(tempfile.gettempdir()) / "techmatch_api_import_test.db"
)
saved_jobs.DB_PATH = _IMPORT_TEST_DB

# Import the application only after setting the safe DB path.
import main
import auth
import user_profiles

@pytest.fixture
def client(tmp_path, monkeypatch):
    """Provide an API client with a fresh temporary database."""

    database_path = tmp_path / "test_techmatch.db"
    monkeypatch.setattr(saved_jobs, "DB_PATH", database_path)

    # Initialize tables in the correct order.
    auth.initialize_auth_database()
    saved_jobs.initialize_database()
    user_profiles.initialize_profiles_database()

    with TestClient(main.app) as test_client:
        yield test_client


# --------------------------------------------------
# Homepage and health-check tests
# --------------------------------------------------

def test_homepage(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Welcome to TechMatch AI!",
        "status": "Backend is running successfully"
    }


def test_health_check(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "project": "TechMatch AI"
    }


# --------------------------------------------------
# Authentication API tests
# --------------------------------------------------

def register_test_user(client):
    return client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )


def test_register_user(client):
    response = register_test_user(client)

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["user"]["name"] == "Test User"
    assert data["user"]["email"] == "testuser@example.com"


def test_register_duplicate_email(client):
    register_test_user(client)

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Another User",
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_register_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "not-an-email",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 422


def test_register_short_password(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "testuser@example.com",
            "password": "short"
        }
    )

    assert response.status_code == 422


def test_register_short_name(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "A",
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 422


def test_login_success(client):
    register_test_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "testuser@example.com"


def test_login_wrong_password(client):
    register_test_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "WrongPassword123"
        }
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_login_unknown_user(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "unknown@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 401


def test_current_user_requires_authentication(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_current_user_with_valid_token(client):
    register_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )

    token = login_response.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["user"]["email"] == "testuser@example.com"


def test_current_user_with_invalid_token(client):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"}
    )

    assert response.status_code == 401


# --------------------------------------------------
# Resume analysis API tests
# --------------------------------------------------

def test_resume_upload_unsupported_file(client):
    response = client.post(
        "/api/resume/analyze",
        files={"file": ("resume.txt", b"Some resume text", "text/plain")}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Only PDF and DOCX resumes are supported."
    )


def test_resume_upload_empty_file(client):
    response = client.post(
        "/api/resume/analyze",
        files={"file": ("resume.pdf", b"", "application/pdf")}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The uploaded file is empty."


def test_resume_upload_too_large(client):
    large_file = b"x" * (5 * 1024 * 1024 + 1)

    response = client.post(
        "/api/resume/analyze",
        files={"file": ("resume.pdf", large_file, "application/pdf")}
    )

    assert response.status_code == 413


def test_resume_upload_success(client, monkeypatch):
    expected_result = {
        "filename": "resume.pdf",
        "skills": ["Python", "FastAPI"]
    }

    monkeypatch.setattr(
        main,
        "analyze_resume",
        lambda filename, file_bytes: expected_result
    )

    response = client.post(
        "/api/resume/analyze",
        files={"file": ("resume.pdf", b"fake PDF content", "application/pdf")}
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == expected_result


def test_resume_upload_processing_error(client, monkeypatch):
    def raise_error(filename, file_bytes):
        raise RuntimeError("Processing failed")

    monkeypatch.setattr(main, "analyze_resume", raise_error)

    response = client.post(
        "/api/resume/analyze",
        files={"file": ("resume.pdf", b"fake PDF content", "application/pdf")}
    )

    assert response.status_code == 400
    assert "Unable to process this resume" in response.json()["detail"]


# --------------------------------------------------
# Job recommendation API tests
# --------------------------------------------------

def test_job_recommendations_success(client, monkeypatch):
    expected_jobs = [
        {
            "title": "Python Developer",
            "company": "Example Company",
            "score": 85
        }
    ]

    monkeypatch.setattr(
        main,
        "recommend_jobs",
        lambda resume_text, limit: expected_jobs
    )

    response = client.post(
        "/api/jobs/recommend",
        json={
            "resume_text": "Python developer with FastAPI experience",
            "limit": 5
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["total_jobs"] == 1
    assert data["recommendations"] == expected_jobs


def test_job_recommendations_empty_resume(client):
    response = client.post(
        "/api/jobs/recommend",
        json={"resume_text": "   ", "limit": 5}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Resume text cannot be empty."


@pytest.mark.parametrize("limit", [0, 51, -1])
def test_job_recommendations_invalid_limit(client, limit):
    response = client.post(
        "/api/jobs/recommend",
        json={
            "resume_text": "Python developer",
            "limit": limit
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Limit must be between 1 and 50."



# --------------------------------------------------
# Saved jobs API tests
# --------------------------------------------------

def get_auth_headers(client):
    register_test_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "StrongPass123"
        }
    )

    token = response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


def test_save_job_success(client):
    headers = get_auth_headers(client)

    job = {
        "id": "job-101",
        "source": "Remotive",
        "title": "Python Developer",
        "company": "Example Company"
    }

    response = client.post(
        "/api/jobs/saved",
        json={"job": job},
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["saved_job"]["id"] == "job-101"


@pytest.mark.parametrize(
    "job",
    [
        {},
        {"id": "job-102"},
        {"title": "Python Developer", "source": "Remotive"},
        {"id": "job-103", "title": "Python Developer"},
    ]
)
def test_save_job_missing_required_fields(client, job):
    headers = get_auth_headers(client)

    response = client.post(
        "/api/jobs/saved",
        json={"job": job},
        headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Job ID, title and source are required."
    )


def test_list_saved_jobs(client):
    headers = get_auth_headers(client)

    job = {
        "id": "job-101",
        "source": "Remotive",
        "title": "Python Developer",
        "company": "Example Company"
    }

    client.post(
        "/api/jobs/saved",
        json={"job": job},
        headers=headers
    )

    response = client.get(
        "/api/jobs/saved",
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["total_saved"] == 1
    assert data["saved_jobs"][0]["id"] == "job-101"


def test_delete_saved_job(client):
    headers = get_auth_headers(client)

    job = {
        "id": "job-101",
        "source": "Remotive",
        "title": "Python Developer"
    }

    client.post(
        "/api/jobs/saved",
        json={"job": job},
        headers=headers
    )

    response = client.delete(
        "/api/jobs/saved/job-101",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["success"] is True

    list_response = client.get(
        "/api/jobs/saved",
        headers=headers
    )

    assert list_response.json()["total_saved"] == 0


def test_delete_nonexistent_saved_job(client):
    headers = get_auth_headers(client)

    response = client.delete(
        "/api/jobs/saved/unknown-job",
        headers=headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Saved job was not found."


@pytest.mark.parametrize(
    "method,url",
    [
        ("get", "/api/jobs/saved"),
        ("post", "/api/jobs/saved"),
        ("delete", "/api/jobs/saved/job-101"),
    ]
)
def test_saved_jobs_require_authentication(client, method, url):
    response = getattr(client, method)(url)

    assert response.status_code == 401


# --------------------------------------------------
# User profile API tests
# --------------------------------------------------

def test_get_user_profile(client):
    headers = get_auth_headers(client)

    response = client.get(
        "/api/profile",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["success"] is True

    profile = response.json()["profile"]

    assert profile["preferred_location"] == "India"
    assert profile["preferred_categories"] == []
    assert profile["preferred_job_type"] == "Any"
    assert profile["preferred_work_mode"] == "Any"


def test_update_user_profile(client):
    headers = get_auth_headers(client)

    profile_data = {
        "preferred_location": "India",
        "preferred_categories": ["Software Development", "AI"],
        "preferred_job_type": "Full-time",
        "preferred_work_mode": "Remote",
        "resume_filename": "resume.pdf",
        "extracted_skills": ["Python", "FastAPI"]
    }

    response = client.put(
        "/api/profile",
        json=profile_data,
        headers=headers
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["profile"]["preferred_location"] == "India"
    assert data["profile"]["preferred_categories"] == [
        "Software Development", "AI"
    ]
    assert data["profile"]["preferred_job_type"] == "Full-time"
    assert data["profile"]["preferred_work_mode"] == "Remote"
    assert data["profile"]["extracted_skills"] == ["Python", "FastAPI"]


def test_update_profile_invalid_job_type(client):
    headers = get_auth_headers(client)

    profile_data = {
        "preferred_location": "India",
        "preferred_categories": [],
        "preferred_job_type": "Invalid Type",
        "preferred_work_mode": "Remote",
        "resume_filename": "",
        "extracted_skills": []
    }

    response = client.put(
        "/api/profile",
        json=profile_data,
        headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid preferred job type."


def test_update_profile_invalid_work_mode(client):
    headers = get_auth_headers(client)

    profile_data = {
        "preferred_location": "India",
        "preferred_categories": [],
        "preferred_job_type": "Full-time",
        "preferred_work_mode": "Invalid Mode",
        "resume_filename": "",
        "extracted_skills": []
    }

    response = client.put(
        "/api/profile",
        json=profile_data,
        headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid preferred work mode."


def test_update_profile_too_many_categories(client):
    headers = get_auth_headers(client)

    profile_data = {
        "preferred_location": "India",
        "preferred_categories": [
            f"Category {number}" for number in range(21)
        ],
        "preferred_job_type": "Any",
        "preferred_work_mode": "Any",
        "resume_filename": "",
        "extracted_skills": []
    }

    response = client.put(
        "/api/profile",
        json=profile_data,
        headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Select no more than 20 categories."
    )


def test_update_profile_too_many_skills(client):
    headers = get_auth_headers(client)

    profile_data = {
        "preferred_location": "India",
        "preferred_categories": [],
        "preferred_job_type": "Any",
        "preferred_work_mode": "Any",
        "resume_filename": "",
        "extracted_skills": [
            f"Skill {number}" for number in range(101)
        ]
    }

    response = client.put(
        "/api/profile",
        json=profile_data,
        headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Too many extracted skills."


def test_profile_requires_authentication(client):
    response = client.get("/api/profile")

    assert response.status_code == 401


def test_update_profile_requires_authentication(client):
    response = client.put(
        "/api/profile",
        json={
            "preferred_location": "India",
            "preferred_categories": [],
            "preferred_job_type": "Any",
            "preferred_work_mode": "Any",
            "resume_filename": "",
            "extracted_skills": []
        }
    )

    assert response.status_code == 401


# --------------------------------------------------
# Unified Job Search API tests
# --------------------------------------------------

def test_job_search_success(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    jobs = [
        {
            "id": "job-101",
            "title": "Python Developer",
            "company": "Tech Company",
            "description": "Python FastAPI development",
            "match_score": 88
        }
    ]

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=jobs)
    )

    monkeypatch.setattr(
        main,
        "fetch_adzuna_jobs",
        AsyncMock(return_value=[])
    )

    monkeypatch.setattr(main, "get_profile", lambda user_id: {})

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, job_list, limit: job_list
    )

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer with FastAPI experience",
            "keyword": "Python",
            "location": "India",
            "sources": ["Remotive"],
            "limit": 10
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["keyword"] == "Python"
    assert data["total_jobs_collected"] == 1
    assert data["total_jobs_after_filters"] == 1
    assert data["total_recommendations"] == 1
    assert data["recommendations"][0]["title"] == "Python Developer"


def test_job_search_removes_duplicate_jobs(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    job = {
        "title": "Python Developer",
        "company": "Tech Company",
        "description": "Python development",
        "match_score": 90
    }

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=[job])
    )

    monkeypatch.setattr(
        main,
        "fetch_adzuna_jobs",
        AsyncMock(return_value=[job.copy()])
    )

    monkeypatch.setattr(main, "get_profile", lambda user_id: {})

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: jobs
    )

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Remotive", "Adzuna"]
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_jobs_collected"] == 1
    assert data["total_recommendations"] == 1


def test_job_search_empty_resume(client):
    headers = get_auth_headers(client)

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "   ",
            "sources": ["Remotive"]
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Resume text cannot be empty."


@pytest.mark.parametrize("limit", [0, 51, -1])
def test_job_search_invalid_limit(client, limit):
    headers = get_auth_headers(client)

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Remotive"],
            "limit": limit
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Limit must be between 1 and 50."
    )


def test_job_search_without_sources(client):
    headers = get_auth_headers(client)

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": []
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Select at least one job source."
    )


def test_job_search_unsupported_source(client):
    headers = get_auth_headers(client)

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["LinkedIn"]
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Unsupported job source selected."
    )


def test_job_search_source_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(side_effect=Exception("Remotive unavailable"))
    )

    monkeypatch.setattr(main, "get_profile", lambda user_id: {})

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: []
    )

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Remotive"]
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["total_jobs_collected"] == 0
    assert "Remotive: Remotive unavailable" in data["source_warnings"]


def test_job_search_ranking_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=[])
    )

    def raise_ranking_error(*args, **kwargs):
        raise Exception("Test ranking failure")

    monkeypatch.setattr(main, "rank_jobs", raise_ranking_error)

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Remotive"]
        }
    )

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "AI ranking failed: Test ranking failure"
    )


# --------------------------------------------------
# Live Job Recommendations API tests
# --------------------------------------------------

def test_recommend_live_success(client, monkeypatch):
    from unittest.mock import AsyncMock

    demo_jobs = [
        {
            "title": "Python Developer",
            "company": "Demo Company",
            "description": "Python development"
        }
    ]

    live_jobs = [
        {
            "title": "Java Developer",
            "company": "Live Company",
            "description": "Java development"
        }
    ]

    monkeypatch.setattr(main, "load_jobs", lambda: demo_jobs)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=live_jobs)
    )

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: jobs[:limit]
    )

    response = client.post(
        "/api/jobs/recommend-live",
        json={
            "resume_text": "Python and Java developer",
            "limit": 10
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["total_jobs_checked"] == 2
    assert data["total_recommendations"] == 2
    assert data["sources"] == ["Demo Dataset", "Remotive"]
    assert data["source_warnings"] == []


def test_recommend_live_removes_duplicates(client, monkeypatch):
    from unittest.mock import AsyncMock

    demo_jobs = [
        {
            "title": "Python Developer",
            "company": "Tech Company",
            "description": "Demo job"
        }
    ]

    live_jobs = [
        {
            "title": " python developer ",
            "company": "TECH COMPANY",
            "description": "Live job"
        }
    ]

    monkeypatch.setattr(main, "load_jobs", lambda: demo_jobs)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=live_jobs)
    )

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: jobs
    )

    response = client.post(
        "/api/jobs/recommend-live",
        json={"resume_text": "Python developer"}
    )

    assert response.status_code == 200
    assert response.json()["total_jobs_checked"] == 1
    assert response.json()["total_recommendations"] == 1


def test_recommend_live_remotive_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    demo_jobs = [
        {
            "title": "Python Developer",
            "company": "Demo Company",
            "description": "Python development"
        }
    ]

    monkeypatch.setattr(main, "load_jobs", lambda: demo_jobs)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(side_effect=Exception("API unavailable"))
    )

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: jobs
    )

    response = client.post(
        "/api/jobs/recommend-live",
        json={"resume_text": "Python developer"}
    )

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["total_jobs_checked"] == 1
    assert data["total_recommendations"] == 1
    assert data["source_warnings"] == [
        "Remotive could not be reached: API unavailable"
    ]


def test_recommend_live_empty_resume(client):
    response = client.post(
        "/api/jobs/recommend-live",
        json={"resume_text": "   "}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Resume text cannot be empty."
    )


@pytest.mark.parametrize("limit", [0, 51, -1])
def test_recommend_live_invalid_limit(client, limit):
    response = client.post(
        "/api/jobs/recommend-live",
        json={
            "resume_text": "Python developer",
            "limit": limit
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Limit must be between 1 and 50."
    )


def test_recommend_live_ranking_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(main, "load_jobs", lambda: [])

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=[])
    )

    def raise_ranking_error(*args, **kwargs):
        raise Exception("Test ranking failure")

    monkeypatch.setattr(main, "rank_jobs", raise_ranking_error)

    response = client.post(
        "/api/jobs/recommend-live",
        json={"resume_text": "Python developer"}
    )

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "Combined job matching failed: Test ranking failure"
    )


# --------------------------------------------------
# Live Job Sources API tests
# --------------------------------------------------

def test_live_jobs_success(client, monkeypatch):
    from unittest.mock import AsyncMock

    mock_jobs = [
        {
            "title": "Python Developer",
            "company": "Tech Company"
        },
        {
            "title": "Java Developer",
            "company": "Software Company"
        }
    ]

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=mock_jobs)
    )

    response = client.get("/api/jobs/live")

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["source"] == "Remotive"
    assert data["total_jobs"] == 2
    assert len(data["jobs"]) == 2


def test_live_jobs_api_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(side_effect=Exception("Remotive unavailable"))
    )

    response = client.get("/api/jobs/live")

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "Could not fetch live jobs: Remotive unavailable"
    )


def test_adzuna_jobs_success(client, monkeypatch):
    from unittest.mock import AsyncMock

    mock_jobs = [
        {
            "title": "Software Developer",
            "company": "Adzuna Company"
        }
    ]

    mock_fetch = AsyncMock(return_value=mock_jobs)

    monkeypatch.setattr(
        main,
        "fetch_adzuna_jobs",
        mock_fetch
    )

    response = client.get("/api/jobs/adzuna")

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["source"] == "Adzuna"
    assert data["total_jobs"] == 1
    assert len(data["jobs"]) == 1

    mock_fetch.assert_awaited_once_with(
        keyword="software developer",
        location="India"
    )


def test_adzuna_jobs_api_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        main,
        "fetch_adzuna_jobs",
        AsyncMock(side_effect=Exception("Adzuna unavailable"))
    )

    response = client.get("/api/jobs/adzuna")

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "Adzuna fetch failed: Adzuna unavailable"
    )


# --------------------------------------------------
# Additional API exception-handling tests
# --------------------------------------------------

def test_resume_analysis_value_error(client, monkeypatch):
    def raise_value_error(filename, file_bytes):
        raise ValueError("Invalid resume content")

    monkeypatch.setattr(
        main,
        "analyze_resume",
        raise_value_error
    )

    response = client.post(
        "/api/resume/analyze",
        files={
            "file": (
                "resume.pdf",
                b"fake resume content",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid resume content"


def test_job_recommendation_failure(client, monkeypatch):
    def raise_recommendation_error(*args, **kwargs):
        raise Exception("AI engine unavailable")

    monkeypatch.setattr(
        main,
        "recommend_jobs",
        raise_recommendation_error
    )

    response = client.post(
        "/api/jobs/recommend",
        json={
            "resume_text": "Python developer",
            "limit": 10
        }
    )

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "Job recommendation failed: AI engine unavailable"
    )


def test_current_user_account_not_found(client, monkeypatch):
    headers = get_auth_headers(client)

    monkeypatch.setattr(
        main,
        "get_user_by_id",
        lambda user_id: None
    )

    response = client.get(
        "/api/profile",
        headers=headers
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "User account not found."


def test_registration_value_error(client, monkeypatch):
    def raise_registration_error(*args, **kwargs):
        raise ValueError("Registration validation failed")

    monkeypatch.setattr(
        main,
        "create_user",
        raise_registration_error
    )

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Another User",
            "email": "another@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Registration validation failed"
    )


def test_registration_unexpected_error(client, monkeypatch):
    def raise_database_error(*args, **kwargs):
        raise RuntimeError("Database connection lost")

    monkeypatch.setattr(
        main,
        "create_user",
        raise_database_error
    )

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Another User",
            "email": "another@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Registration failed."


def test_job_search_applies_profile_personalization(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    demo_jobs = [
        {
            "id": "demo-101",
            "title": "Python Developer",
            "company": "Tech Company",
            "description": "Remote full-time Python development",
            "location": "India",
            "job_type": "Full-time",
            "category": "Software Development",
            "match_score": 80
        }
    ]

    profile = {
        "preferred_categories": ["Python"],
        "preferred_location": "India",
        "preferred_job_type": "Full-time",
        "preferred_work_mode": "Remote"
    }

    monkeypatch.setattr(main, "load_jobs", lambda: demo_jobs)

    monkeypatch.setattr(
        main,
        "fetch_remotive_jobs",
        AsyncMock(return_value=[])
    )

    monkeypatch.setattr(main, "get_profile", lambda user_id: profile)

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: jobs
    )

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Remotive"],
            "include_demo": True,
            "limit": 10
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_jobs_collected"] == 1
    assert data["total_recommendations"] == 1

    recommendation = data["recommendations"][0]

    assert recommendation["resume_match_score"] == 80
    assert recommendation["preference_match_score"] == 100
    assert recommendation["match_score"] == 84
    assert len(recommendation["personalization_reasons"]) == 4


def test_job_search_adzuna_failure(client, monkeypatch):
    from unittest.mock import AsyncMock

    headers = get_auth_headers(client)

    monkeypatch.setattr(
        main,
        "fetch_adzuna_jobs",
        AsyncMock(side_effect=Exception("Adzuna unavailable"))
    )

    monkeypatch.setattr(main, "get_profile", lambda user_id: {})

    monkeypatch.setattr(
        main,
        "rank_jobs",
        lambda resume, jobs, limit: []
    )

    response = client.post(
        "/api/jobs/search",
        headers=headers,
        json={
            "resume_text": "Python developer",
            "sources": ["Adzuna"]
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["success"] is True
    assert data["total_jobs_collected"] == 0
    assert "Adzuna: Adzuna unavailable" in data["source_warnings"]
