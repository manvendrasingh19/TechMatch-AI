# TechMatch-AI

**AI-Powered Resume Analyzer and Job Recommendation Platform**

TechMatch-AI is a web application designed to help technology job seekers analyze their resumes, discover relevant job opportunities, and identify skills that match their career interests.

The platform combines resume text extraction, semantic similarity, skill matching, and job listings from multiple sources to provide relevant job recommendations.

## Features

### Resume Analysis
- Upload resumes in PDF and DOCX formats.
- Extract text and identify technical skills.
- Display extracted skills and resume analysis results.

### Intelligent Job Matching
- Compare resume content with job descriptions.
- Use Sentence Transformers to calculate semantic similarity.
- Calculate skill-match scores.
- Display matched skills and skills to improve.
- Rank jobs according to their matching scores.

### Multi-Source Job Search
- Retrieve job listings from Remotive and Adzuna.
- Search using job keywords and location.
- Select job sources and control the result limit.
- Apply filters such as job type, experience level, work mode, salary, and required skills.

### User Accounts and Profiles
- User registration and login.
- JWT-based authentication.
- Secure password hashing.
- Personalized job preferences, including location, categories, job type, and work mode.

### Saved Jobs
- Save interesting job listings.
- View saved jobs.
- Remove saved jobs.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite |
| UI Icons | Lucide React |
| Backend | Python, FastAPI |
| API Validation | Pydantic |
| Resume Parsing | PyMuPDF, python-docx |
| Semantic Matching | Sentence Transformers |
| Machine Learning Utilities | NumPy, scikit-learn |
| Database | SQLite |
| Authentication | JWT, pwdlib |
| External Job Sources | Remotive API, Adzuna API |

## How Job Matching Works

TechMatch-AI combines semantic similarity and skill matching to rank job opportunities.

The matching algorithm uses the following weighted formula:

**Final Match Score = (0.65 × Semantic Similarity) + (0.35 × Skill Match)**

1. The resume text and job descriptions are converted into embeddings using the `all-MiniLM-L6-v2` Sentence Transformer model.
2. Cosine similarity measures the semantic relationship between the resume and each job description.
3. A skill-matching component evaluates the technical skills found in the resume.
4. Both scores are combined into a final score.
5. Jobs are sorted by their final matching scores.

## Project Structure

```text
TechMatch-AI/
│
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── resume_parser.py
│   ├── job_matcher.py
│   ├── job_sources.py
│   ├── adzuna_source.py
│   ├── saved_jobs.py
│   ├── user_profiles.py
│   ├── jobs.json
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## Installation and Setup

### Prerequisites

- Python installed.
- Node.js and npm installed.
- Git installed.
- Adzuna API credentials for Adzuna job searches.

### 1. Clone the Repository

```bash
git clone https://github.com/manvendrasingh19/TechMatch-AI.git
cd TechMatch-AI
```

### 2. Set Up the Backend

Open a terminal in the project root:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment.

**Windows Git Bash:**

```bash
source venv/Scripts/activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory.

Add the following configuration:

```env
JWT_SECRET=replace_with_a_random_secret_of_at_least_32_characters
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
ADZUNA_COUNTRY=in
```

Keep your actual `.env` file private. Never commit API credentials or secret keys to GitHub.

### 4. Start the Backend Server

From the `backend` directory, run:

```bash
python -m uvicorn main:app --reload
```

Backend API:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

The first execution of the semantic matching engine may download the Sentence Transformer model.

### 5. Set Up the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend in your browser:

```text
http://localhost:5173
```

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Root endpoint |
| GET | `/api/health` | API health check |
| GET | `/api/jobs/live` | Retrieve live jobs |
| GET | `/api/jobs/adzuna` | Retrieve Adzuna jobs |
| POST | `/api/resume/analyze` | Analyze an uploaded resume |
| POST | `/api/jobs/recommend` | Generate job recommendations |
| POST | `/api/jobs/recommend-live` | Generate recommendations from live jobs |
| POST | `/api/jobs/search` | Search and filter jobs |
| POST | `/api/jobs/saved` | Save a job |
| GET | `/api/jobs/saved` | Retrieve saved jobs |
| DELETE | `/api/jobs/saved/{job_id}` | Delete a saved job |
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Retrieve current user information |
| GET | `/api/profile` | Retrieve user profile |
| PUT | `/api/profile` | Update user profile |

## Database

TechMatch-AI uses SQLite to store application data, including user accounts, saved jobs, and user profiles.

The database is initialized by the backend application.

## Security

- Passwords are hashed using `pwdlib`.
- Authentication uses JSON Web Tokens (JWT).
- Secret keys and API credentials are configured through environment variables.
- Local environment files and database files should not be committed to the public repository.

## Future Improvements

- Improve resume parsing and skill extraction.
- Expand job-source integrations.
- Add more advanced recommendation and ranking methods.
- Improve personalized career guidance.
- Add more detailed resume feedback.

## Author

**Manvendra Singh**

GitHub: [manvendrasingh19](https://github.com/manvendrasingh19)

---

*TechMatch-AI — Connecting skills with opportunities.*