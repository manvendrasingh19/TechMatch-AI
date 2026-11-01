import json
import re
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


BASE_DIR = Path(__file__).resolve().parent
JOBS_FILE = BASE_DIR / "jobs.json"

# Load the AI model once when the module is imported.
model = SentenceTransformer("all-MiniLM-L6-v2")


def load_jobs():
    with open(JOBS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


TECH_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#",
    "React", "Angular", "Vue.js", "Node.js", "Express",
    "HTML", "CSS", "SQL", "PostgreSQL", "MySQL", "MongoDB",
    "Machine Learning", "Deep Learning", "Artificial Intelligence",
    "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy",
    "Data Science", "Data Analysis", "Power BI", "Tableau",
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes",
    "DevOps", "Linux", "Git", "GitHub", "CI/CD",
    "FastAPI", "Django", "Flask", "REST API",
    "Cybersecurity", "Penetration Testing", "Network Security",
    "Selenium", "Pytest", "Jest",
    "Android", "Kotlin", "Swift", "Flutter",
    "Computer Vision", "Natural Language Processing",
    "Generative AI", "LLM", "LangChain"
]


def calculate_skill_match(resume_text, job_skills, job_description=""):
    resume_lower = (resume_text or "").lower()

    # Use explicitly provided skills when available.
    skills_to_check = list(job_skills or [])

    # If the job source has no structured skills,
    # extract recognized skills from its description.
    if not skills_to_check:
        description_lower = (job_description or "").lower()

        skills_to_check = [
            skill for skill in TECH_SKILLS
            if re.search(
                r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)",
                description_lower
            )
        ]

    matched = []
    missing = []

    for skill in skills_to_check:
        pattern = (
            r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)"
        )

        if re.search(pattern, resume_lower):
            matched.append(skill)
        else:
            missing.append(skill)

    if not skills_to_check:
        return 0, matched, missing

    score = len(matched) / len(skills_to_check)

    return score, matched, missing




def rank_jobs(resume_text, jobs, limit=10):
    if not resume_text.strip() or not jobs:
        return []

    job_descriptions = [
        job.get("title", "") + ". " + job.get("description", "")
        for job in jobs
    ]

    resume_embedding = model.encode(
        [resume_text],
        normalize_embeddings=True
    )

    job_embeddings = model.encode(
        job_descriptions,
        normalize_embeddings=True
    )

    semantic_scores = cosine_similarity(
        resume_embedding,
        job_embeddings
    )[0]

    recommendations = []

    for index, job in enumerate(jobs):
        skill_score, matched, missing = calculate_skill_match(
            resume_text,
            job.get("skills", []),
            job.get("description", "")
        )

        semantic_score = float(semantic_scores[index])
        final_score = 0.65 * semantic_score + 0.35 * skill_score
        final_score = max(0, min(1, final_score))

        recommendations.append({
            **job,
            "match_score": round(final_score * 100, 2),
            "semantic_similarity": round(
                max(0, semantic_score) * 100, 2
            ),
            "skill_match": round(skill_score * 100, 2),
            "matched_skills": matched,
            "missing_skills": missing
        })

    recommendations.sort(
        key=lambda item: item["match_score"],
        reverse=True
    )

    return recommendations[:limit]


def recommend_jobs(resume_text, limit=10):
    jobs = load_jobs()
    return rank_jobs(resume_text, jobs, limit)