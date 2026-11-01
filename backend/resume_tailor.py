
import re


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
    "Selenium", "Pytest", "Jest", "Android", "Kotlin",
    "Swift", "Flutter", "Computer Vision",
    "Natural Language Processing", "Generative AI",
    "LLM", "LangChain"
]


def contains_term(text, term):
    pattern = (
        r"(?<!\w)" + re.escape(term.lower()) + r"(?!\w)"
    )
    return bool(re.search(pattern, text.lower()))


def extract_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [
        part.strip()
        for part in parts
        if len(part.strip().split()) >= 4
    ]


def tailor_resume(resume_text, job_title, job_description, job_skills=None):
    resume_text = (resume_text or "").strip()
    job_title = (job_title or "").strip() or "Selected job"
    job_description = (job_description or "").strip()
    job_skills = job_skills or []

    if not resume_text:
        raise ValueError("Resume text cannot be empty.")

    if not job_description and not job_skills:
        raise ValueError(
            "The selected job must include a description or skills."
        )

    # Combine explicitly supplied job skills with recognized
    # technical skills mentioned in the job description.
    required_skills = []

    for skill in job_skills:
        skill = str(skill).strip()
        if skill and skill.lower() not in [
            item.lower() for item in required_skills
        ]:
            required_skills.append(skill)

    for skill in TECH_SKILLS:
        if (
            contains_term(job_description, skill)
            and skill.lower() not in [
                item.lower() for item in required_skills
            ]
        ):
            required_skills.append(skill)

    resume_lower = resume_text.lower()

    matched_skills = [
        skill for skill in required_skills
        if contains_term(resume_lower, skill)
    ]

    missing_skills = [
        skill for skill in required_skills
        if not contains_term(resume_lower, skill)
    ]

    if required_skills:
        match_percentage = round(
            len(matched_skills) / len(required_skills) * 100
        )
    else:
        match_percentage = 0

    # Find resume sentences that mention matched skills.
    resume_sentences = extract_sentences(resume_text)
    relevant_evidence = []

    for sentence in resume_sentences:
        sentence_skills = [
            skill for skill in matched_skills
            if contains_term(sentence, skill)
        ]

        if sentence_skills:
            relevant_evidence.append({
                "text": sentence,
                "skills": sentence_skills
            })

    suggestions = []

    if missing_skills:
        suggestions.append(
            "Review the missing job skills below. Add a skill only "
            "if you genuinely have that knowledge or experience."
        )

    if not relevant_evidence:
        suggestions.append(
            "Make relevant project or experience details easier to "
            "identify. Use examples already present in your resume."
        )
    else:
        suggestions.append(
            "Consider bringing the relevant project or experience "
            "examples below closer to the top of your resume."
        )

    if not contains_term(resume_text, job_title):
        suggestions.append(
            f"If this accurately reflects your career goal, consider "
            f"mentioning your interest in the {job_title} role in "
            f"your professional summary."
        )

    suggestions.append(
        "Adapt the wording of your existing experience to the job "
        "description, but keep every statement accurate."
    )

    return {
        "job_title": job_title,
        "required_skills": required_skills,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "skill_match_percentage": match_percentage,
        "relevant_resume_evidence": relevant_evidence[:8],
        "suggestions": suggestions,
        "review_note": (
            "This is a rule-based comparison of the supplied resume "
            "and job listing. Missing skills are not proof that you "
            "lack them; they may simply be absent from your resume. "
            "Only include claims that are true."
        )
    }
