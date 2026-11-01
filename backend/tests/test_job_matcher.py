
import numpy as np
import pytest
from unittest.mock import patch

from job_matcher import (
    calculate_skill_match,
    rank_jobs,
)


# -------------------------------------------------
# Tests for calculate_skill_match()
# -------------------------------------------------

def test_all_skills_matched():
    score, matched, missing = calculate_skill_match(
        "Python React SQL",
        ["Python", "React", "SQL"]
    )

    assert score == 1.0
    assert matched == ["Python", "React", "SQL"]
    assert missing == []


def test_partial_skills_matched():
    score, matched, missing = calculate_skill_match(
        "Python React",
        ["Python", "React", "Java", "SQL"]
    )

    assert score == 0.5
    assert matched == ["Python", "React"]
    assert missing == ["Java", "SQL"]


def test_no_skills_matched():
    score, matched, missing = calculate_skill_match(
        "HTML CSS",
        ["Python", "Java"]
    )

    assert score == 0.0
    assert matched == []
    assert missing == ["Python", "Java"]


def test_empty_job_skills():
    score, matched, missing = calculate_skill_match(
        "Python React",
        []
    )

    assert score == 0
    assert matched == []
    assert missing == []

def test_skill_extraction_fallback_from_job_description():
    score, matched, missing = calculate_skill_match(
        "Python React developer",
        [],
        "Looking for a developer with Python, React and Docker."
    )

    assert score == pytest.approx(2 / 3)
    assert matched == ["Python", "React"]
    assert missing == ["Docker"]


def test_skill_extraction_fallback_respects_word_boundaries():
    score, matched, missing = calculate_skill_match(
        "JavaScript developer",
        [],
        "Experience with Java and JavaScript required."
    )

    assert score == pytest.approx(0.5)
    assert matched == ["JavaScript"]
    assert missing == ["Java"]


def test_skill_extraction_fallback_with_no_recognized_skills():
    score, matched, missing = calculate_skill_match(
        "Software developer",
        [],
        "Looking for an enthusiastic software developer."
    )

    assert score == 0
    assert matched == []
    assert missing == []


def test_skill_extraction_handles_none_job_description():
    score, matched, missing = calculate_skill_match(
        "Python developer",
        [],
        None
    )

    assert score == 0
    assert matched == []
    assert missing == []
def test_skill_matching_handles_none_resume_text():
    score, matched, missing = calculate_skill_match(
        None,
        ["Python"],
        "Python developer required."
    )

    assert score == 0
    assert matched == []
    assert missing == ["Python"]

def test_skill_matching_is_case_insensitive():
    score, matched, missing = calculate_skill_match(
        "PYTHON and react",
        ["Python", "React"]
    )

    assert score == 1.0
    assert len(matched) == 2
    assert missing == []


# -------------------------------------------------
# Tests for rank_jobs()
# -------------------------------------------------

def test_rank_jobs_returns_empty_for_empty_resume():
    assert rank_jobs("", [{"title": "Developer"}]) == []


def test_rank_jobs_returns_empty_for_no_jobs():
    assert rank_jobs("Python Developer", []) == []


@patch("job_matcher.model")
def test_rank_jobs_calculates_scores(mock_model):
    mock_model.encode.side_effect = [
        np.array([[1.0, 0.0]]),
        np.array([
            [1.0, 0.0],
            [0.0, 1.0]
        ])
    ]

    jobs = [
        {
            "title": "Python Developer",
            "description": "Python backend development",
            "skills": ["Python", "React"]
        },
        {
            "title": "Java Developer",
            "description": "Java application development",
            "skills": ["Java", "Spring Boot"]
        }
    ]

    results = rank_jobs(
        "Python developer with SQL experience",
        jobs
    )

    assert len(results) == 2

    first_job = results[0]

    assert first_job["match_score"] == 82.5
    assert first_job["semantic_similarity"] == 100.0
    assert first_job["skill_match"] == 50.0
    assert first_job["matched_skills"] == ["Python"]
    assert first_job["missing_skills"] == ["React"]


@patch("job_matcher.model")
def test_rank_jobs_sorts_by_match_score(mock_model):
    mock_model.encode.side_effect = [
        np.array([[1.0, 0.0]]),
        np.array([
            [0.0, 1.0],
            [1.0, 0.0]
        ])
    ]

    jobs = [
        {
            "title": "Java Developer",
            "description": "Java development",
            "skills": ["Java"]
        },
        {
            "title": "Python Developer",
            "description": "Python development",
            "skills": ["Python"]
        }
    ]

    results = rank_jobs(
        "Python Developer",
        jobs
    )

    assert results[0]["title"] == "Python Developer"
    assert results[0]["match_score"] >= results[1]["match_score"]


@patch("job_matcher.model")
def test_rank_jobs_respects_result_limit(mock_model):
    mock_model.encode.side_effect = [
        np.array([[1.0, 0.0]]),
        np.array([
            [1.0, 0.0],
            [0.8, 0.2],
            [0.0, 1.0]
        ])
    ]

    jobs = [
        {
            "title": "Job 1",
            "description": "Python",
            "skills": ["Python"]
        },
        {
            "title": "Job 2",
            "description": "React",
            "skills": ["React"]
        },
        {
            "title": "Job 3",
            "description": "Java",
            "skills": ["Java"]
        }
    ]

    results = rank_jobs(
        "Python Developer",
        jobs,
        limit=2
    )

    assert len(results) == 2


@patch("job_matcher.model")
def test_rank_jobs_returns_matched_and_missing_skills(mock_model):
    mock_model.encode.side_effect = [
        np.array([[1.0, 0.0]]),
        np.array([[1.0, 0.0]])
    ]

    jobs = [
        {
            "title": "Full Stack Developer",
            "description": "Web development",
            "skills": ["Python", "React", "Docker"]
        }
    ]

    results = rank_jobs(
        "Python and React developer",
        jobs
    )

    assert results[0]["matched_skills"] == ["Python", "React"]
    assert results[0]["missing_skills"] == ["Docker"]
    assert results[0]["skill_match"] == pytest.approx(66.67)



from unittest.mock import mock_open


def test_load_jobs():
    from job_matcher import load_jobs

    sample_jobs = [
        {
            "title": "Python Developer",
            "skills": ["Python"]
        }
    ]

    with patch(
        "builtins.open",
        mock_open(read_data='[{"title": "Python Developer", "skills": ["Python"]}]')
    ):
        jobs = load_jobs()

    assert jobs == sample_jobs


@patch("job_matcher.rank_jobs")
@patch("job_matcher.load_jobs")
def test_recommend_jobs(mock_load_jobs, mock_rank_jobs):
    from job_matcher import recommend_jobs

    sample_jobs = [{"title": "Python Developer"}]
    sample_results = [{"title": "Python Developer", "match_score": 90}]

    mock_load_jobs.return_value = sample_jobs
    mock_rank_jobs.return_value = sample_results

    results = recommend_jobs("Python Developer", limit=5)

    mock_load_jobs.assert_called_once()
    mock_rank_jobs.assert_called_once_with(
        "Python Developer",
        sample_jobs,
        5
    )
    assert results == sample_results