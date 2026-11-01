import ApplicationTracker from "./ApplicationTracker";
import { useEffect } from "react";
import { useRef, useState } from "react";
import {
  ArrowRight, Search, FileText, Sparkles,
  BriefcaseBusiness, Target, TrendingUp,
  Code2, BrainCircuit, Database, Cloud,
  ShieldCheck, Menu, X, Upload, CheckCircle2, Eye, EyeOff,
  UserRound, Mail, LogOut, ArrowUpRight
} from "lucide-react";
import "./App.css";
import { jsPDF } from "jspdf";

function App() {
  const fileInput = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDemoMatch, setActiveDemoMatch] = useState(0);
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
  const [showPassword, setShowPassword] = useState(false);


  const [profile, setProfile] = useState(null);
  const [preferredLocation, setPreferredLocation] = useState("India");

  const [preferredCategories, setPreferredCategories] = useState([
    "Software Development",
  ]);

  const [preferredJobType, setPreferredJobType] = useState("Any");
  const [preferredWorkMode, setPreferredWorkMode] = useState("Any");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [showApplicationTracker, setShowApplicationTracker] =
    useState(false);

  const [resumeReview, setResumeReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [tailorResult, setTailorResult] = useState(null);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorError, setTailorError] = useState("");

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
    setResume(null);
    setAnalysis(null);
    setJobs([]);
    setResumeReview(null);
    setTailorResult(null);
    setHasSearchedJobs(false);
    setShowSavedJobs(false);
    setShowApplicationTracker(false);
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
    if (!requireLogin()) return;
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
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            resume_text: analysis.extracted_text,
            limit: 10,
          }),
        }
      );

      const data = await response.json();
      setTotalJobsCollected(data.total_jobs_after_filters ?? 0);
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

  
  const handleResumeReview = async () => {
    if (!requireLogin()) return;
    if (!analysis?.extracted_text) {
      setReviewError("Please upload and analyze your resume first.");
      return;
    }

    setReviewLoading(true);
    setReviewError("");
    setResumeReview(null);

    try {
      const targetSkills = [
        ...new Set(
          jobs.flatMap((job) => job.missing_skills || [])
        ),
      ];

      const response = await fetch(
        "http://127.0.0.1:8000/api/resume/improve",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            resume_text: analysis.extracted_text,
            target_skills: targetSkills,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not review your resume."
        );
      }

      setResumeReview(data);
    } catch (error) {
      setReviewError(
        error.message || "Unable to connect to the backend."
      );
    } finally {
      setReviewLoading(false);
    }
  };


  const requireLogin = () => {
    if (!authToken || !currentUser) {
      setAuthError("Please log in or create an account to access this feature.");

      document.getElementById("auth-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      return false;
    }

    return true;
  };

  const handleFile = async (event) => {
    if (!requireLogin()) {
      event.target.value = "";
      return;
    }
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
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
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
            Authorization: `Bearer ${authToken}`,
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

  
  
  const exportCareerReport = () => {
    if (!analysis || !resumeReview) {
      alert("Please analyze and review your resume before exporting.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addPageIfNeeded = (requiredHeight = 12) => {
      if (y + requiredHeight > pageHeight - 18) {
        doc.addPage();
        y = 20;
      }
    };

    const addTitle = (text) => {
      addPageIfNeeded(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(text, margin, y);
      y += 10;
    };

    const addHeading = (text) => {
      addPageIfNeeded(12);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(text, margin, y);
      y += 7;
    };

    const addText = (text) => {
      const lines = doc.splitTextToSize(
        String(text || ""),
        contentWidth
      );

      addPageIfNeeded(lines.length * 6 + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(lines, margin, y);
      y += lines.length * 6 + 3;
    };

    const addList = (items) => {
      if (!items?.length) {
        addText("None identified.");
        return;
      }

      items.forEach((item) => {
        addText(`• ${item}`);
      });
    };

    // Report title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("TechMatch AI", margin, y);
    y += 9;

    doc.setFontSize(14);
    doc.text("Personal Career Analysis Report", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleDateString()}`,
      margin,
      y
    );
    y += 12;

    // Resume overview
    addTitle("1. Resume Overview");
    addText(`Words analyzed: ${resumeReview.word_count}`);
    addText(
      `Resume quality score: ${resumeReview.quality_score}/100`
    );
    addText(
      `Sections found: ${resumeReview.sections_found.join(", ") || "None"}`
    );
    addText(
      `Sections to consider adding: ${
        resumeReview.missing_sections.join(", ") || "None"
      }`
    );

    // Category scores
    addTitle("2. Category-wise Scores");

    Object.entries(resumeReview.category_scores || {}).forEach(
      ([category, result]) => {
        addText(
          `${category}: ${result.score}/${result.maximum}`
        );
      }
    );

    // Resume improvement
    addTitle("3. Resume Improvement Suggestions");
    addList(resumeReview.suggestions);

    addHeading("Priority Recommendations");

    if (resumeReview.priority_recommendations?.length) {
      resumeReview.priority_recommendations.forEach((item) => {
        addText(
          `${item.priority} - ${item.category}: ${item.recommendation}`
        );
      });
    } else {
      addText("No additional priority recommendations.");
    }

    // Job-related keywords
    addTitle("4. Job-Related Keywords to Review");
    addList(resumeReview.keyword_suggestions);

    // Skill gap analysis
    addTitle("5. Career Skill Gaps");

    const skillGaps = calculateSkillGaps();

    if (skillGaps.length) {
      skillGaps.forEach((item) => {
        addText(`${item.skill}: found in ${item.count} job recommendations`);
      });
    } else {
      addText(
        "No skill gaps were identified from the current job recommendations."
      );
    }

    // Selected job tailoring
    addTitle("6. Job-Specific Resume Analysis");

    if (tailorResult) {
      addText(`Selected role: ${tailorResult.job_title}`);
      addText(
        `Skill match: ${tailorResult.skill_match_percentage}%`
      );

      addHeading("Matched Skills");
      addList(tailorResult.matched_skills);

      addHeading("Skills Not Found in Resume");
      addList(tailorResult.missing_skills);

      addHeading("Relevant Resume Evidence");

      if (tailorResult.relevant_resume_evidence?.length) {
        tailorResult.relevant_resume_evidence.forEach((item) => {
          addText(item.text);
          addText(`Related skills: ${item.skills.join(", ")}`);
        });
      } else {
        addText("No relevant evidence was identified.");
      }

      addHeading("Job-Specific Suggestions");
      addList(tailorResult.suggestions);
    } else {
      addText(
        "No job-specific tailoring analysis is available. Use the Tailor Resume button on a job card to include this section in a future report."
      );
    }

    // Disclaimer
    addTitle("7. Important Note");
    addText(
      "This report contains rule-based resume checks and job matching results. It is not an official ATS evaluation or a guarantee of employment. Verify all information and include only skills, experience, and qualifications that are accurate."
    );

    doc.save("TechMatch-AI-Career-Report.pdf");
  };

  const handleTailorResume = async (job, index) => {
    if (!requireLogin()) return;
    if (!analysis?.extracted_text) {
      setTailorError("Please upload and analyze your resume first.");
      return;
    }

    setTailorLoading(true);
    setTailorError("");
    setTailorResult(null);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/resume/tailor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            resume_text: analysis.extracted_text,
            job_title: job.title || "Selected job",
            job_description: job.description || "",
            job_skills: [
              ...(job.skills || []),
              ...(job.matched_skills || []),
              ...(job.missing_skills || []),
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not tailor your resume for this job."
        );
      }

      setTailorResult({
        jobKey: job.id || index,
        ...data,
      });
    } catch (error) {
      setTailorError(error.message || "Something went wrong.");
    } finally {
      setTailorLoading(false);
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

  
  const handleAddToApplications = async (job) => {
    if (!authToken) {
      setAuthError("Please log in to track applications.");
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/applications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            job,
            status: "Interested",
            notes: ""
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not add job to tracker.");
      }

      alert("Job added to your Application Tracker!");
    } catch (error) {
      setMatchError(error.message);
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


  
  const skillLearningResources = {
    "java": {
      name: "Official Java Tutorials",
      url: "https://dev.java/learn/"
    },
    "angular": {
      name: "Official Angular Tutorials",
      url: "https://angular.dev/tutorials"
    },
    "node.js": {
      name: "Official Node.js Learning",
      url: "https://nodejs.org/learn"
    },
    "express": {
      name: "Official Express Guide",
      url: "https://expressjs.com/en/starter/installing/"
    },
    "postgresql": {
      name: "Official PostgreSQL Tutorial",
      url: "https://www.postgresql.org/docs/current/tutorial.html"
    },
    "mysql": {
      name: "Official MySQL Tutorial",
      url: "https://dev.mysql.com/doc/mysql-tutorial-excerpt/8.0/en/"
    },
    "django": {
      name: "Official Django Tutorial",
      url: "https://docs.djangoproject.com/en/stable/intro/tutorial01/"
    }
  };

  const calculateSkillGaps = () => {
    const skillFrequency = {};

    jobs.forEach((job) => {
      (job.missing_skills || []).forEach((skill) => {
        const normalizedSkill = skill.trim();
        const key = normalizedSkill.toLowerCase();

        if (!key) return;

        if (!skillFrequency[key]) {
          skillFrequency[key] = {
            name: normalizedSkill,
            count: 0
          };
        }

        skillFrequency[key].count += 1;
      });
    });

    return Object.values(skillFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const getSkillPriority = (count) => {
    // Small samples are not sufficient to establish demand.
    if (jobs.length < 5) {
      return "Early signal";
    }

    const percentage = count / jobs.length;

    if (percentage >= 0.6) return "High priority";
    if (percentage >= 0.3) return "Medium priority";

    return "Explore";
  };

  
  const openUpload = () => {
    if (!requireLogin()) return;

    fileInput.current?.click();
  };

  return (
    
    <div className="app">

      <nav className="navbar">
        <a href="#" className="brand">
          <div className="brand-icon"><Sparkles size={22} /></div>
          <span className="brand-wordmark">TechMatch<span className="brand-ai"> AI</span></span>
          <span className="brand-pill">SMART CAREERS</span>
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
          <span className="nav-status">
            <span className="nav-status-dot" />
            AI MATCHING READY
          </span>
          {currentUser && (
            <button
              className="login-btn"
              onClick={() => setShowApplicationTracker(true)}
            >
              My Applications
            </button>
          )}

          <button className="nav-cta" onClick={openUpload}>
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </nav>



      <section className="auth-section" id="auth-section">
        {currentUser ? (
          <div className="user-profile-bar">
            <div className="user-profile-main">
              <div className="user-avatar" aria-hidden="true">
                {currentUser.name
                  ?.trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase() || <UserRound size={25} />}
                <span className="user-avatar-status" />
              </div>

              <div className="user-identity">
                <div className="user-welcome-row">
                  <span className="user-welcome">YOUR TECHMATCH SPACE</span>
                  <span className="user-active-badge">
                    <span />
                    ACCOUNT ACTIVE
                  </span>
                </div>
                <h3>Welcome back, {currentUser.name?.split(" ")[0] || "there"}!</h3>
                <p className="user-email">
                  <Mail size={14} />
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="user-profile-actions">
              <button
                type="button"
                className="user-action-button user-applications-button"
                onClick={() => setShowApplicationTracker(true)}
              >
                <BriefcaseBusiness size={16} />
                My Applications
                <ArrowUpRight size={14} />
              </button>

              <button
                type="button"
                className="user-action-button user-preferences-button"
                onClick={() => {
                  document.querySelector(".personal-profile")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }}
              >
                <UserRound size={16} />
                Preferences
              </button>

              <span className="user-actions-divider" />

              <button
                type="button"
                className="auth-logout-button"
                onClick={handleLogout}
                aria-label="Log out of TechMatch AI"
                title="Log out"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>

            <div className="user-profile-decoration" aria-hidden="true">
              <span className="user-decoration-orb user-decoration-orb-one" />
              <span className="user-decoration-orb user-decoration-orb-two" />
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-eyebrow">
              <Sparkles size={13} />
              AI-POWERED CAREER COMPANION
              <span className="auth-eyebrow-tag">SECURE ACCESS</span>
            </div>

            <div className="auth-heading-row">
              <div className="auth-heading-mark"><Sparkles size={20} /></div>
              <span className="auth-heading-caption">YOUR CAREER, MATCHED SMARTER</span>
            </div>

            <h2>
              {authMode === "login"
                ? <>Welcome back to <span className="auth-title-accent">TechMatch AI</span></>
                : <>Create your <span className="auth-title-accent">TechMatch</span> account</>}
            </h2>

            <p>
              {authMode === "login"
                ? "Log in to unlock your personalized job matches and career insights."
                : "Create your account to discover opportunities tailored to your skills."}
            </p>

            <div className="auth-tabs" role="tablist" aria-label="Authentication options">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "login"}
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setShowPassword(false);
                }}
              >
                Login
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={authMode === "register"}
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                  setShowPassword(false);
                }}
              >
                Create Account
              </button>
            </div>

            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (authLoading) return;
                if (authMode === "login") {
                  handleLogin(authEmail, authPassword);
                } else {
                  handleRegister();
                }
              }}
            >
              {authMode === "register" && (
                <label className="auth-field-label">
                  Full name
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label className="auth-field-label">
                Email address
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="auth-field-label">
                Password
                <span className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              {authError && (
                <p className="auth-error" role="alert" aria-live="polite">
                  {authError}
                </p>
              )}

              <button
                className="auth-submit-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <span className="auth-spinner" />
                    Please wait...
                  </>
                ) : (
                  <>
                    {authMode === "login" ? "Log In to Dashboard" : "Create My Account"}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-assurance">
              <ShieldCheck size={15} />
              <span>Secure sign-in</span>
              <span className="assurance-separator">•</span>
              <span>Your career data stays private</span>
            </div>
          </div>
        )}
      </section>

    {showApplicationTracker && currentUser ? (
      <ApplicationTracker
        authToken={authToken}
        onClose={() => setShowApplicationTracker(false)}
      />
    ) : (
      <>

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
                  <span className="demo-preview-label">INTERACTIVE PREVIEW</span>
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

              <div className="demo-match-list" aria-label="Example job matches">
                <button
                  type="button"
                  className={`job-preview ${activeDemoMatch === 0 ? "job-preview-active" : ""}`}
                  onClick={() => setActiveDemoMatch(0)}
                  aria-pressed={activeDemoMatch === 0}
                >
                  <span className="company-icon purple">AI</span>
                  <span className="job-info">
                    <strong>Machine Learning Intern</strong>
                    <span>Technology Company · Remote</span>
                  </span>
                  <span className="score">94%</span>
                </button>

                <button
                  type="button"
                  className={`job-preview ${activeDemoMatch === 1 ? "job-preview-active" : ""}`}
                  onClick={() => setActiveDemoMatch(1)}
                  aria-pressed={activeDemoMatch === 1}
                >
                  <span className="company-icon blue">DS</span>
                  <span className="job-info">
                    <strong>Data Science Intern</strong>
                    <span>Analytics Company · Hybrid</span>
                  </span>
                  <span className="score">89%</span>
                </button>

                <button
                  type="button"
                  className={`job-preview ${activeDemoMatch === 2 ? "job-preview-active" : ""}`}
                  onClick={() => setActiveDemoMatch(2)}
                  aria-pressed={activeDemoMatch === 2}
                >
                  <span className="company-icon green">SE</span>
                  <span className="job-info">
                    <strong>Software Engineer Intern</strong>
                    <span>Product Company · On-site</span>
                  </span>
                  <span className="score">85%</span>
                </button>
              </div>

              <div className="demo-match-insight" aria-live="polite">
                <span className="demo-insight-icon"><Sparkles size={14} /></span>
                <span>
                  <strong>
                    {["Best alignment", "Strong potential", "Great role fit"][activeDemoMatch]}
                  </strong>
                  <small>
                    {[
                      "Illustrative match preview · 94% compatibility",
                      "Illustrative match preview · 89% compatibility",
                      "Illustrative match preview · 85% compatibility"
                    ][activeDemoMatch]}
                  </small>
                </span>
                <span className="demo-insight-dots" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <i key={index} className={activeDemoMatch === index ? "active" : ""} />
                  ))}
                </span>
              </div>

              <div className="mock-footer">
                <Sparkles size={16} />
                AI-powered personalized recommendations
              </div>
            </div>

            <a className="floating-card" href="#features" aria-label="Explore smart matching features">
              <span className="floating-card-icon"><Target size={20} /></span>
              <span><strong>Smart Matching</strong><p>Find your best fit</p></span>
              <ArrowRight className="floating-card-arrow" size={15} />
            </a>
          </div>
        </section>

        <section className="career-workspace" aria-label="Your career workspace">
          <div className="career-workspace-inner">
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
              <section className="resume-advisor">
                <div className="resume-advisor-heading">
                  <span className="search-eyebrow">
                    AI RESUME REVIEW
                  </span>
                  <h2>Improve Your Resume</h2>
                  <p>
                    Get practical suggestions to strengthen your
                    technology resume.
                  </p>
                </div>

                <button
                  className="primary-btn"
                  onClick={handleResumeReview}
                  disabled={reviewLoading}
                >
                  {reviewLoading
                    ? "Reviewing Resume..."
                    : "Review My Resume"}
                </button>

                {reviewError && (
                  <p className="analysis-error">{reviewError}</p>
                )}

                {resumeReview && (
                  <div className="resume-advisor-results">
                    
                  <div className="resume-quality-score">
                    <div className="quality-score-circle">
                      <strong>{resumeReview.quality_score}</strong>
                      <span>/ 100</span>
                    </div>

                    <div className="quality-score-description">
                      <h3>Resume Quality Score</h3>
                      <p>
                        {resumeReview.quality_score >= 80
                          ? "Strong foundation! Keep refining your resume."
                          : resumeReview.quality_score >= 60
                          ? "Good start. A few improvements can strengthen your resume."
                          : resumeReview.quality_score >= 40
                          ? "Your resume has room for improvement."
                          : "Focus on building a stronger and more complete resume."}
                      </p>
                      <small>
                        This is an estimated rule-based score, not an official ATS score.
                      </small>
                    </div>
                  </div>

                  <div className="resume-category-scores">
                    <h3>Category-wise Score</h3>

                    {Object.entries(resumeReview.category_scores).map(
                      ([category, result]) => (
                        <div className="category-score-row" key={category}>
                          <div className="category-score-heading">
                            <span>{category}</span>
                            <strong>
                              {result.score}/{result.maximum}
                            </strong>
                          </div>

                          <div className="category-score-track">
                            <div
                              className="category-score-fill"
                              style={{
                                width: `${
                                  (result.score / result.maximum) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="priority-recommendations">
                    <h3>Priority Recommendations</h3>

                    {resumeReview.priority_recommendations.length > 0 ? (
                      resumeReview.priority_recommendations.map((item, index) => (
                        <div className="priority-item" key={index}>
                          <div className="priority-item-heading">
                            <strong>{item.category}</strong>
                            <span
                              className={`priority-label ${item.priority.toLowerCase()}`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p>{item.recommendation}</p>
                        </div>
                      ))
                    ) : (
                      <p>No additional priority recommendations at this time.</p>
                    )}
                  </div>

                    <div className="resume-review-stats">
                      <div>
                        <strong>{resumeReview.word_count}</strong>
                        <span>Words analyzed</span>
                      </div>
                      <div>
                        <strong>{resumeReview.sections_found.length}</strong>
                        <span>Sections found</span>
                      </div>
                      <div>
                        <strong>{resumeReview.missing_sections.length}</strong>
                        <span>Sections to review</span>
                      </div>
                    </div>

                    <h3>Sections Found</h3>
                    <div className="skills-list">
                      {resumeReview.sections_found.map((section) => (
                        <span className="skill-tag" key={section}>
                          {section}
                        </span>
                      ))}
                    </div>

                    <h3>Sections to Consider Adding</h3>
                    {resumeReview.missing_sections.length > 0 ? (
                      <ul>
                        {resumeReview.missing_sections.map((section) => (
                          <li key={section}>{section}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>All checked resume sections were detected.</p>
                    )}

                    <h3>Improvement Suggestions</h3>
                    <ul>
                      {resumeReview.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>

                    <h3>Job-Related Keywords to Review</h3>
                    {resumeReview.keyword_suggestions.length > 0 ? (
                      <div className="skills-list">
                        {resumeReview.keyword_suggestions.map((skill) => (
                          <span className="skill-tag" key={skill}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>
                        No additional keywords were identified from the
                        current job recommendations.
                      </p>
                    )}

                    <p className="resume-review-note">
                      {resumeReview.review_note}
                    </p>
                  </div>
                )}
                
                {resumeReview && (
                  <button
                    className="export-report-button"
                    onClick={exportCareerReport}
                  >
                    ↓ Download Career Report (PDF)
                  </button>
                )}

              </section>
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


                  {matchError && (
                    <p className="error-message" role="alert">
                      {matchError}
                    </p>
                  )}
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
                <div className="saved-jobs-title">
                  <span className="saved-jobs-icon"><BriefcaseBusiness size={19} /></span>
                  <span>
                    <h2>Saved Jobs</h2>
                    <small>Your shortlist, all in one place</small>
                  </span>
                </div>

                <button
                  className="saved-jobs-toggle"
                  onClick={() => {
                    if (!currentUser || !authToken) {
                      setAuthError("Please log in to view your saved jobs.");
                      document.getElementById("auth-section")?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                      });
                      return;
                    }

                    const nextState = !showSavedJobs;
                    setShowSavedJobs(nextState);

                    if (nextState) {
                      loadSavedJobs();
                    }
                  }}
                >
                  {showSavedJobs ? "Hide Saved Jobs" : currentUser ? "View Saved Jobs" : "Log in to View"}
                  <ArrowRight size={16} />
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
                
              
              <div className="skill-gap-section">
                <div className="skill-gap-heading">
                  <span>AI CAREER INSIGHTS</span>
                  <h2>Your Resume Skill Gap Analysis</h2>
                  <p>
                    Skills frequently requested by your recommended
                    jobs that were not detected in your resume.
                  </p>
                </div>

                {jobs.length < 5 && (
                  <p className="skill-gap-notice">
                    Small sample: these insights are based on only{" "}
                    {jobs.length} recommended jobs. Search more jobs
                    for more reliable skill-priority estimates.
                  </p>
                )}

                {calculateSkillGaps().length > 0 ? (
                  <div className="skill-gap-grid">
                    {calculateSkillGaps().map((item, index) => {
                      const resource =
                        skillLearningResources[item.name.toLowerCase()];

                      const fallbackUrl =
                        "https://www.google.com/search?q=" +
                        encodeURIComponent(
                          item.name + " official documentation tutorial"
                        );

                      return (
                        <div className="skill-gap-card" key={item.name}>
                          <div className="skill-gap-number">
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          <h3>{item.name}</h3>

                          <p>
                            Appears in {item.count} of {jobs.length}
                            {" "}recommended jobs
                          </p>

                          <div className="skill-gap-bar">
                            <div
                              style={{
                                width: `${
                                  (item.count / jobs.length) * 100
                                }%`
                              }}
                            />
                          </div>

                          <span className="skill-gap-priority">
                            {getSkillPriority(item.count)}
                          </span>

                          <a
                            className="skill-learning-link"
                            href={resource?.url || fallbackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {resource?.name || "Find learning resources"}
                            ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p>
                    No skill gaps identified in the current recommendations.
                  </p>
                )}
              </div>



                <h2>Your AI Job Recommendations</h2>
                {sourceWarnings.length > 0 && (
                  <div className="source-warning">
                    <strong>Some sources could not be reached:</strong>
                    {sourceWarnings.map((warning, index) => (
                      <p key={index}>{warning}</p>
                    ))}
                  </div>
                )}
                <p className="job-results-summary">
                  {totalJobsCollected} jobs passed your filters.
                  {" "}Showing {jobs.length} AI-ranked recommendations.
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
                          className="tailor-resume-button"
                          onClick={() => handleTailorResume(job, index)}
                          disabled={tailorLoading}
                        >
                          {tailorLoading ? "Analyzing..." : "✦ Tailor Resume"}
                        </button>

                        {tailorError && (
                          <p className="tailor-error">{tailorError}</p>
                        )}

                        {tailorResult?.jobKey === (job.id || index) && (
                          <div className="tailor-result">
                            <h4>Resume Tailoring Analysis</h4>

                            <div className="tailor-match-score">
                              {tailorResult.skill_match_percentage}% Skill Match
                            </div>

                            <h5>Matched Skills</h5>
                            <div className="skill-list">
                              {tailorResult.matched_skills.length > 0 ? (
                                tailorResult.matched_skills.map((skill) => (
                                  <span className="matched-skill" key={skill}>
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <p>No direct skill matches found.</p>
                              )}
                            </div>

                            <h5>Skills Not Found in Resume</h5>
                            <div className="skill-list">
                              {tailorResult.missing_skills.length > 0 ? (
                                tailorResult.missing_skills.map((skill) => (
                                  <span className="missing-skill" key={skill}>
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <p>All identified job skills were found in your resume.</p>
                              )}
                            </div>

                            <h5>Relevant Resume Evidence</h5>
                            {tailorResult.relevant_resume_evidence.length > 0 ? (
                              <ul>
                                {tailorResult.relevant_resume_evidence.map((item, index) => (
                                  <li key={index}>
                                    {item.text}
                                    <div className="skill-list">
                                      {item.skills.map((skill) => (
                                        <span className="matched-skill" key={skill}>
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>No relevant sentences were identified by the keyword check.</p>
                            )}

                            <h5>Suggestions for This Job</h5>
                            <ul>
                              {tailorResult.suggestions.map((suggestion, index) => (
                                <li key={index}>{suggestion}</li>
                              ))}
                            </ul>

                            <p className="tailor-note">{tailorResult.review_note}</p>
                          </div>
                        )}


                        <button
                          className="save-job-button"
                          onClick={() => handleSaveJob(job)}
                          disabled={savingJobId === job.id}
                        >
                          {savingJobId === job.id ? "Saving..." : "☆ Save Job"}
                        </button>
                        <button
                          className="save-job-button"
                          onClick={() => handleAddToApplications(job)}
                        >
                          + Add to Applications
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



          </div>
        </section>

        <section className="stats" aria-label="TechMatch AI capabilities">
          <button className="stat-card" type="button" onClick={openUpload}>
            <span className="stat-icon"><FileText size={19} /></span>
            <span className="stat-copy"><strong>1 Resume</strong><small>One-time upload</small></span>
            <ArrowRight className="stat-arrow" size={16} />
          </button>

          <button
            className="stat-card"
            type="button"
            onClick={() => document.querySelector(".search-dashboard")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <span className="stat-icon stat-icon-blue"><Search size={19} /></span>
            <span className="stat-copy"><strong>Multiple Sources</strong><small>Unified job discovery</small></span>
            <ArrowRight className="stat-arrow" size={16} />
          </button>

          <button
            className="stat-card"
            type="button"
            onClick={() => document.querySelector("#features .feature-card:nth-child(3)")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <span className="stat-icon stat-icon-green"><Target size={19} /></span>
            <span className="stat-copy"><strong>AI Matching</strong><small>Personalized results</small></span>
            <ArrowRight className="stat-arrow" size={16} />
          </button>

          <button
            className="stat-card"
            type="button"
            onClick={() => {
              const skillSection = document.querySelector(".skill-gap-section");
              const fallbackSection = document.querySelector("#features .feature-card:nth-child(4)");
              (skillSection || fallbackSection)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <span className="stat-icon stat-icon-amber"><TrendingUp size={19} /></span>
            <span className="stat-copy"><strong>Skill Insights</strong><small>Identify skill gaps</small></span>
            <ArrowRight className="stat-arrow" size={16} />
          </button>
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

        </>
      )}

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
