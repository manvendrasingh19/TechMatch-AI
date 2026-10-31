
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from job_matcher import recommend_jobs, load_jobs, rank_jobs
from job_sources import fetch_remotive_jobs
from adzuna_source import fetch_adzuna_jobs
from resume_parser import analyze_resume

from saved_jobs import save_job, get_all_saved_jobs, delete_saved_job
from user_profiles import get_profile, update_profile
import re
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import EmailStr, Field
from auth import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    verify_password,
    create_access_token,
    decode_access_token
)

from pydantic import Field

class UserProfileRequest(BaseModel):
    preferred_location: str = Field(default="India", max_length=120)
    preferred_categories: list[str] = Field(default_factory=list)
    preferred_job_type: str = "Any"
    preferred_work_mode: str = "Any"
    resume_filename: str = Field(default="", max_length=255)
    extracted_skills: list[str] = Field(default_factory=list)


app = FastAPI(
    title="TechMatch AI API",
    description="AI-powered multi-source technology job recommendation system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to TechMatch AI!",
        "status": "Backend is running successfully"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "project": "TechMatch AI"
    }

@app.get("/api/jobs/live")
async def get_live_jobs():
    try:
        jobs = await fetch_remotive_jobs()

        return {
            "success": True,
            "source": "Remotive",
            "total_jobs": len(jobs),
            "jobs": jobs
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch live jobs: {str(error)}"
        )


@app.get("/api/jobs/adzuna")
async def get_adzuna_jobs():
    try:
        jobs = await fetch_adzuna_jobs(
            keyword="software developer",
            location="India"
        )

        return {
            "success": True,
            "source": "Adzuna",
            "total_jobs": len(jobs),
            "jobs": jobs
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Adzuna fetch failed: {str(error)}"
        )

    
@app.post("/api/resume/analyze")
async def upload_resume(file: UploadFile = File(...)):

    filename = file.filename or ""

    if not filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX resumes are supported."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Resume size must be less than 5 MB."
        )

    try:
        result = analyze_resume(filename, file_bytes)

        return {
            "success": True,
            "message": "Resume analyzed successfully!",
            "data": result
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to process this resume. Please check the file."
        )



class JobRecommendationRequest(BaseModel):
    resume_text: str
    limit: int = 10


@app.post("/api/jobs/recommend")
def get_job_recommendations(request: JobRecommendationRequest):

    if not request.resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Resume text cannot be empty."
        )

    if not 1 <= request.limit <= 50:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 50."
        )

    try:
        jobs = recommend_jobs(
            request.resume_text,
            request.limit
        )

        return {
            "success": True,
            "total_jobs": len(jobs),
            "recommendations": jobs
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Job recommendation failed: {str(error)}"
        )


@app.post("/api/jobs/recommend-live")
async def get_live_job_recommendations(
    request: JobRecommendationRequest
):
    if not request.resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Resume text cannot be empty."
        )

    if not 1 <= request.limit <= 50:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 50."
        )

    demo_jobs = load_jobs()
    live_jobs = []
    source_warnings = []

    try:
        live_jobs = await fetch_remotive_jobs()
    except Exception as error:
        source_warnings.append(
            f"Remotive could not be reached: {str(error)}"
        )

    # Combine demo and live jobs.
    combined_jobs = demo_jobs + live_jobs

    # Remove duplicates using normalized title and company.
    unique_jobs = []
    seen_jobs = set()

    for job in combined_jobs:
        title = job.get("title", "").strip().lower()
        company = job.get("company", "").strip().lower()
        key = (title, company)

        if title and key not in seen_jobs:
            seen_jobs.add(key)
            unique_jobs.append(job)

    try:
        recommendations = rank_jobs(
            request.resume_text,
            unique_jobs,
            request.limit
        )

        return {
            "success": True,
            "total_jobs_checked": len(unique_jobs),
            "total_recommendations": len(recommendations),
            "sources": ["Demo Dataset", "Remotive"],
            "source_warnings": source_warnings,
            "recommendations": recommendations
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Combined job matching failed: {str(error)}"
        )



