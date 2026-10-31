
import re
import html
import httpx


REMOTIVE_URL = "https://remotive.com/api/remote-jobs"

TECH_KEYWORDS = [
    "software", "developer", "engineering", "programming",
    "data", "machine learning", "artificial intelligence",
    "cybersecurity", "devops", "cloud", "web development",
    "frontend", "backend", "python", "javascript",
    "mobile", "quality assurance", "qa", "database"
]


def clean_description(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def is_tech_job(job):
    searchable = " ".join([
        job.get("title", ""),
        job.get("category", ""),
        job.get("description", ""),
        " ".join(job.get("tags", []))
    ]).lower()

    return any(keyword in searchable for keyword in TECH_KEYWORDS)



async def fetch_remotive_jobs(keyword=None, location=None):
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            REMOTIVE_URL,
            params={"category": "software-dev"}
        )
        response.raise_for_status()
        data = response.json()

    results = []

    for job in data.get("jobs", []):
        if not is_tech_job(job):
            continue

        normalized = {
            "id": f"remotive-{job.get('id')}",
            "title": job.get("title", "Untitled"),
            "company": job.get("company_name", "Not specified"),
            "description": clean_description(
                job.get("description", "")
            ),
            "location": job.get(
                "candidate_required_location", "Not specified"
            ),
            "category": job.get("category", "Software Development"),
            "job_type": job.get("job_type", "Not specified"),
            "salary": job.get("salary", "Not specified"),
            "skills": job.get("tags", []),
            "source": "Remotive",
            "apply_url": job.get("url", ""),
            "publication_date": job.get("publication_date", "")
        }

        searchable = (
            normalized["title"] + " " +
            normalized["description"] + " " +
            normalized["company"]
        ).lower()

        if keyword and keyword.lower() not in searchable:
            continue

        # Remotive listings can be worldwide or remote.
        # Keep worldwide listings when a location is requested.
        job_location = normalized["location"].lower()
        if location:
            requested_location = location.lower()
            if (
                requested_location not in job_location
                and "worldwide" not in job_location
                and "anywhere" not in job_location
            ):
                continue

        results.append(normalized)

    return results

