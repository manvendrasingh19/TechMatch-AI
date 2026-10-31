
import re
from io import BytesIO

import fitz
from docx import Document


TECH_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#",
    "HTML", "CSS", "React", "Angular", "Vue", "Node.js",
    "Express", "Django", "Flask", "FastAPI",
    "Machine Learning", "Deep Learning", "Artificial Intelligence",
    "Natural Language Processing", "Computer Vision",
    "TensorFlow", "PyTorch", "Keras", "Scikit-learn",
    "Pandas", "NumPy", "OpenCV", "YOLO", "BERT",
    "SQL", "MySQL", "PostgreSQL", "MongoDB",
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes",
    "Git", "GitHub", "Linux", "REST API",
    "Data Structures", "Algorithms",
    "Data Analysis", "Data Science",
    "Power BI", "Tableau", "Excel",
    "HTML5", "Bootstrap", "Tailwind CSS",
    "Spring Boot", "PHP", "Laravel",
    "Cybersecurity", "Networking",
    "Generative AI", "Large Language Models",
    "LangChain", "RAG", "Transformers",
]


def extract_text_from_pdf(file_bytes):
    text = ""

    with fitz.open(
        stream=file_bytes,
        filetype="pdf"
    ) as document:

        for page in document:
            text += page.get_text() + "\n"

    return text


def extract_text_from_docx(file_bytes):
    document = Document(BytesIO(file_bytes))

    text_parts = []

    for paragraph in document.paragraphs:
        text_parts.append(paragraph.text)

    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                text_parts.append(cell.text)

    return "\n".join(text_parts)


def extract_skills(text):
    found_skills = []

    normalized_text = text.lower()

    for skill in TECH_SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)"

        if re.search(pattern, normalized_text):
            found_skills.append(skill)

    return found_skills


def analyze_resume(filename, file_bytes):

    extension = filename.lower().split(".")[-1]

    if extension == "pdf":
        extracted_text = extract_text_from_pdf(file_bytes)

    elif extension == "docx":
        extracted_text = extract_text_from_docx(file_bytes)

    else:
        raise ValueError("Only PDF and DOCX files are supported.")

    if not extracted_text.strip():
        raise ValueError(
            "No readable text found. The PDF may be scanned or image-based."
        )

    skills = extract_skills(extracted_text)

    return {
        "filename": filename,
        "word_count": len(extracted_text.split()),
        "skills": skills,
        "total_skills": len(skills),
        "text_preview": extracted_text[:500],
        "extracted_text": extracted_text
    }