class UnifiedJobSearchRequest(BaseModel):
    resume_text: str
    keyword: str = "software"
    location: str = ""
    sources: list[str] = ["Remotive", "Adzuna"]
    limit: int = 10
    include_demo: bool = False

    job_type: str = "Any"
    experience_level: str = "Any"
    work_mode: str = "Any"
    min_salary: float | None = None
    required_skills: list[str] = []




def filter_jobs(jobs, request):
    filtered = []

    for job in jobs:
        title = str(job.get("title", "")).lower()
        description = str(job.get("description", "")).lower()
        location = str(job.get("location", "")).lower()
        job_type = str(job.get("job_type", "")).lower()
        category = str(job.get("category", "")).lower()

        searchable = " ".join([
            title, description, job_type, category
        ])

        # Job type: recognize common variations.
        if request.job_type != "Any":
            type_aliases = {
                "Full-time": [
                    "full-time", "full time", "permanent",
                    "full_time"
                ],
                "Internship": [
                    "internship", "intern", "trainee"
                ],
                "Part-time": [
                    "part-time", "part time", "part_time"
                ],
                "Contract": [
                    "contract", "contractor", "freelance"
                ]
            }

            aliases = type_aliases.get(
                request.job_type, [request.job_type.lower()]
            )

            # Keep listings with unknown job type.
            known_types = [
                word for values in type_aliases.values()
                for word in values
            ]

            has_type_information = any(
                word in searchable for word in known_types
            )

            if has_type_information and not any(
                word in searchable for word in aliases
            ):
                continue

        # Experience: don't reject jobs that omit experience details.
        if request.experience_level != "Any":
            experience_aliases = {
                "Fresher": [
                    "fresher", "fresh graduate", "graduate",
                    "entry level", "entry-level", "0-1 year",
                    "0 to 1 year"
                ],
                "Entry-level": [
                    "entry level", "entry-level", "junior",
                    "graduate", "0-2 years", "1-2 years"
                ],
                "Mid-level": [
                    "mid-level", "mid level", "3-5 years",
                    "3 to 5 years", "intermediate"
                ],
                "Senior": [
                    "senior", "lead", "principal",
                    "5+ years", "5 or more years"
                ]
            }

            aliases = experience_aliases.get(
                request.experience_level, []
            )

            experience_terms = [
                "fresher", "entry level", "entry-level",
                "junior", "mid-level", "mid level",
                "senior", "principal", "lead",
                "years of experience", "years experience"
            ]

            has_experience_information = any(
                term in searchable for term in experience_terms
            )

            if has_experience_information and not any(
                term in searchable for term in aliases
            ):
                continue

        # Work mode: keep listings with unknown work mode.
        if request.work_mode != "Any":
            mode_aliases = {
                "Remote": [
                    "remote", "work from home", "work remotely",
                    "worldwide"
                ],
                "Hybrid": ["hybrid"],
                "Onsite": [
                    "onsite", "on-site", "on site",
                    "office based"
                ]
            }

            aliases = mode_aliases.get(
                request.work_mode, [request.work_mode.lower()]
            )

            all_modes = [
                "remote", "work from home", "work remotely",
                "worldwide", "hybrid", "onsite",
                "on-site", "on site", "office based"
            ]

            has_mode_information = any(
                word in searchable for word in all_modes
            )

            if has_mode_information and not any(
                word in searchable for word in aliases
            ):
                continue

        # Minimum salary: retain jobs when salary is undisclosed.
        if request.min_salary is not None:
            salary_min = job.get("salary_min")

            if salary_min is not None:
                try:
                    if float(salary_min) < request.min_salary:
                        continue
                except (ValueError, TypeError):
                    pass

        # Required skills: all selected skills must be present.
        job_skills = [
            str(skill).lower()
            for skill in job.get("skills", [])
        ]

        if request.required_skills:
            missing_required = False

            for skill in request.required_skills:
                skill_lower = skill.lower()

                if (
                    skill_lower not in searchable
                    and not any(
                        skill_lower in item for item in job_skills
                    )
                ):
                    missing_required = True
                    break

            if missing_required:
                continue

        filtered.append(job)

    return filtered



