
import { useEffect } from "react";
import { useRef, useState } from "react";
import {
  ArrowRight, Search, FileText, Sparkles,
  BriefcaseBusiness, Target, TrendingUp,
  Code2, BrainCircuit, Database, Cloud,
  ShieldCheck, Menu, X, Upload, CheckCircle2
} from "lucide-react";
import "./App.css";

function App() {
  const fileInput = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  const [jobs, setJobs] = useState([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [hasSearchedJobs, setHasSearchedJobs] = useState(false);

  const [jobType, setJobType] = useState("Any");
  const [experienceLevel, setExperienceLevel] = useState("Any");
  const [workMode, setWorkMode] = useState("Any");
  const [minSalary, setMinSalary] = useState("");
  const [requiredSkills, setRequiredSkills] = useState([]);

  const [totalJobsCollected, setTotalJobsCollected] = useState(0);

  const [savedJobs, setSavedJobs] = useState([]);
  const [showSavedJobs, setShowSavedJobs] = useState(false);
  const [savingJobId, setSavingJobId] = useState(null);


  const [keyword, setKeyword] = useState("software");
  const [location, setLocation] = useState("India");
  const [selectedSources, setSelectedSources] = useState([
    "Remotive",
    "Adzuna",
  ]);
  const [resultLimit, setResultLimit] = useState(10);
  const [sourceWarnings, setSourceWarnings] = useState([]);


  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem("techmatch_token") || ""
  );

  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");


  const [profile, setProfile] = useState(null);
  const [preferredLocation, setPreferredLocation] = useState("India");

  const [preferredCategories, setPreferredCategories] = useState([
    "Software Development",
  ]);

  const [preferredJobType, setPreferredJobType] = useState("Any");
  const [preferredWorkMode, setPreferredWorkMode] = useState("Any");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);



  const categories = [
    { name: "Software Development", icon: Code2 },
    { name: "AI & Machine Learning", icon: BrainCircuit },
    { name: "Data Science", icon: Database },
    { name: "Cloud & DevOps", icon: Cloud },
    { name: "Cybersecurity", icon: ShieldCheck },
    { name: "Web Development", icon: BriefcaseBusiness },
  ];



  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }

      localStorage.setItem("techmatch_token", data.access_token);
      setAuthToken(data.access_token);
      setCurrentUser(data.user);
      setAuthPassword("");
      await loadSavedJobs(data.access_token);

    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };


  const handleRegister = async () => {
    setAuthLoading(true);
    setAuthError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: authName,
            email: authEmail,
            password: authPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      // Register first, then log in to obtain a JWT.
      await handleLogin(authEmail, authPassword);

    } catch (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem("techmatch_token");
    setAuthToken("");
    setCurrentUser(null);
    setSavedJobs([]);
    setAuthPassword("");
    setAuthError("");
  };


  const loadMyProfile = async (token) => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/me",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Login session expired.");
      }

      const data = await response.json();
      setCurrentUser(data.user);
      await loadUserProfile(token);
      await loadSavedJobs(token);

    } catch (error) {
      console.error("Profile loading error:", error);
      handleLogout();
    }
  };


  useEffect(() => {
    if (authToken) {
      loadMyProfile(authToken);
    } else {
      setCurrentUser(null);
      setProfile(null);
    }
  }, [authToken]);



  
  const loadUserProfile = async (token = authToken) => {
    if (!token) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Could not load your profile.");
      }

      const data = await response.json();
      const saved = data.profile;

      setProfile(saved);
      setPreferredLocation(saved.preferred_location || "India");
      setPreferredCategories(saved.preferred_categories || []);
      setPreferredJobType(saved.preferred_job_type || "Any");
      setPreferredWorkMode(saved.preferred_work_mode || "Any");

    } catch (error) {
      console.error("Preference loading error:", error);
      setProfileMessage(error.message);
    }
  };


  const handleSaveProfile = async () => {
    if (!authToken) {
      setProfileMessage("Please log in first.");
      return;
    }

    setProfileLoading(true);
    setProfileMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            preferred_location: preferredLocation,
            preferred_categories: preferredCategories,
            preferred_job_type: preferredJobType,
            preferred_work_mode: preferredWorkMode,
            resume_filename: analysis?.filename || "",
            extracted_skills: analysis?.skills || [],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Profile update failed.");
      }

      setProfile(data.profile);
      setProfileMessage("Your profile was saved successfully.");

      // Apply saved preferences to the job search controls.
      setLocation(preferredLocation);
      setJobType(preferredJobType);
      setWorkMode(preferredWorkMode);

    } catch (error) {
      setProfileMessage(error.message);
    } finally {
      setProfileLoading(false);
    }
  };


  const toggleCategory = (category) => {
    setPreferredCategories((previous) =>
      previous.includes(category)
        ? previous.filter((item) => item !== category)
        : [...previous, category]
    );
  };




  const handleFindJobs = async () => {
    if (!analysis?.extracted_text) {
      setMatchError("Please upload and analyze your resume first.");
      return;
    }

    setMatching(true);
    setMatchError("");
    setHasSearchedJobs(false);
    setJobs([]);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/jobs/recommend-live",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resume_text: analysis.extracted_text,
            limit: 10,
          }),
        }
      );

      const data = await response.json();
      setTotalJobsCollected(data.total_jobs_after_filters ?? 0);
      <p>
        {totalJobsCollected} jobs passed your filters.
        Showing {jobs.length} AI-ranked recommendations.
      </p>
      if (!response.ok) {
        throw new Error(data.detail || "Could not find job recommendations.");
      }

      setJobs(data.recommendations || []);
      setHasSearchedJobs(true);
    } catch (error) {
      setMatchError(error.message || "Something went wrong.");
    } finally {
      setMatching(false);
    }
  };


  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setResume(file);
    setAnalysis(null);
    setError("");

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF or DOCX resume.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/resume/analyze",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Resume analysis failed.");
      }

      setAnalysis(result.data);

    } catch (err) {
      setError(err.message || "Unable to connect to the backend.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };


  const handleUnifiedSearch = async () => {
    if (!authToken) {
      alert("Please log in before searching for jobs.");
      return;
    }
    if (!analysis?.extracted_text) {
      setMatchError("Please upload your resume first.");
      return;
    }

    if (!selectedSources.length) {
      setMatchError("Please select at least one job source.");
      return;
    }

    setMatching(true);
    setMatchError("");
    setJobs([]);
    setSourceWarnings([]);
    setHasSearchedJobs(false);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/jobs/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            resume_text: analysis.extracted_text,
            keyword,
            location,
            sources: selectedSources,
            limit: Number(resultLimit),
            include_demo: false,
            job_type: jobType,
            experience_level: experienceLevel,
            work_mode: workMode,
            min_salary: minSalary === "" ? null : Number(minSalary),
            required_skills: requiredSkills,
          }),
        }
      );

      const data = await response.json();
      setTotalJobsCollected(data.total_jobs_after_filters ?? 0);
      <p>
        {totalJobsCollected} jobs passed your filters.
        Showing {jobs.length} AI-ranked recommendations.
      </p>

      if (!response.ok) {
        throw new Error(data.detail || "Job search failed.");
      }

      setJobs(data.recommendations || []);
      setSourceWarnings(data.source_warnings || []);
      setHasSearchedJobs(true);
    } catch (error) {
      setMatchError(error.message || "Something went wrong.");
    } finally {
      setMatching(false);
    }
  };

  const toggleSource = (source) => {
    setSelectedSources((previous) =>
      previous.includes(source)
        ? previous.filter((item) => item !== source)
        : [...previous, source]
    );
  };


  const toggleRequiredSkill = (skill) => {
    setRequiredSkills((previous) =>
      previous.includes(skill)
        ? previous.filter((item) => item !== skill)
        : [...previous, skill]
    );
  };

  
  const loadSavedJobs = async (token = authToken) => {
    if (!token) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/jobs/saved",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Could not load saved jobs.");
      }

      const data = await response.json();
      setSavedJobs(data.saved_jobs || []);

    } catch (error) {
      setMatchError(error.message);
    }
  };


  const handleSaveJob = async (job) => {
    setSavingJobId(job.id);

    if (!authToken) {
      setAuthError("Please log in to manage saved jobs.");
      return;
    }
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/jobs/saved",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ job }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save job.");
      }

      await loadSavedJobs();
    } catch (error) {
      setMatchError(error.message);
    } finally {
      setSavingJobId(null);
    }
  };


  const handleRemoveSavedJob = async (jobId) => {
    if (!authToken) {
      setAuthError("Please log in to manage saved jobs.");
      return;
    }
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/jobs/saved/${encodeURIComponent(jobId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not remove saved job.");
      }

      await loadSavedJobs();
    } catch (error) {
      setMatchError(error.message);
    }
  };


  const openUpload = () => {
    fileInput.current?.click();
  };

  return (
    <div className="app">

      <nav className="navbar">
        <a href="#" className="brand">
          <div className="brand-icon"><Sparkles size={22} /></div>
          <span>TechMatch<span className="brand-ai"> AI</span></span>
        </a>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <div className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#categories" onClick={() => setMenuOpen(false)}>Job Categories</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
        </div>

        <div className="nav-actions">
          <button className="login-btn" onClick={() => alert("Login module coming soon!")}>Log in</button>
          <button className="nav-cta" onClick={openUpload}>Get Started <ArrowRight size={16} /></button>
        </div>
      </nav>



      <section className="auth-section">
        {currentUser ? (
          <div className="user-profile-bar">
            <div>
              <span className="user-welcome">Welcome back,</span>
              <h3>{currentUser.name}</h3>
              <p>{currentUser.email}</p>
            </div>

            <button
              className="auth-logout-button"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        ) : (
          <div className="auth-card">
            <h2>
              {authMode === "login"
                ? "Welcome to TechMatch AI"
                : "Create Your Account"}
            </h2>

            <p>
              {authMode === "login"
                ? "Log in to access your personal job dashboard."
                : "Register to start your personalized job search."}
            </p>

            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Login
              </button>

              <button
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Register
              </button>
            </div>

            {authMode === "register" && (
              <input
                type="text"
                placeholder="Full Name"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
              />
            )}

            <input
              type="email"
              placeholder="Email Address"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password (minimum 8 characters)"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />

            {authError && (
              <p className="auth-error">{authError}</p>
            )}

            <button
              className="auth-submit-button"
              disabled={authLoading}
              onClick={() => {
                if (authMode === "login") {
                  handleLogin(authEmail, authPassword);
                } else {
                  handleRegister();
                }
              }}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </div>
        )}
      </section>



      {currentUser && (
        <section className="personal-profile">
          <div className="profile-heading">
            <span>PERSONALIZATION</span>
            <h2>Your Job Preferences</h2>
            <p>
              Customize your preferences to make your job
              recommendations more relevant.
            </p>
          </div>

          <div className="profile-form">
            <div className="search-field">
              <label>Preferred Location</label>
              <input
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                placeholder="India, Jabalpur, Remote..."
              />
            </div>

            <div className="search-field">
              <label>Preferred Job Type</label>
              <select
                value={preferredJobType}
                onChange={(e) => setPreferredJobType(e.target.value)}
              >
                <option>Any</option>
                <option>Full-time</option>
                <option>Internship</option>
                <option>Part-time</option>
                <option>Contract</option>
              </select>
            </div>

            <div className="search-field">
              <label>Preferred Work Mode</label>
              <select
                value={preferredWorkMode}
                onChange={(e) => setPreferredWorkMode(e.target.value)}
              >
                <option>Any</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>Onsite</option>
              </select>
            </div>

            <div className="profile-categories">
              <label>Preferred Technology Categories</label>

              <div className="filter-skill-options">
                {[
                  "Software Development",
                  "Artificial Intelligence",
                  "Data Science",
                  "Web Development",
                  "Cloud Computing",
                  "Cybersecurity",
                  "Mobile Development",
                  "DevOps",
                  "Quality Assurance",
                ].map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={preferredCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>

            <div className="profile-resume-info">
              <h3>Resume Skills</h3>

              {analysis?.skills?.length ? (
                <div className="skill-list">
                  {analysis.skills.map((skill) => (
                    <span className="matched-skill" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p>
                  Upload a resume to extract skills for your profile.
                </p>
              )}
            </div>

            <button
              className="save-profile-button"
              onClick={handleSaveProfile}
              disabled={profileLoading}
            >
              {profileLoading ? "Saving..." : "Save My Preferences"}
            </button>

            {profileMessage && (
              <p className="profile-message">{profileMessage}</p>
            )}
          </div>
        </section>
      )}



      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="announcement">
              <Sparkles size={15} />
              AI-powered career discovery
            </div>

            <h1>
              Find the right tech job.
              <span> Let AI do the matching.</span>
            </h1>

            <p className="hero-description">
              Upload your resume once. Discover relevant technology jobs
              from multiple sources, get personalized recommendations,
              and find the opportunities that match your skills.
            </p>

            <div className="hero-actions">
              <button className="primary-btn" onClick={openUpload}>
                Upload Your Resume <ArrowRight size={18} />
              </button>
              <a href="#how-it-works" className="secondary-btn">
                Explore how it works
              </a>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx"
              hidden
              onChange={handleFile}
            />

            
            {resume && (
              <div className="upload-status">
                <FileText size={19} />
                <span>{resume.name}</span>
              </div>
            )}

            {loading && (
              <div className="analysis-message">
                <span className="loader"></span>
                Analyzing your resume...
              </div>
            )}

            {error && (
              <div className="analysis-error">
                {error}
              </div>
            )}

            {analysis && (
              <div className="resume-results">
                <div className="results-heading">
                  <CheckCircle2 size={22} />
                  <div>
                    <h3>Resume analyzed successfully!</h3>
                    <p>{analysis.word_count} words extracted</p>
                  </div>
                </div>

                <div className="results-summary">
                  <strong>{analysis.total_skills}</strong>
                  <span>Technical skills detected</span>
                </div>

                <h4>Extracted Skills</h4>

                <div className="skills-list">
                  {analysis.skills.length > 0 ? (
                    analysis.skills.map((skill) => (
                      <span className="skill-tag" key={skill}>
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p>No recognized technical skills found.</p>
                  )}
                </div>

                <details className="resume-preview">
                  <summary>View extracted resume text</summary>
                  <p>{analysis.text_preview}</p>
                </details>
              </div>
            )}

            
            {analysis?.extracted_text && (
              <section className="search-dashboard">
                <div className="search-heading">
                  <span className="search-eyebrow">AI POWERED JOB DISCOVERY</span>
                  <h2>Find Your Perfect Tech Job</h2>
                  <p>
                    Search across multiple job platforms and discover
                    opportunities matched to your resume.
                  </p>
                </div>

                <div className="search-form">
                  <div className="search-field">
                    <label>Job Keyword</label>
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="e.g. Python Developer"
                    />
                  </div>

                  <div className="search-field">
                    <label>Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. India or Remote"
                    />
                  </div>

                  <div className="search-field">
                    <label>Number of Results</label>
                    <select
                      value={resultLimit}
                      onChange={(e) => setResultLimit(e.target.value)}
                    >
                      <option value="5">5 Jobs</option>
                      <option value="10">10 Jobs</option>
                      <option value="20">20 Jobs</option>
                      <option value="30">30 Jobs</option>
                      <option value="50">50 Jobs</option>
                    </select>
                  </div>

                  <div className="source-selection">
                    <label>Select Job Sources</label>

                    <div className="source-options">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedSources.includes("Remotive")}
                          onChange={() => toggleSource("Remotive")}
                        />
                        Remotive
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          checked={selectedSources.includes("Adzuna")}
                          onChange={() => toggleSource("Adzuna")}
                        />
                        Adzuna
                      </label>
                    </div>
                  </div>


                  <div className="advanced-filters">
                    <h3>Advanced Filters</h3>

                    <div className="search-field">
                      <label>Job Type</label>
                      <select
                        value={jobType}
                        onChange={(e) => setJobType(e.target.value)}
                      >
                        <option>Any</option>
                        <option>Full-time</option>
                        <option>Internship</option>
                        <option>Part-time</option>
                        <option>Contract</option>
                      </select>
                    </div>

                    <div className="search-field">
                      <label>Experience Level</label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                      >
                        <option>Any</option>
                        <option>Fresher</option>
                        <option>Entry-level</option>
                        <option>Mid-level</option>
                        <option>Senior</option>
                      </select>
                    </div>

                    <div className="search-field">
                      <label>Work Mode</label>
                      <select
                        value={workMode}
                        onChange={(e) => setWorkMode(e.target.value)}
                      >
                        <option>Any</option>
                        <option>Remote</option>
                        <option>Hybrid</option>
                        <option>Onsite</option>
                      </select>
                    </div>

                    <div className="search-field">
                      <label>Minimum Annual Salary (INR)</label>
                      <input
                        type="number"
                        min="0"
                        value={minSalary}
                        onChange={(e) => setMinSalary(e.target.value)}
                        placeholder="e.g. 300000"
                      />
                    </div>

                    <div className="filter-skills">
                      <label>Required Skills</label>
                      <div className="filter-skill-options">
                        {[
                          "Python",
                          "Java",
                          "JavaScript",
                          "React",
                          "SQL",
                          "Machine Learning",
                          "TensorFlow",
                          "AWS",
                          "Docker",
                          "Cybersecurity",
                        ].map((skill) => (
                          <label key={skill}>
                            <input
                              type="checkbox"
                              checked={requiredSkills.includes(skill)}
                              onChange={() => toggleRequiredSkill(skill)}
                            />
                            {skill}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>


                  <button
                    className="find-jobs-button"
                    onClick={handleUnifiedSearch}
                    disabled={matching}
                  >
                    {matching ? "Searching Jobs..." : "Search & Match Jobs"}
                  </button>
                </div>
              </section>
            )}



            <section className="saved-jobs-section">
              <div className="saved-jobs-heading">
                <h2>Saved Jobs</h2>

                <button
                  className="saved-jobs-toggle"
                  onClick={() => {
                    const nextState = !showSavedJobs;
                    setShowSavedJobs(nextState);

                    if (nextState) {
                      loadSavedJobs();
                    }
                  }}
                >
                  {showSavedJobs ? "Hide Saved Jobs" : "View Saved Jobs"}
                </button>
              </div>

              {showSavedJobs && (
                <div className="saved-jobs-list">
                  {savedJobs.length === 0 ? (
                    <p>You haven't saved any jobs yet.</p>
                  ) : (
                    savedJobs.map((item) => {
                      const job = item.job;

                      return (
                        <article className="saved-job-card" key={item.id}>
                          <div>
                            <h3>{job.title}</h3>
                            <p>{job.company}</p>
                            <small>Source: {job.source}</small>
                          </div>

                          <div className="saved-job-actions">
                            <a
                              href={job.apply_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Apply ↗
                            </a>

                            <button
                              onClick={() => handleRemoveSavedJob(item.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </section>



            {hasSearchedJobs && (
              <section className="job-results">
                <h2>Your AI Job Recommendations</h2>
                {sourceWarnings.length > 0 && (
                  <div className="source-warning">
                    <strong>Some sources could not be reached:</strong>
                    {sourceWarnings.map((warning, index) => (
                      <p key={index}>{warning}</p>
                    ))}
                  </div>
                )}
                <p>
                  We found {jobs.length} matching opportunities for your resume.
                </p>

                {jobs.length === 0 ? (
                  <p>No matching jobs found in the current dataset.</p>
                ) : (
                  <div className="job-grid">
                    {jobs.map((job, index) => (
                      <article className="job-card" key={job.id || index}>
                        <div className="job-card-top">
                          <span className="job-rank">#{index + 1} Match</span>
                          <span className="match-score">
                            {job.match_score}% Match
                          </span>
                        </div>

                        <h3>{job.title}</h3>
                        <p className="job-company">{job.company}</p>

                        <p className="job-description">{job.description}</p>

                        <div className="job-metrics">
                          <span>Skill match: {job.skill_match}%</span>
                          <span>Semantic similarity: {job.semantic_similarity}%</span>
                        </div>

                        <div className="job-skills">
                          <h4>Matched Skills</h4>
                          <div className="skill-list">
                            {job.matched_skills?.length ? (
                              job.matched_skills.map((skill) => (
                                <span className="matched-skill" key={skill}>
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span>No direct skill matches</span>
                            )}
                          </div>
                        </div>

                        <div className="job-skills">
                          <h4>Skills to Improve</h4>
                          <div className="skill-list">
                            {job.missing_skills?.length ? (
                              job.missing_skills.map((skill) => (
                                <span className="missing-skill" key={skill}>
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span>No missing listed skills</span>
                            )}
                          </div>
                        </div>


                        <button
                          className="save-job-button"
                          onClick={() => handleSaveJob(job)}
                          disabled={savingJobId === job.id}
                        >
                          {savingJobId === job.id ? "Saving..." : "☆ Save Job"}
                        </button>
                        <a
                          className="apply-button"
                          href={job.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Application <span>↗</span>
                        </a>

                        <small className="job-source">
                          Source: {job.source}
                        </small>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}



            <div className="hero-trust">
              <ShieldCheck size={17} />
              Your career journey, powered by intelligent matching.
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-glow"></div>
            <div className="dashboard-card">
              <div className="mock-top">
                <div>
                  <span className="muted-label">YOUR CAREER DASHBOARD</span>
                  <h3>Recommended for you</h3>
                </div>
                <div className="mock-avatar">TM</div>
              </div>

              <div className="profile-match">
                <div className="profile-icon"><FileText size={25} /></div>
                <div>
                  <strong>Resume analyzed</strong>
                  <p>Skills and experience identified</p>
                </div>
                <CheckCircle2 className="success-icon" size={20} />
              </div>

              <div className="match-heading">
                <span>Top job matches</span>
                <span className="match-count">Personalized</span>
              </div>

              <div className="job-preview">
                <div className="company-icon purple">AI</div>
                <div className="job-info">
                  <strong>Machine Learning Intern</strong>
                  <p>Technology Company · Remote</p>
                </div>
                <div className="score">94%</div>
              </div>

              <div className="job-preview">
                <div className="company-icon blue">DS</div>
                <div className="job-info">
                  <strong>Data Science Intern</strong>
                  <p>Analytics Company · Hybrid</p>
                </div>
                <div className="score">89%</div>
              </div>

              <div className="job-preview">
                <div className="company-icon green">SE</div>
                <div className="job-info">
                  <strong>Software Engineer Intern</strong>
                  <p>Product Company · On-site</p>
                </div>
                <div className="score">85%</div>
              </div>

              <div className="mock-footer">
                <Sparkles size={16} />
                AI-powered personalized recommendations
              </div>
            </div>

            <div className="floating-card">
              <Target size={20} />
              <div><strong>Smart Matching</strong><p>Find your best fit</p></div>
            </div>
          </div>
        </section>

        <section className="stats">
          <div><strong>1 Resume</strong><span>One-time upload</span></div>
          <div><strong>Multiple Sources</strong><span>Unified job discovery</span></div>
          <div><strong>AI Matching</strong><span>Personalized results</span></div>
          <div><strong>Skill Insights</strong><span>Identify skill gaps</span></div>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">WHY TECHMATCH AI?</span>
            <h2>Your job search, <span>made smarter.</span></h2>
            <p>Everything you need to discover opportunities that fit your technical profile.</p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon"><FileText /></div>
              <h3>Smart Resume Analysis</h3>
              <p>Extract your technical skills, education, projects and experience automatically.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon"><Search /></div>
              <h3>Multi-Source Job Search</h3>
              <p>Discover technology opportunities from connected and permitted job sources in one place.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon"><Target /></div>
              <h3>AI Job Matching</h3>
              <p>Understand job descriptions semantically and rank opportunities based on your profile.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon"><TrendingUp /></div>
              <h3>Skill Gap Analysis</h3>
              <p>Find missing skills and understand what you can improve for your target roles.</p>
            </article>
          </div>
        </section>

        <section className="section categories-section" id="categories">
          <div className="section-heading">
            <span className="eyebrow">EXPLORE OPPORTUNITIES</span>
            <h2>Built for <span>tech careers.</span></h2>
            <p>Discover opportunities across the technology industry.</p>
          </div>

          <div className="category-grid">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <div className="category-card" key={category.name}>
                  <Icon size={23} />
                  <span>{category.name}</span>
                  <ArrowRight size={17} className="category-arrow" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <span className="eyebrow">SIMPLE PROCESS</span>
            <h2>Three steps to your <span>next opportunity.</span></h2>
          </div>

          <div className="steps-grid">
            <div className="step">
              <div className="step-number">01</div>
              <h3>Upload your resume</h3>
              <p>Upload your existing PDF or DOCX resume. Our AI analyzes your profile.</p>
            </div>
            <div className="step">
              <div className="step-number">02</div>
              <h3>AI finds your matches</h3>
              <p>Our system compares your profile with available technology job listings.</p>
            </div>
            <div className="step">
              <div className="step-number">03</div>
              <h3>Discover and apply</h3>
              <p>Explore ranked opportunities, identify skill gaps and visit official application pages.</p>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div>
            <span className="eyebrow">YOUR NEXT CAREER MOVE</span>
            <h2>Let your skills find the right opportunity.</h2>
            <p>Start your personalized tech job discovery journey.</p>
          </div>
          <button className="primary-btn" onClick={openUpload}>
            Get Started <ArrowRight size={18} />
          </button>
        </section>
      </main>

      <footer>
        <a href="#" className="brand">
          <div className="brand-icon"><Sparkles size={19} /></div>
          <span>TechMatch<span className="brand-ai"> AI</span></span>
        </a>
        <p>Discover better. Match smarter. Build your future.</p>
        <span className="copyright">© 2026 TechMatch AI. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default App;
