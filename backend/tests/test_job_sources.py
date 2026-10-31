
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock

import job_sources


# --------------------------------------------------
# Description cleaning tests
# --------------------------------------------------

def test_clean_description():
    result = job_sources.clean_description(
        "<p>Python &amp; FastAPI</p>   Developer"
    )

    assert result == "Python & FastAPI Developer"


def test_clean_description_empty():
    assert job_sources.clean_description("") == ""


# --------------------------------------------------
# Technology job filtering tests
# --------------------------------------------------

def test_is_tech_job_from_title():
    assert job_sources.is_tech_job({
        "title": "Python Developer"
    }) is True


def test_is_tech_job_from_category():
    assert job_sources.is_tech_job({
        "category": "Software Development"
    }) is True


def test_is_tech_job_from_tags():
    assert job_sources.is_tech_job({
        "tags": ["Machine Learning"]
    }) is True


def test_is_not_tech_job():
    assert job_sources.is_tech_job({
        "title": "Sales Manager",
        "category": "Marketing",
        "description": "Manage customer relationships",
        "tags": []
    }) is False


# --------------------------------------------------
# Remotive API tests
# --------------------------------------------------

@pytest.mark.asyncio
async def test_fetch_remotive_jobs_success(monkeypatch):
    mock_jobs = [
        {
            "id": 123,
            "title": "Python Developer",
            "company_name": "Example Company",
            "description": "<p>Build Python applications</p>",
            "candidate_required_location": "Worldwide",
            "category": "Software Development",
            "job_type": "full_time",
            "salary": "$50,000",
            "tags": ["Python", "FastAPI"],
            "url": "https://example.com/apply",
            "publication_date": "2026-10-31"
        },
        {
            "id": 456,
            "title": "Sales Manager",
            "category": "Marketing",
            "description": "Manage sales",
            "tags": []
        }
    ]

    mock_response = MagicMock()
    mock_response.json.return_value = {"jobs": mock_jobs}
    mock_response.raise_for_status.return_value = None

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        job_sources.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    results = await job_sources.fetch_remotive_jobs()

    assert len(results) == 1
    assert results[0]["id"] == "remotive-123"
    assert results[0]["company"] == "Example Company"
    assert results[0]["description"] == "Build Python applications"
    assert results[0]["source"] == "Remotive"
    assert results[0]["skills"] == ["Python", "FastAPI"]


@pytest.mark.asyncio
async def test_remotive_keyword_filter(monkeypatch):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "jobs": [
            {
                "id": 1,
                "title": "Python Developer",
                "description": "Build applications"
            },
            {
                "id": 2,
                "title": "Java Developer",
                "description": "Build Java applications"
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        job_sources.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    results = await job_sources.fetch_remotive_jobs(
        keyword="Python"
    )

    assert len(results) == 1
    assert results[0]["title"] == "Python Developer"


@pytest.mark.asyncio
async def test_remotive_location_filter(monkeypatch):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "jobs": [
            {
                "id": 1,
                "title": "Python Developer",
                "candidate_required_location": "India"
            },
            {
                "id": 2,
                "title": "Backend Developer",
                "candidate_required_location": "USA"
            },
            {
                "id": 3,
                "title": "Remote Developer",
                "candidate_required_location": "Worldwide"
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        job_sources.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    results = await job_sources.fetch_remotive_jobs(
        location="India"
    )

    assert len(results) == 2
    assert results[0]["location"] == "India"
    assert results[1]["location"] == "Worldwide"


@pytest.mark.asyncio
async def test_remotive_api_error(monkeypatch):
    mock_client = MagicMock()
    mock_client.get = AsyncMock(
        side_effect=httpx.ConnectError("Connection failed")
    )

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        job_sources.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    with pytest.raises(httpx.ConnectError):
        await job_sources.fetch_remotive_jobs()


# --------------------------------------------------
# Adzuna API tests
# --------------------------------------------------

import adzuna_source


def test_adzuna_clean_text():
    result = adzuna_source.clean_text(
        "<p>Python &amp; FastAPI</p>   Developer"
    )

    assert result == "Python & FastAPI Developer"


def test_adzuna_clean_text_empty():
    assert adzuna_source.clean_text("") == ""


@pytest.mark.asyncio
async def test_adzuna_missing_credentials(monkeypatch):
    monkeypatch.setattr(adzuna_source, "APP_ID", None)
    monkeypatch.setattr(adzuna_source, "APP_KEY", None)

    with pytest.raises(
        RuntimeError,
        match="Adzuna API credentials are not configured"
    ):
        await adzuna_source.fetch_adzuna_jobs()


@pytest.mark.asyncio
async def test_adzuna_fetch_success(monkeypatch):
    monkeypatch.setattr(adzuna_source, "APP_ID", "test-id")
    monkeypatch.setattr(adzuna_source, "APP_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "results": [
            {
                "id": "789",
                "title": "Backend Developer",
                "company": {"display_name": "Example Company"},
                "description": "<p>Python development</p>",
                "location": {"display_name": "India"},
                "category": {"label": "IT Jobs"},
                "contract_type": "permanent",
                "salary_min": 500000,
                "salary_max": 800000,
                "redirect_url": "https://example.com/apply",
                "created": "2026-10-31"
            }
        ]
    }
    mock_response.raise_for_status.return_value = None

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        adzuna_source.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    results = await adzuna_source.fetch_adzuna_jobs(
        keyword="Python Developer",
        location="India"
    )

    assert len(results) == 1
    assert results[0]["id"] == "adzuna-789"
    assert results[0]["title"] == "Backend Developer"
    assert results[0]["company"] == "Example Company"
    assert results[0]["description"] == "Python development"
    assert results[0]["salary_min"] == 500000
    assert results[0]["salary_max"] == 800000
    assert results[0]["source"] == "Adzuna"


@pytest.mark.asyncio
async def test_adzuna_empty_results(monkeypatch):
    monkeypatch.setattr(adzuna_source, "APP_ID", "test-id")
    monkeypatch.setattr(adzuna_source, "APP_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.json.return_value = {"results": []}

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        adzuna_source.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    results = await adzuna_source.fetch_adzuna_jobs()

    assert results == []


@pytest.mark.asyncio
async def test_adzuna_api_error(monkeypatch):
    monkeypatch.setattr(adzuna_source, "APP_ID", "test-id")
    monkeypatch.setattr(adzuna_source, "APP_KEY", "test-key")

    mock_client = MagicMock()
    mock_client.get = AsyncMock(
        side_effect=httpx.ConnectError("Connection failed")
    )

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return mock_client

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(
        adzuna_source.httpx,
        "AsyncClient",
        MockAsyncClient
    )

    with pytest.raises(httpx.ConnectError):
        await adzuna_source.fetch_adzuna_jobs()