def calculate_preference_match(job, profile):
    """Calculate how closely a job matches the user's saved preferences."""

    scores = []
    reasons = []

    preferred_categories = profile.get("preferred_categories") or []
    preferred_location = str(
        profile.get("preferred_location") or ""
    ).strip().lower()
    preferred_job_type = str(
        profile.get("preferred_job_type") or "Any"
    ).strip()
    preferred_work_mode = str(
        profile.get("preferred_work_mode") or "Any"
    ).strip()

    title = str(job.get("title") or "").lower()
    description = str(job.get("description") or "").lower()
    category = str(job.get("category") or "").lower()
    location = str(job.get("location") or "").lower()
    job_type = str(job.get("job_type") or "").lower()

    searchable = " ".join([title, description, category, job_type])

    # 1. Preferred technology categories
    if preferred_categories:
        category_match = any(
            str(item).lower() in searchable
            for item in preferred_categories
            if str(item).strip()
        )
        scores.append(100 if category_match else 0)

        if category_match:
            reasons.append("Matches preferred technology category")

    # 2. Preferred location
    if preferred_location:
        is_remote = any(
            term in (location + " " + description)
            for term in ["remote", "worldwide", "work from home"]
        )

        location_match = (
            preferred_location in location
            or location in preferred_location
            or is_remote
        )

        scores.append(100 if location_match else 0)

        if location_match:
            reasons.append("Matches preferred location or remote preference")

    # 3. Preferred job type
    if preferred_job_type.lower() != "any":
        aliases = {
            "full-time": ["full-time", "full time", "permanent"],
            "internship": ["internship", "intern", "trainee"],
            "part-time": ["part-time", "part time"],
            "contract": ["contract", "freelance", "contractor"]
        }

        terms = aliases.get(
            preferred_job_type.lower(),
            [preferred_job_type.lower()]
        )

        type_match = any(term in searchable for term in terms)

        scores.append(100 if type_match else 0)

        if type_match:
            reasons.append("Matches preferred job type")

    # 4. Preferred work mode
    if preferred_work_mode.lower() != "any":
        mode_aliases = {
            "remote": ["remote", "work from home", "worldwide"],
            "hybrid": ["hybrid"],
            "onsite": ["onsite", "on-site", "on site", "office based"]
        }

        terms = mode_aliases.get(
            preferred_work_mode.lower(),
            [preferred_work_mode.lower()]
        )

        mode_match = any(
            term in (location + " " + description)
            for term in terms
        )

        scores.append(100 if mode_match else 0)

        if mode_match:
            reasons.append("Matches preferred work mode")

    # No preferences configured: do not penalize the job.
    preference_score = (
        sum(scores) / len(scores) if scores else 100
    )

    return round(preference_score, 2), reasons

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        user_id = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token."
        )

    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account not found."
        )

    return user

@app.post("/api/jobs/search")
async def unified_job_search(
    request: UnifiedJobSearchRequest,
    current_user: dict = Depends(get_current_user)):
    if not request.resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Resume text cannot be empty."
        )

    if not 1 <= request.limit <= 50:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 50."
        )

    allowed_sources = {"Remotive", "Adzuna"}

    if not request.sources:
        raise HTTPException(
            status_code=400,
            detail="Select at least one job source."
        )

    if not set(request.sources).issubset(allowed_sources):
        raise HTTPException(
            status_code=400,
            detail="Unsupported job source selected."
        )

    collected_jobs = []
    source_warnings = []

    if request.include_demo:
        collected_jobs.extend(load_jobs())

    if "Remotive" in request.sources:
        try:
            jobs = await fetch_remotive_jobs(
                keyword=request.keyword,
                location=request.location or None
            )
            collected_jobs.extend(jobs)
        except Exception as error:
            source_warnings.append(
                f"Remotive: {str(error)}"
            )

    if "Adzuna" in request.sources:
        try:
            jobs = await fetch_adzuna_jobs(
                keyword=request.keyword,
                location=request.location or None,
                results_per_page=20
            )
            collected_jobs.extend(jobs)
        except Exception as error:
            source_warnings.append(
                f"Adzuna: {str(error)}"
            )

    # Remove duplicates.
    unique_jobs = []
    seen = set()

    for job in collected_jobs:
        key = (
            job.get("title", "").strip().lower(),
            job.get("company", "").strip().lower()
        )

        if key[0] and key not in seen:
            seen.add(key)
            unique_jobs.append(job)

    try:
        filtered_jobs = filter_jobs(unique_jobs, request)
        recommendations = rank_jobs(
            request.resume_text,
            filtered_jobs,
            len(filtered_jobs)
        )

        # Load this user's saved preferences.
        user_id = current_user["id"]
        profile = get_profile(user_id)

        # Add a separate personalization score.
        for job in recommendations:
            preference_score, reasons = calculate_preference_match(
                job,
                profile
            )

            resume_score = job["match_score"]

            if profile:
                combined_score = (
                    0.80 * resume_score
                    + 0.20 * preference_score
                )
            else:
                combined_score = resume_score

            job["resume_match_score"] = round(resume_score, 2)
            job["preference_match_score"] = preference_score
            job["personalization_reasons"] = reasons
            job["match_score"] = round(combined_score, 2)

        recommendations.sort(
            key=lambda item: item["match_score"],
            reverse=True
        )

        recommendations = recommendations[:request.limit]

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"AI ranking failed: {str(error)}"
        )

    return {
        "success": True,
        "keyword": request.keyword,
        "location": request.location,
        "total_jobs_collected": len(unique_jobs),
        "total_jobs_after_filters": len(filtered_jobs),
        "total_recommendations": len(recommendations),
        "sources_requested": request.sources,
        "source_warnings": source_warnings,
        "recommendations": recommendations
    }



