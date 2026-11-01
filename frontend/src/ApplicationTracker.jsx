
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ApplicationTracker.css";

const API_URL = "http://127.0.0.1:8000";

const STATUSES = [
  "Interested",
  "Applied",
  "Interview",
  "Offer",
  "Rejected"
];

export default function ApplicationTracker({ authToken, onClose }) {
  const [applications, setApplications] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    }),
    [authToken]
  );

  const loadApplications = useCallback(async () => {

    try {
      const [applicationsResponse, statisticsResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/applications`, { headers }),
          fetch(`${API_URL}/api/applications/statistics`, { headers }),
        ]);

      if (!applicationsResponse.ok || !statisticsResponse.ok) {
        throw new Error(
          "Could not load your applications. Please log in again."
        );
      }

      const applicationsData = await applicationsResponse.json();
      const statisticsData = await statisticsResponse.json();

      setError("");
      setApplications(applicationsData.applications || []);
      setStatistics(statisticsData.statistics || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    let isActive = true;

    const fetchInitialApplications = async () => {
      try {
        const [applicationsResponse, statisticsResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/applications`, { headers }),
            fetch(`${API_URL}/api/applications/statistics`, { headers }),
          ]);

        if (!applicationsResponse.ok || !statisticsResponse.ok) {
          throw new Error(
            "Could not load your applications. Please log in again."
          );
        }

        const applicationsData = await applicationsResponse.json();
        const statisticsData = await statisticsResponse.json();

        if (!isActive) return;

        setError("");
        setApplications(applicationsData.applications || []);
        setStatistics(statisticsData.statistics || {});
      } catch (err) {
        if (isActive) {
          setError(err.message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchInitialApplications();

    return () => {
      isActive = false;
    };
  }, [headers]);

  async function changeStatus(jobId, status) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/applications`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ job_id: jobId, status })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not update status.");
      }

      setMessage("Application status updated.");
      await loadApplications();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNotes(jobId, notes) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/applications`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ job_id: jobId, notes })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save notes.");
      }

      setMessage("Notes saved successfully.");
      await loadApplications();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeApplication(jobId) {
    if (!window.confirm("Remove this job from your application tracker?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/applications?job_id=${encodeURIComponent(jobId)}`,
        { method: "DELETE", headers }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not remove application.");
      }

      setMessage("Application removed.");
      await loadApplications();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="application-tracker">
      <div className="tracker-heading">
        <div>
          <p className="tracker-eyebrow">YOUR CAREER JOURNEY</p>
          <h2>Application Tracker</h2>
          <p>Keep track of the opportunities you're pursuing.</p>
        </div>

        {onClose && (
          <button className="tracker-close" onClick={onClose}>
            Back to jobs
          </button>
        )}
      </div>

      <div className="tracker-statistics">
        {["Total", ...STATUSES].map((status) => (
          <div className="tracker-stat" key={status}>
            <span>{status}</span>
            <strong>{statistics[status] ?? 0}</strong>
          </div>
        ))}
      </div>

      {message && <p className="tracker-message">{message}</p>}
      {error && <p className="tracker-error">{error}</p>}

      {loading ? (
        <p>Loading your applications...</p>
      ) : applications.length === 0 ? (
        <div className="tracker-empty">
          <h3>No tracked applications yet</h3>
          <p>Add jobs from your recommendations to start tracking them here.</p>
        </div>
      ) : (
        <div className="tracker-list">
          {applications.map((application) => {
            const job = application.job || {};

            return (
              <article
                className="tracker-card"
                key={application.job_id}
              >
                <div className="tracker-card-heading">
                  <div>
                    <h3>{job.title || "Untitled job"}</h3>
                    <p>{job.company || "Company not listed"}</p>
                    <small>{job.location || "Location not specified"}</small>
                  </div>

                  <button
                    className="tracker-delete"
                    onClick={() => removeApplication(application.job_id)}
                  >
                    Remove
                  </button>
                </div>

                <div className="tracker-controls">
                  <label>
                    Application status
                    <select
                      value={application.status}
                      onChange={(event) =>
                        changeStatus(application.job_id, event.target.value)
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Personal notes
                    <textarea
                      key={`${application.job_id}-${application.updated_at}`}
                      defaultValue={application.notes || ""}
                      placeholder="Add interview details, reminders, or other notes..."
                      rows={3}
                      id={`notes-${application.job_id}`}
                    />
                  </label>

                  <button
                    className="tracker-save"
                    onClick={() =>
                      saveNotes(
                        application.job_id,
                        document.getElementById(
                          `notes-${application.job_id}`
                        ).value
                      )
                    }
                  >
                    Save notes
                  </button>
                </div>

                {job.apply_url && (
                  <a
                    className="tracker-apply-link"
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View original job listing ↗
                  </a>
                )}

                <small className="tracker-updated">
                  Last updated:{" "}
                  {new Date(application.updated_at).toLocaleDateString()}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
