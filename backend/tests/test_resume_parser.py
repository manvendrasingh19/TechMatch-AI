
import pymupdf as fitz
import pytest
from docx import Document
from io import BytesIO

from resume_parser import (
    analyze_resume,
    extract_skills,
    extract_text_from_docx,
    extract_text_from_pdf,
)


def create_pdf(text):
    """Create an in-memory PDF containing the supplied text."""
    document = fitz.open()
    page = document.new_page()
    page.insert_text((50, 50), text)

    pdf_bytes = document.tobytes()
    document.close()

    return pdf_bytes


def create_docx(text):
    """Create an in-memory DOCX containing the supplied text."""
    document = Document()
    document.add_paragraph(text)

    file_stream = BytesIO()
    document.save(file_stream)

    return file_stream.getvalue()


def test_extract_text_from_pdf():
    pdf_bytes = create_pdf("Python and Machine Learning")

    extracted_text = extract_text_from_pdf(pdf_bytes)

    assert "Python" in extracted_text
    assert "Machine Learning" in extracted_text


def test_extract_text_from_docx():
    docx_bytes = create_docx("Python Developer with React skills")

    extracted_text = extract_text_from_docx(docx_bytes)

    assert "Python Developer" in extracted_text
    assert "React" in extracted_text


def test_extract_text_from_docx_table():
    document = Document()
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Python"
    table.cell(0, 1).text = "SQL"

    file_stream = BytesIO()
    document.save(file_stream)

    extracted_text = extract_text_from_docx(file_stream.getvalue())

    assert "Python" in extracted_text
    assert "SQL" in extracted_text


def test_extract_skills():
    text = "I know Python, React, SQL and Machine Learning."

    skills = extract_skills(text)

    assert "Python" in skills
    assert "React" in skills
    assert "SQL" in skills
    assert "Machine Learning" in skills


def test_extract_skills_is_case_insensitive():
    text = "PYTHON, react and machine learning"

    skills = extract_skills(text)

    assert "Python" in skills
    assert "React" in skills
    assert "Machine Learning" in skills


def test_java_does_not_match_inside_javascript():
    skills = extract_skills("I work with JavaScript.")

    assert "JavaScript" in skills
    assert "Java" not in skills


def test_analyze_resume_pdf():
    pdf_bytes = create_pdf(
        "Python Developer with React and SQL experience"
    )

    result = analyze_resume("resume.pdf", pdf_bytes)

    assert result["filename"] == "resume.pdf"
    assert result["word_count"] > 0
    assert "Python" in result["skills"]
    assert "React" in result["skills"]
    assert result["total_skills"] == len(result["skills"])
    assert result["text_preview"]
    assert result["extracted_text"]


def test_analyze_resume_docx():
    docx_bytes = create_docx(
        "Java Developer with Spring Boot experience"
    )

    result = analyze_resume("resume.docx", docx_bytes)

    assert result["filename"] == "resume.docx"
    assert "Java" in result["skills"]
    assert "Spring Boot" in result["skills"]


def test_unsupported_file_format():
    with pytest.raises(ValueError, match="Only PDF and DOCX"):
        analyze_resume("resume.txt", b"Some text")


def test_empty_pdf():
    empty_pdf = create_pdf("   ")

    with pytest.raises(ValueError, match="No readable text"):
        analyze_resume("empty.pdf", empty_pdf)


def test_empty_docx():
    empty_docx = create_docx("   ")

    with pytest.raises(ValueError, match="No readable text"):
        analyze_resume("empty.docx", empty_docx)
