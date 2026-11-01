import pytest

from resume_tailor import (
    TECH_SKILLS,
    contains_term,
    extract_sentences,
    tailor_resume,
)


def test_empty_resume_raises_value_error():
    with pytest.raises(ValueError, match="Resume text cannot be empty"):
        tailor_resume("", "Python Developer", "Python required")


@pytest.mark.parametrize("resume", [None, "", "   ", "\n\t"])
def test_empty_or_whitespace_resume_raises_value_error(resume):
    with pytest.raises(ValueError, match="Resume text cannot be empty"):
        tailor_resume(resume, "Developer", "Python required")


def test_missing_job_description_and_skills_raises_value_error():
    with pytest.raises(
        ValueError,
        match="selected job must include a description or skills",
    ):
        tailor_resume("Python developer with project experience", "Developer", "")


def test_none_job_title_uses_default():
    result = tailor_resume(
        "Developed Python applications for users.",
        None,
        "Python",
    )

    assert result["job_title"] == "Selected job"


def test_empty_job_title_uses_default():
    result = tailor_resume(
        "Developed Python applications for users.",
        "   ",
        "Python",
    )

    assert result["job_title"] == "Selected job"


def test_job_title_is_stripped():
    result = tailor_resume(
        "Developed Python applications for users.",
        "  Python Developer  ",
        "Python",
    )

    assert result["job_title"] == "Python Developer"


def test_job_description_is_stripped():
    result = tailor_resume(
        "Developed Python applications for users.",
        "Developer",
        "   Python   ",
    )

    assert "Python" in result["required_skills"]


def test_explicit_job_skills_are_used():
    result = tailor_resume(
        "Developed Python applications for users.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    assert result["required_skills"] == ["Python", "Java"]
    assert result["matched_skills"] == ["Python"]
    assert result["missing_skills"] == ["Java"]


def test_explicit_skills_are_trimmed_and_deduplicated():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "",
        [" Python ", "Python", " Java ", "JAVA"],
    )

    assert result["required_skills"] == ["Python", "Java"]


def test_non_string_explicit_skills_are_converted_to_strings():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "",
        [123, None, "Python"],
    )

    assert result["required_skills"] == ["123", "None", "Python"]


def test_empty_explicit_skills_are_ignored():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "",
        ["", "  ", "Python"],
    )

    assert result["required_skills"] == ["Python"]


def test_technical_skills_are_extracted_from_job_description():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "We need Python, Java, React, and SQL experience.",
    )

    assert result["required_skills"] == [
        "Python",
        "Java",
        "React",
        "SQL",
    ]


def test_description_skills_are_not_added_twice():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "Python and Java required.",
        ["Python", "Java"],
    )

    assert result["required_skills"] == ["Python", "Java"]


def test_skill_deduplication_is_case_insensitive():
    result = tailor_resume(
        "Python developer with project experience.",
        "Developer",
        "",
        ["Python", "PYTHON", "python"],
    )

    assert result["required_skills"] == ["Python"]


def test_all_known_technical_skills_are_available():
    assert "Python" in TECH_SKILLS
    assert "Java" in TECH_SKILLS
    assert "React" in TECH_SKILLS
    assert "Docker" in TECH_SKILLS
    assert "Generative AI" in TECH_SKILLS


def test_description_with_no_recognized_skills_has_zero_match():
    result = tailor_resume(
        "Experienced software developer with project experience.",
        "Developer",
        "Excellent communication and teamwork are required.",
    )

    assert result["required_skills"] == []
    assert result["matched_skills"] == []
    assert result["missing_skills"] == []
    assert result["skill_match_percentage"] == 0


