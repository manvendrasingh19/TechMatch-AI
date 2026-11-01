
import re


SECTION_PATTERNS = {
    "Professional Summary": [
        r"\bprofessional summary\b",
        r"\bcareer objective\b",
        r"\bprofile\b",
        r"\bsummary\b",
        r"\bobjective\b",
    ],
    "Technical Skills": [
        r"\btechnical skills\b",
        r"\bskills\b",
        r"\btechnologies\b",
        r"\btechnical expertise\b",
    ],
    "Education": [
        r"\beducation\b",
        r"\bacademic background\b",
        r"\bqualification\b",
    ],
    "Projects": [
        r"\bprojects\b",
        r"\bacademic projects\b",
        r"\bpersonal projects\b",
    ],
    "Experience": [
        r"\bexperience\b",
        r"\bwork history\b",
        r"\bemployment history\b",
        r"\binternship\b",
    ],
    "Certifications": [
        r"\bcertifications?\b",
        r"\blicenses?\b",
        r"\bcertificates?\b",
    ],
}


ACTION_VERBS = [
    "developed", "built", "designed", "implemented",
    "created", "managed", "analyzed", "automated",
    "improved", "deployed", "tested", "led",
    "optimized", "integrated", "maintained",
]


def _is_section_heading(line: str, patterns: list[str]) -> bool:
    """Return True only when a complete line matches a section heading."""
    heading = line.strip()

    # Support common heading prefixes such as "1. Education" or "• Projects".
    heading = re.sub(
        r"^(?:\d+[.)]\s*|[•▪●*-]\s*)",
        "",
        heading
    )

    # Remove common trailing heading punctuation.
    heading = re.sub(r"[\s:|—–-]+$", "", heading).strip()

    return any(
        re.fullmatch(pattern, heading, flags=re.IGNORECASE)
        for pattern in patterns
    )



def _count_measurable_numbers(text: str) -> int:
    """Count numerical evidence while excluding common personal details."""

    cleaned = text

    # Exclude explicitly labelled phone/contact numbers.
    cleaned = re.sub(
        r"(?i)\b(?:phone|mobile|contact|telephone|tel|whatsapp)"
        r"\s*(?:number|no\.?)?\s*[:\-]?\s*\+?[\d\s().-]{7,}\d",
        " ",
        cleaned
    )

    # Exclude international phone numbers beginning with a country code.
    cleaned = re.sub(
        r"\+\d{1,3}[\s.-]?(?:\(?\d{2,5}\)?[\s.-]?){1,3}\d{4,}",
        " ",
        cleaned
    )

    # Exclude common numeric date formats: DD/MM/YYYY and YYYY-MM-DD.
    cleaned = re.sub(
        r"\b(?:0?[1-9]|[12]\d|3[01])[/.-]"
        r"(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b",
        " ",
        cleaned
    )

    cleaned = re.sub(
        r"\b(?:19|20)\d{2}[/.-]"
        r"(?:0?[1-9]|1[0-2])[/.-]"
        r"(?:0?[1-9]|[12]\d|3[01])\b",
        " ",
        cleaned
    )

    # Exclude years explicitly identified as graduation or birth dates.
    cleaned = re.sub(
        r"(?i)\b(?:graduation year|year of graduation|"
        r"year of passing|passing year|graduated in|"
        r"class of|date of birth|dob)\s*[:\-]?\s*(?:19|20)\d{2}\b",
        " ",
        cleaned
    )

    return len(re.findall(r"\b\d+(?:\.\d+)?%?\b", cleaned))

