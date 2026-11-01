import pytest

from resume_advisor import review_resume, SECTION_PATTERNS



def make_resume(word_count=300, extra_text=""):
    """Create a realistically formatted resume with all six sections."""

    headings = "\n".join([
        "Professional Summary",
        "Technical Skills",
        "Education",
        "Projects",
        "Experience",
        "Certifications",
    ])

    content = (
        "Developed built designed implemented created "
        "managed analyzed automated improved deployed "
        "tested led optimized integrated maintained "
        "Python Java SQL React "
        "10 20 30 40 "
        + extra_text
    )

    content_words = content.split()
    heading_words = headings.split()

    remaining_words = word_count - len(heading_words) - len(content_words)

    if remaining_words > 0:
        content_words.extend(
            f"resumecontent{i}"
            for i in range(remaining_words)
        )

    return headings + "\n" + " ".join(content_words)



def test_empty_resume_returns_expected_response():
    result = review_resume("")

    assert result["word_count"] == 0
    assert result["sections_found"] == []
    assert result["missing_sections"] == list(SECTION_PATTERNS.keys())
    assert result["quality_score"] == 0
    assert result["category_scores"] == {}
    assert result["keyword_suggestions"] == []
    assert result["priority_recommendations"] == []
    assert result["review_note"] == "No resume text was provided."
    assert len(result["suggestions"]) == 1


@pytest.mark.parametrize("resume_text", [None, "", "   ", "\n\t  "])
def test_empty_or_whitespace_resume(resume_text):
    result = review_resume(resume_text)

    assert result["word_count"] == 0
    assert result["quality_score"] == 0


def test_all_resume_sections_are_detected():
    result = review_resume(make_resume())

    assert result["sections_found"] == list(SECTION_PATTERNS.keys())
    assert result["missing_sections"] == []


def test_section_aliases_are_detected():
    resume = """
    Career Objective
    Technologies
    Academic Background
    Personal Projects
    Work History
    Licenses
    """

    result = review_resume(resume)

    assert result["sections_found"] == list(SECTION_PATTERNS.keys())
    assert result["missing_sections"] == []


def test_section_names_mentioned_in_sentences_are_not_detected():
    resume = """
    I have a career objective to become a software engineer.
    My technical skills include Python and Java.
    I completed several academic projects.
    I have experience working with databases.
    I am interested in pursuing further education.
    """

    result = review_resume(resume)

    assert result["sections_found"] == []
    assert result["missing_sections"] == list(SECTION_PATTERNS.keys())


@pytest.mark.parametrize(
    "heading",
    [
        "Education",
        "EDUCATION",
        "Education:",
        "1. Education",
        "• Education",
        "▪ Education",
    ],
)
def test_section_headings_support_common_formatting(heading):
    result = review_resume(heading)

    assert "Education" in result["sections_found"]
    assert "Education" not in result["missing_sections"]


def test_missing_sections_generate_recommendations():
    result = review_resume("Python developer with some experience.")

    assert "Professional Summary" in result["missing_sections"]
    assert "Technical Skills" in result["missing_sections"]
    assert "Education" in result["missing_sections"]
    assert "Projects" in result["missing_sections"]
    assert "Certifications" in result["missing_sections"]

    section_recommendations = [
        item for item in result["priority_recommendations"]
        if item["category"] == "Section completeness"
    ]

    assert len(section_recommendations) == 6
    assert len(section_recommendations) == len(SECTION_PATTERNS)
    assert all(
        item["recommendation"] in result["suggestions"]
        for item in section_recommendations
    )


def test_section_priority_classification():
    result = review_resume("Professional Summary")

    section_recommendations = [
        item for item in result["priority_recommendations"]
        if item["category"] == "Section completeness"
    ]

    important_sections = [
        item for item in section_recommendations
        if item["priority"] == "Important"
    ]

    optional_sections = [
        item for item in section_recommendations
        if item["priority"] == "Optional"
    ]

    assert len(important_sections) == 3
    assert len(optional_sections) == 2


