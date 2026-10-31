
import pytest

import main


@pytest.fixture
def sample_jobs():
    return [
        {
            "id": "1",
            "title": "Python Developer",
            "description": "Remote Python and FastAPI development",
            "location": "India",
            "job_type": "Full-time",
            "category": "Software Development",
            "salary_min": 600000,
            "skills": ["Python", "FastAPI"]
        },
        {
            "id": "2",
            "title": "Java Intern",
            "description": "Hybrid Java development",
            "location": "Bhopal",
            "job_type": "Internship",
            "category": "Software Development",
            "salary_min": 200000,
            "skills": ["Java"]
        },
        {
            "id": "3",
            "title": "Data Scientist",
            "description": "Senior machine learning engineer",
            "location": "Worldwide",
            "job_type": "Contract",
            "category": "Data Science",
            "salary_min": 1000000,
            "skills": ["Python", "Machine Learning"]
        }
    ]


def make_request(**overrides):
    data = {
        "resume_text": "Python developer",
        "keyword": "software",
        "location": "",
        "sources": ["Remotive"],
        "limit": 10,
        "include_demo": False,
        "job_type": "Any",
        "experience_level": "Any",
        "work_mode": "Any",
        "min_salary": None,
        "required_skills": []
    }

    data.update(overrides)

    return main.UnifiedJobSearchRequest(**data)


def test_filter_jobs_without_filters(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request()
    )

    assert len(result) == 3


def test_filter_jobs_by_full_time(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(job_type="Full-time")
    )

    assert [job["id"] for job in result] == ["1"]


def test_filter_jobs_by_internship(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(job_type="Internship")
    )

    assert [job["id"] for job in result] == ["2"]


def test_filter_jobs_by_experience(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(experience_level="Senior")
    )

    assert [job["id"] for job in result] == ["1", "2", "3"]


def test_filter_jobs_by_remote_mode(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(work_mode="Remote")
    )

    assert [job["id"] for job in result] == ["1", "3"]


def test_filter_jobs_by_hybrid_mode(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(work_mode="Hybrid")
    )

    assert [job["id"] for job in result] == ["2", "3"]


def test_filter_jobs_by_minimum_salary(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(min_salary=500000)
    )

    assert [job["id"] for job in result] == ["1", "3"]


def test_filter_jobs_retains_unknown_salary():
    jobs = [
        {"id": "1", "title": "Python Developer"},
        {"id": "2", "title": "Java Developer", "salary_min": 200000}
    ]

    result = main.filter_jobs(
        jobs,
        make_request(min_salary=500000)
    )

    assert [job["id"] for job in result] == ["1"]


def test_filter_jobs_by_required_skills(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(required_skills=["Python", "FastAPI"])
    )

    assert [job["id"] for job in result] == ["1"]


def test_filter_jobs_rejects_missing_required_skill(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(required_skills=["Python", "Docker"])
    )

    assert result == []


def test_filter_jobs_case_insensitive_skills(sample_jobs):
    result = main.filter_jobs(
        sample_jobs,
        make_request(required_skills=["PYTHON"])
    )

    assert [job["id"] for job in result] == ["1", "3"]


def test_filter_jobs_retains_unknown_job_type():
    jobs = [
        {"id": "1", "title": "Developer"}
    ]

    result = main.filter_jobs(
        jobs,
        make_request(job_type="Full-time")
    )

    assert len(result) == 1


# --------------------------------------------------
# Preference matching tests
# --------------------------------------------------

def test_preference_match_no_preferences():
    score, reasons = main.calculate_preference_match(
        {"title": "Python Developer"},
        {}
    )

    assert score == 100
    assert reasons == []


def test_preference_match_all_preferences():
    job = {
        "title": "Python Developer",
        "description": "Remote full-time Python development",
        "category": "Software Development",
        "location": "India",
        "job_type": "Full-time"
    }

    profile = {
        "preferred_categories": ["Python"],
        "preferred_location": "India",
        "preferred_job_type": "Full-time",
        "preferred_work_mode": "Remote"
    }

    score, reasons = main.calculate_preference_match(job, profile)

    assert score == 100
    assert len(reasons) == 4


def test_preference_match_no_matching_preferences():
    job = {
        "title": "Java Developer",
        "description": "Onsite internship",
        "category": "Java Development",
        "location": "USA",
        "job_type": "Internship"
    }

    profile = {
        "preferred_categories": ["Python"],
        "preferred_location": "India",
        "preferred_job_type": "Full-time",
        "preferred_work_mode": "Remote"
    }

    score, reasons = main.calculate_preference_match(job, profile)

    assert score == 0
    assert reasons == []


def test_preference_match_remote_location():
    job = {
        "title": "Backend Developer",
        "description": "Work from home",
        "location": "Worldwide"
    }

    profile = {
        "preferred_location": "India"
    }

    score, reasons = main.calculate_preference_match(job, profile)

    assert score == 100
    assert "Matches preferred location or remote preference" in reasons


def test_preference_match_empty_profile():
    score, reasons = main.calculate_preference_match(
        {"title": "Software Developer"},
        {}
    )

    assert score == 100
    assert reasons == []


def test_filter_jobs_rejects_wrong_experience_level():
    jobs = [
        {
            "id": "1",
            "title": "Junior Python Developer",
            "description": "Entry-level role with 1 year experience"
        },
        {
            "id": "2",
            "title": "Senior Python Developer",
            "description": "Senior role with 6 years experience"
        }
    ]

    result = main.filter_jobs(
        jobs,
        make_request(experience_level="Senior")
    )

    assert [job["id"] for job in result] == ["2"]


@pytest.mark.parametrize(
    "invalid_salary",
    ["not disclosed", []]
)
def test_filter_jobs_ignores_invalid_salary(invalid_salary):
    jobs = [
        {
            "id": "1",
            "title": "Python Developer",
            "salary_min": invalid_salary
        }
    ]

    result = main.filter_jobs(
        jobs,
        make_request(min_salary=500000)
    )

    assert len(result) == 1