class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)



class SaveJobRequest(BaseModel):
    job: dict


@app.post("/api/jobs/saved")
def create_saved_job(
    request: SaveJobRequest,
    user=Depends(get_current_user)
):
    try:
        saved = save_job(request.job, user["id"])

        return {
            "success": True,
            "message": "Job saved successfully.",
            "saved_job": saved
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/api/jobs/saved")
def list_saved_jobs(user=Depends(get_current_user)):
    jobs = get_all_saved_jobs(user["id"])

    return {
        "success": True,
        "total_saved": len(jobs),
        "saved_jobs": jobs
    }


@app.delete("/api/jobs/saved/{job_id}")
def remove_saved_job(
    job_id: str,
    user=Depends(get_current_user)
):
    deleted = delete_saved_job(job_id, user["id"])

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Saved job was not found."
        )

    return {
        "success": True,
        "message": "Saved job removed successfully."
    }


@app.post("/api/auth/register")
def register(request: RegisterRequest):
    try:
        user = create_user(
            request.name,
            str(request.email),
            request.password
        )

        return {
            "success": True,
            "message": "Account created successfully.",
            "user": user
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        if "UNIQUE constraint failed" in str(error):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists."
            )
        raise HTTPException(status_code=500, detail="Registration failed.")
    
@app.post("/api/auth/login")
def login(request: LoginRequest):
    user = get_user_by_email(str(request.email))

    if not user or not verify_password(
        request.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password."
        )

    token = create_access_token(user["id"])

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }

@app.get("/api/auth/me")
def get_my_profile(user=Depends(get_current_user)):
    return {
        "success": True,
        "user": user
    }




@app.get("/api/profile")
def read_user_profile(user=Depends(get_current_user)):
    return {
        "success": True,
        "profile": get_profile(user["id"])
    }


@app.put("/api/profile")
def save_user_profile(
    request: UserProfileRequest,
    user=Depends(get_current_user)
):
    allowed_job_types = [
        "Any", "Full-time", "Internship", "Part-time", "Contract"
    ]

    allowed_work_modes = [
        "Any", "Remote", "Hybrid", "Onsite"
    ]

    if request.preferred_job_type not in allowed_job_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid preferred job type."
        )

    if request.preferred_work_mode not in allowed_work_modes:
        raise HTTPException(
            status_code=400,
            detail="Invalid preferred work mode."
        )

    if len(request.preferred_categories) > 20:
        raise HTTPException(
            status_code=400,
            detail="Select no more than 20 categories."
        )

    if len(request.extracted_skills) > 100:
        raise HTTPException(
            status_code=400,
            detail="Too many extracted skills."
        )

    profile = update_profile(
        user["id"],
        request.model_dump()
    )

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "profile": profile
    }