@pytest.mark.parametrize(
    ("word_count", "expected_score"),
    [
        (100, 5),
        (149, 5),
        (150, 10),
        (249, 10),
        (250, 15),
        (900, 15),
        (901, 10),
        (1100, 10),
        (1101, 5),
    ],
)
def test_resume_length_scoring(word_count, expected_score):
    result = review_resume(make_resume(word_count))

    assert result["word_count"] == word_count
    assert result["category_scores"]["Resume length"]["score"] == expected_score


def test_short_resume_generates_length_recommendation():
    result = review_resume("Python developer")

    recommendations = result["priority_recommendations"]

    assert any(
        item["category"] == "Resume length"
        and "relatively short" in item["recommendation"]
        for item in recommendations
    )


def test_long_resume_generates_length_recommendation():
    result = review_resume(make_resume(1101))

    recommendations = result["priority_recommendations"]

    assert any(
        item["category"] == "Resume length"
        and "shortening" in item["recommendation"]
        for item in recommendations
    )


def test_action_verb_scoring_with_five_or_more_verbs():
    result = review_resume(make_resume())

    assert result["category_scores"]["Writing clarity"]["score"] == 20


def test_action_verb_scoring_with_two_verbs():
    result = review_resume(
        "Professional Summary developed and built software"
    )

    assert result["category_scores"]["Writing clarity"]["score"] == 14


def test_action_verb_scoring_with_fewer_than_two_verbs():
    result = review_resume("Professional Summary created software")

    assert result["category_scores"]["Writing clarity"]["score"] == 6

    assert any(
        item["category"] == "Writing clarity"
        for item in result["priority_recommendations"]
    )


def test_action_verbs_are_case_insensitive():
    result = review_resume(
        "DEVELOPED BUILT DESIGNED IMPLEMENTED CREATED"
    )

    assert result["category_scores"]["Writing clarity"]["score"] == 20


def test_measurable_evidence_scoring_with_four_numbers():
    result = review_resume("Professional Summary 10 20 30 40")

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 15
    )


def test_measurable_evidence_scoring_with_one_number():
    result = review_resume("Professional Summary completed 25 projects")

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 10
    )


def test_measurable_evidence_without_numbers():
    result = review_resume("Professional Summary developed software")

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 5
    )

    assert any(
        item["category"] == "Measurable achievements"
        for item in result["priority_recommendations"]
    )


def test_decimal_and_percentage_values_are_counted():
    result = review_resume("Professional Summary improved results by 95.5%")

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 10
    )


def test_phone_number_is_not_counted_as_measurable_evidence():
    result = review_resume(
        "Professional Summary Phone: 9876543210"
    )

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 5
    )


def test_international_phone_number_is_not_counted():
    result = review_resume(
        "Professional Summary Contact: +91 98765 43210"
    )

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 5
    )


@pytest.mark.parametrize(
    "date",
    ["15/08/2025", "2025-08-15", "15-08-2025"]
)
def test_dates_are_not_counted_as_measurable_evidence(date):
    result = review_resume(f"Professional Summary Date: {date}")

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 5
    )


def test_graduation_year_is_not_counted_as_achievement():
    result = review_resume(
        "Professional Summary Graduation Year: 2025"
    )

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 5
    )


def test_year_with_achievement_context_is_counted():
    result = review_resume(
        "Professional Summary Served 2025 users"
    )

    assert (
        result["category_scores"]["Measurable achievements"]["score"]
        == 10
    )


def test_no_target_skills_uses_default_keyword_score():
    result = review_resume("Professional Summary developed software")

    assert result["category_scores"]["Job relevance"]["score"] == 10
    assert result["keyword_suggestions"] == []


def test_none_target_skills_uses_default_keyword_score():
    result = review_resume("Professional Summary", target_skills=None)

    assert result["category_scores"]["Job relevance"]["score"] == 10


def test_all_target_skills_matched():
    result = review_resume(
        "Professional Summary Python Java React",
        target_skills=["Python", "Java", "React"],
    )

    assert result["category_scores"]["Job relevance"]["score"] == 20
    assert result["keyword_suggestions"] == []