def test_all_required_skills_matched():
    result = tailor_resume(
        "Developed Python and Java applications for clients.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    assert result["matched_skills"] == ["Python", "Java"]
    assert result["missing_skills"] == []
    assert result["skill_match_percentage"] == 100


def test_partially_matched_skills():
    result = tailor_resume(
        "Developed Python applications for clients.",
        "Developer",
        "",
        ["Python", "Java", "React"],
    )

    assert result["matched_skills"] == ["Python"]
    assert result["missing_skills"] == ["Java", "React"]
    assert result["skill_match_percentage"] == 33


def test_no_skills_matched():
    result = tailor_resume(
        "Experienced developer with project experience.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    assert result["matched_skills"] == []
    assert result["missing_skills"] == ["Python", "Java"]
    assert result["skill_match_percentage"] == 0


def test_skill_matching_is_case_insensitive():
    result = tailor_resume(
        "PYTHON developer with JAVA project experience.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    assert result["matched_skills"] == ["Python", "Java"]
    assert result["skill_match_percentage"] == 100


def test_skill_matching_respects_word_boundaries():
    result = tailor_resume(
        "Experienced JavaScript developer with project experience.",
        "Developer",
        "",
        ["Java"],
    )

    assert result["matched_skills"] == []
    assert result["missing_skills"] == ["Java"]


def test_contains_term_matches_case_insensitively():
    assert contains_term("I use PYTHON daily", "python") is True


def test_contains_term_respects_word_boundaries():
    assert contains_term("JavaScript developer", "Java") is False


def test_contains_term_escapes_regex_characters():
    assert contains_term("Experience with C++ and C#", "C++") is True
    assert contains_term("Experience with C++ and C#", "C#") is True


def test_extract_sentences_splits_on_punctuation():
    result = extract_sentences(
        "Developed useful Python applications. "
        "Built Java enterprise software! "
        "Designed React web interfaces?"
    )

    assert result == [
        "Developed useful Python applications.",
        "Built Java enterprise software!",
        "Designed React web interfaces?",
    ]


def test_extract_sentences_splits_on_newlines():
    result = extract_sentences(
        "Developed Python applications for users\n"
        "Built Java enterprise software for clients"
    )

    assert result == [
        "Developed Python applications for users",
        "Built Java enterprise software for clients",
    ]


def test_extract_sentences_ignores_sentences_with_fewer_than_four_words():
    result = extract_sentences(
        "Python developer. "
        "Built useful Python applications for clients."
    )

    assert result == ["Built useful Python applications for clients."]


def test_extract_sentences_handles_empty_text():
    assert extract_sentences("") == []


def test_relevant_resume_evidence_is_extracted():
    result = tailor_resume(
        "Developed Python applications for clients. "
        "Built Java enterprise software for customers.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    evidence = result["relevant_resume_evidence"]

    assert len(evidence) == 2
    assert evidence[0]["skills"] == ["Python"]
    assert evidence[1]["skills"] == ["Java"]


def test_evidence_can_contain_multiple_matched_skills():
    result = tailor_resume(
        "Developed Python and Java applications for enterprise clients.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    evidence = result["relevant_resume_evidence"]

    assert len(evidence) == 1
    assert evidence[0]["skills"] == ["Python", "Java"]


def test_relevant_evidence_is_limited_to_eight_sentences():
    resume = " ".join(
        f"Developed Python applications for project number {i}."
        for i in range(12)
    )

    result = tailor_resume(
        resume,
        "Developer",
        "",
        ["Python"],
    )

    assert len(result["relevant_resume_evidence"]) == 8


def test_no_evidence_generates_evidence_suggestion():
    result = tailor_resume(
        "Experienced software developer with project experience.",
        "Developer",
        "",
        ["Python"],
    )

    assert any(
        "Make relevant project or experience details easier to identify"
        in suggestion
        for suggestion in result["suggestions"]
    )


def test_existing_evidence_generates_reordering_suggestion():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Developer",
        "",
        ["Python"],
    )

    assert any(
        "closer to the top" in suggestion
        for suggestion in result["suggestions"]
    )


def test_missing_skills_generate_accuracy_suggestion():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Developer",
        "",
        ["Python", "Java"],
    )

    assert any(
        "genuinely have that knowledge or experience" in suggestion
        for suggestion in result["suggestions"]
    )


def test_job_title_suggestion_when_title_is_absent():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Python Developer",
        "",
        ["Python"],
    )

    assert any(
        "Python Developer role" in suggestion
        for suggestion in result["suggestions"]
    )


def test_job_title_suggestion_is_omitted_when_title_is_present():
    result = tailor_resume(
        "Python Developer with experience developing applications.",
        "Python Developer",
        "",
        ["Python"],
    )

    assert not any(
        "career goal" in suggestion
        for suggestion in result["suggestions"]
    )


def test_generic_accuracy_suggestion_is_always_present():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Developer",
        "",
        ["Python"],
    )

    assert any(
        "keep every statement accurate" in suggestion
        for suggestion in result["suggestions"]
    )


def test_review_note_contains_accuracy_warning():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Developer",
        "",
        ["Python"],
    )

    assert "rule-based comparison" in result["review_note"]
    assert "Only include claims that are true" in result["review_note"]


def test_result_contains_all_expected_fields():
    result = tailor_resume(
        "Developed Python applications for enterprise clients.",
        "Developer",
        "",
        ["Python"],
    )

    assert set(result) == {
        "job_title",
        "required_skills",
        "matched_skills",
        "missing_skills",
        "skill_match_percentage",
        "relevant_resume_evidence",
        "suggestions",
        "review_note",
    }