def review_resume(resume_text: str, target_skills=None):
    text = resume_text or ""
    cleaned_text = re.sub(r"\s+", " ", text).strip()
    lower_text = cleaned_text.lower()

    if not cleaned_text:
        return {
            "word_count": 0,
            "sections_found": [],
            "missing_sections": list(SECTION_PATTERNS.keys()),
            "suggestions": [
                "Upload a readable PDF or DOCX resume containing selectable text."
            ],
            "keyword_suggestions": [],
            "review_note": "No resume text was provided.",
            "quality_score": 0,
            "category_scores": {},
            "priority_recommendations": []
        }

    word_count = len(cleaned_text.split())

    
    sections_found = []
    missing_sections = []

    resume_lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    for section, patterns in SECTION_PATTERNS.items():
        found = any(
            _is_section_heading(line, patterns)
            for line in resume_lines
        )

        if found:
            sections_found.append(section)
        else:
            missing_sections.append(section)


    suggestions = []
    priority_recommendations = []

    # 1. Section completeness: 30 points
    section_score = round(
        (len(sections_found) / len(SECTION_PATTERNS)) * 30
    )

    section_tips = {
        "Professional Summary": (
            "Consider adding a concise professional summary."
        ),
        "Technical Skills": (
            "Add a clearly labelled technical skills section."
        ),
        "Education": (
            "Include your relevant education details."
        ),
        "Projects": (
            "Add relevant academic or personal projects."
        ),
        "Experience": (
            "Include relevant practical experience, if available. "
            "Students without work experience can emphasize projects."
        ),
        "Certifications": (
            "List relevant certifications you have actually earned."
        )
    }

    for section in missing_sections:
        priority_recommendations.append({
            "category": "Section completeness",
            "priority": (
                "Important" if section in [
                    "Technical Skills", "Projects", "Education"
                ] else "Optional"
            ),
            "recommendation": section_tips[section]
        })

    # 2. Resume length: 15 points
    if 250 <= word_count <= 900:
        length_score = 15
    elif 150 <= word_count < 250 or 901 <= word_count <= 1100:
        length_score = 10
    else:
        length_score = 5

    if word_count < 250:
        priority_recommendations.append({
            "category": "Resume length",
            "priority": "Important",
            "recommendation": (
                "Your resume is relatively short. Consider adding "
                "relevant project details, skills, and education."
            )
        })
    elif word_count > 1100:
        priority_recommendations.append({
            "category": "Resume length",
            "priority": "Important",
            "recommendation": (
                "Consider shortening repetitive or unrelated content."
            )
        })

    # 3. Action-oriented descriptions: 20 points
    action_verb_count = sum(
        len(re.findall(r"\b" + re.escape(verb) + r"\b", lower_text))
        for verb in ACTION_VERBS
    )

    if action_verb_count >= 5:
        action_score = 20
    elif action_verb_count >= 2:
        action_score = 14
    else:
        action_score = 6
        priority_recommendations.append({
            "category": "Writing clarity",
            "priority": "Important",
            "recommendation": (
                "Use accurate action verbs in project and experience "
                "descriptions, such as Developed, Built, Tested, or "
                "Implemented."
            )
        })

    # 4. Measurable evidence: 15 points
    number_count = _count_measurable_numbers(cleaned_text)

    if number_count >= 4:
        measurable_score = 15
    elif number_count >= 1:
        measurable_score = 10
    else:
        measurable_score = 5
        priority_recommendations.append({
            "category": "Measurable achievements",
            "priority": "Optional",
            "recommendation": (
                "Where accurate, include measurable project results, "
                "such as dataset size, response time, or test coverage."
            )
        })

    # 5. Job-related keywords: 20 points
    keyword_suggestions = []
    target_skills = target_skills or []

    unique_target_skills = []
    seen_skills = set()

    for skill in target_skills:
        if skill is None:
            continue

        normalized_skill = str(skill).strip()

        if not normalized_skill:
            continue

        skill_key = normalized_skill.casefold()

        if skill_key not in seen_skills:
            seen_skills.add(skill_key)
            unique_target_skills.append(normalized_skill)


    matched_target_skills = [
        skill for skill in unique_target_skills
        if re.search(
            r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)",
            lower_text
        )
    ]

    keyword_suggestions = [
        skill for skill in unique_target_skills
        if skill not in matched_target_skills
    ]

    if not unique_target_skills:
        keyword_score = 10
    else:
        keyword_score = round(
            (len(matched_target_skills) / len(unique_target_skills)) * 20
        )

    if keyword_suggestions:
        priority_recommendations.append({
            "category": "Job relevance",
            "priority": "Important",
            "recommendation": (
                "Review job-related keywords and include only those "
                "that accurately reflect your skills."
            )
        })

    category_scores = {
        "Section completeness": {
            "score": section_score,
            "maximum": 30
        },
        "Resume length": {
            "score": length_score,
            "maximum": 15
        },
        "Writing clarity": {
            "score": action_score,
            "maximum": 20
        },
        "Measurable achievements": {
            "score": measurable_score,
            "maximum": 15
        },
        "Job relevance": {
            "score": keyword_score,
            "maximum": 20
        }
    }

    quality_score = sum(
        item["score"] for item in category_scores.values()
    )

    # Keep the existing suggestion list useful.
    for item in priority_recommendations:
        if item["recommendation"] not in suggestions:
            suggestions.append(item["recommendation"])

    if not suggestions:
        suggestions.append(
            "The basic checks did not identify major issues. "
            "Review your resume for accuracy and relevance."
        )

    return {
        "word_count": word_count,
        "sections_found": sections_found,
        "missing_sections": missing_sections,
        "suggestions": suggestions,
        "keyword_suggestions": keyword_suggestions[:15],
        "quality_score": quality_score,
        "category_scores": category_scores,
        "priority_recommendations": priority_recommendations,
        "review_note": (
            "This is a rule-based resume quality estimate, not an "
            "official ATS score or a guarantee of interview selection."
        )
    }