def test_partially_matched_target_skills():
    result = review_resume(
        "Professional Summary Python Java",
        target_skills=["Python", "Java", "React", "SQL"],
    )

    assert result["category_scores"]["Job relevance"]["score"] == 10
    assert result["keyword_suggestions"] == ["React", "SQL"]


def test_target_skills_are_deduplicated_and_trimmed():
    result = review_resume(
        "Professional Summary Python",
        target_skills=[" Python ", "Python", " Java ", "", "   "],
    )

    assert result["category_scores"]["Job relevance"]["score"] == 10
    assert result["keyword_suggestions"] == ["Java"]



def test_target_skills_are_deduplicated_case_insensitively():
    result = review_resume(
        "Python Java developer",
        ["Python", "python", "PYTHON", "Java", "JAVA"]
    )

    assert result["category_scores"]["Job relevance"]["score"] == 20
    assert result["keyword_suggestions"] == []


def test_target_skill_deduplication_preserves_first_spelling():
    result = review_resume(
        "Python developer",
        [" python ", "PYTHON", "Java", "JAVA"]
    )

    assert result["keyword_suggestions"] == ["Java"]


def test_target_skill_deduplication_ignores_empty_values():
    result = review_resume(
        "Python developer",
        ["", "  ", None, "Python"]
    )

    assert result["keyword_suggestions"] == []
    assert result["category_scores"]["Job relevance"]["score"] == 20



def test_target_skill_matching_is_case_insensitive():
    result = review_resume(
        "Professional Summary PYTHON",
        target_skills=["python"],
    )

    assert result["category_scores"]["Job relevance"]["score"] == 20
    assert result["keyword_suggestions"] == []


def test_target_skill_matching_respects_word_boundaries():
    result = review_resume(
        "Professional Summary JavaScript developer",
        target_skills=["Java"],
    )

    assert result["keyword_suggestions"] == ["Java"]
    assert result["category_scores"]["Job relevance"]["score"] == 0


def test_missing_keywords_generate_job_relevance_recommendation():
    result = review_resume(
        "Professional Summary Python developer",
        target_skills=["Python", "Java"],
    )

    assert any(
        item["category"] == "Job relevance"
        for item in result["priority_recommendations"]
    )


def test_keyword_suggestions_are_limited_to_fifteen():
    skills = [f"Skill{i}" for i in range(20)]

    result = review_resume(
        "Professional Summary",
        target_skills=skills,
    )

    assert len(result["keyword_suggestions"]) == 15


def test_quality_score_equals_sum_of_category_scores():
    result = review_resume(make_resume())

    expected_score = sum(
        item["score"]
        for item in result["category_scores"].values()
    )

    assert result["quality_score"] == expected_score
    assert 0 <= result["quality_score"] <= 100


def test_category_score_maximums_are_correct():
    result = review_resume(make_resume())

    expected_maximums = {
        "Section completeness": 30,
        "Resume length": 15,
        "Writing clarity": 20,
        "Measurable achievements": 15,
        "Job relevance": 20,
    }

    for category, maximum in expected_maximums.items():
        assert result["category_scores"][category]["maximum"] == maximum


def test_perfect_basic_resume_uses_default_suggestion():
    result = review_resume(make_resume())

    assert result["priority_recommendations"] == []
    assert len(result["suggestions"]) == 1
    assert "did not identify major issues" in result["suggestions"][0]


def test_review_note_explains_rule_based_score():
    result = review_resume(make_resume())

    assert "rule-based" in result["review_note"]
    assert "official ATS score" in result["review_note"]


def test_suggestions_do_not_contain_duplicates():
    result = review_resume("Professional Summary")

    assert len(result["suggestions"]) == len(set(result["suggestions"]))


def test_whitespace_is_normalized_before_word_counting():
    result = review_resume("  Professional \n\n Summary \t Python  ")

    assert result["word_count"] == 3
