
import os
import re
import html
import httpx

from dotenv import load_dotenv

load_dotenv()

APP_ID = os.getenv("ADZUNA_APP_ID")
APP_KEY = os.getenv("ADZUNA_APP_KEY")
COUNTRY = os.getenv("ADZUNA_COUNTRY", "in")

BASE_URL = "https://api.adzuna.com/v1/api"


def clean_text(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


async def fetch_adzuna_jobs(
    keyword="software developer",
    location=None,
    results_per_page=20
):
    if not APP_ID or not APP_KEY:
        raise RuntimeError("Adzuna API credentials are not configured.")

    params = {
        "app_id": APP_ID,
        "app_key": APP_KEY,
        "results_per_page": results_per_page,
        "what": keyword,
        "content-type": "application/json"
    }

    if location:
        params["where"] = location

    url = f"{BASE_URL}/jobs/{COUNTRY}/search/1"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    jobs = []

    for item in data.get("results", []):
        company = item.get("company") or {}
        job_location = item.get("location") or {}
        category = item.get("category") or {}

        jobs.append({
            "id": f"adzuna-{item.get('id')}",
            "title": item.get("title", "Untitled"),
            "company": company.get(
                "display_name", "Not specified"
            ),
            "description": clean_text(
                item.get("description", "")
            ),
            "location": job_location.get(
                "display_name", "Not specified"
            ),
            "category": category.get(
                "label", "Technology"
            ),
            "job_type": item.get(
                "contract_type", "Not specified"
            ),
            "salary": (
                f"{item.get('salary_min', '')} - "
                f"{item.get('salary_max', '')}"
            ).strip(" -"),
            "salary_min": item.get("salary_min"),
            "salary_max": item.get("salary_max"),
            "skills": [],
            "source": "Adzuna",
            "apply_url": item.get("redirect_url", ""),
            "publication_date": item.get("created", "")
        })

    return jobs
