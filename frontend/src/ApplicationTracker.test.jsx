
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationTracker from "./ApplicationTracker";

const API_URL = "http://127.0.0.1:8000";

const mockApplications = [
  {
    job_id: "job-101",
    status: "Applied",
    notes: "Prepare for technical interview.",
    updated_at: "2026-10-30T10:00:00",
    job: {
      id: "job-101",
      title: "Python Developer",
      company: "Tech Solutions",
      location: "Remote",
      apply_url: "https://example.com/apply",
    },
  },
];

const mockStatistics = {
  Total: 1,
  Interested: 0,
  Applied: 1,
  Interview: 0,
  Offer: 0,
  Rejected: 0,
};

function jsonResponse(data, ok = true) {
  return {
    ok,
    json: async () => data,
  };
}

function setupFetch({
  applications = mockApplications,
  statistics = mockStatistics,
  applicationsOk = true,
  statisticsOk = true,
  updateOk = true,
  deleteOk = true,
} = {}) {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (url, options = {}) => {
      if (
        url === `${API_URL}/api/applications` &&
        (!options.method || options.method === "GET")
      ) {
        return jsonResponse({ applications }, applicationsOk);
      }

      if (url === `${API_URL}/api/applications/statistics`) {
        return jsonResponse({ statistics }, statisticsOk);
      }

      if (
        url === `${API_URL}/api/applications` &&
        options.method === "PUT"
      ) {
        return jsonResponse(
          updateOk
            ? { success: true }
            : { detail: "Application update failed." },
          updateOk
        );
      }

      if (
        url.startsWith(`${API_URL}/api/applications?job_id=`) &&
        options.method === "DELETE"
      ) {
        return jsonResponse(
          deleteOk
            ? { success: true }
            : { detail: "Application deletion failed." },
          deleteOk
        );
      }

      return jsonResponse({});
    }
  );

  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApplicationTracker", () => {
  it("displays the loading state while applications are being fetched", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {})
    );

    render(<ApplicationTracker authToken="test-token" />);

    expect(
      screen.getByText("Loading your applications...")
    ).toBeInTheDocument();
  });

  it("displays the empty state when no applications exist", async () => {
    setupFetch({
      applications: [],
      statistics: {
        Total: 0,
        Interested: 0,
        Applied: 0,
        Interview: 0,
        Offer: 0,
        Rejected: 0,
      },
    });

    render(<ApplicationTracker authToken="test-token" />);

    expect(
      await screen.findByText("No tracked applications yet")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Add jobs from your recommendations to start tracking them here."
      )
    ).toBeInTheDocument();

    expect(screen.getAllByText("0")).toHaveLength(6);
  });

  it("loads and displays application cards and statistics", async () => {
    const fetchMock = setupFetch();

    render(<ApplicationTracker authToken="test-token" />);

    expect(
      await screen.findByRole("heading", {
        name: "Python Developer",
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Tech Solutions")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();

    expect(screen.getByText("Prepare for technical interview."))
      .toBeInTheDocument();

    expect(screen.getByRole("link", { name: /view original job listing/i }))
      .toHaveAttribute("href", "https://example.com/apply");

    expect(
    screen.getByRole("combobox", { name: "Application status" })
    ).toHaveValue("Applied");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/applications`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("uses fallback values when job details are missing", async () => {
    setupFetch({
      applications: [
        {
          job_id: "job-102",
          status: "Interested",
          notes: "",
          updated_at: "2026-10-30T10:00:00",
          job: {},
        },
      ],
    });

    render(<ApplicationTracker authToken="test-token" />);

    expect(
      await screen.findByRole("heading", { name: "Untitled job" })
    ).toBeInTheDocument();

    expect(screen.getByText("Company not listed")).toBeInTheDocument();
    expect(screen.getByText("Location not specified")).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /view original job listing/i })
    ).not.toBeInTheDocument();
  });

  it("displays an error when the initial applications request fails", async () => {
    setupFetch({ applicationsOk: false });

    render(<ApplicationTracker authToken="test-token" />);

    expect(
      await screen.findByText(
        "Could not load your applications. Please log in again."
      )
    ).toBeInTheDocument();
  });

  it("calls onClose when the Back to jobs button is clicked", async () => {
    setupFetch();

    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ApplicationTracker
        authToken="test-token"
        onClose={onClose}
      />
    );

    await user.click(
      await screen.findByRole("button", { name: "Back to jobs" })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates an application's status successfully", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    const statusSelect = await screen.findByLabelText(
      "Application status"
    );

    await user.selectOptions(statusSelect, "Interview");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_URL}/api/applications`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            job_id: "job-101",
            status: "Interview",
          }),
        })
      );
    });

    expect(
      await screen.findByText("Application status updated.")
    ).toBeInTheDocument();
  });

  it("displays an error when updating an application fails", async () => {
    setupFetch({ updateOk: false });

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.selectOptions(
      await screen.findByLabelText("Application status"),
      "Interview"
    );

    expect(
      await screen.findByText("Application update failed.")
    ).toBeInTheDocument();
  });

  it("saves personal notes successfully", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    const notesInput = await screen.findByPlaceholderText(
      "Add interview details, reminders, or other notes..."
    );

    await user.clear(notesInput);
    await user.type(notesInput, "Interview scheduled for Monday.");

    await user.click(
      screen.getByRole("button", { name: "Save notes" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_URL}/api/applications`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            job_id: "job-101",
            notes: "Interview scheduled for Monday.",
          }),
        })
      );
    });

    expect(
      await screen.findByText("Notes saved successfully.")
    ).toBeInTheDocument();
  });

  it("displays an error when saving notes fails", async () => {
    setupFetch({ updateOk: false });

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await screen.findByRole("heading", {
      name: "Python Developer",
    });

    await user.click(
      screen.getByRole("button", { name: "Save notes" })
    );

    expect(
      await screen.findByText("Application update failed.")
    ).toBeInTheDocument();
  });

  it("does not delete an application when deletion is cancelled", async () => {
    const fetchMock = setupFetch();
    window.confirm.mockReturnValue(false);

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.click(
      await screen.findByRole("button", { name: "Remove" })
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Remove this job from your application tracker?"
    );

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("job_id="),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("removes an application successfully after confirmation", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.click(
      await screen.findByRole("button", { name: "Remove" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_URL}/api/applications?job_id=job-101`,
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    expect(
      await screen.findByText("Application removed.")
    ).toBeInTheDocument();
  });

  it("displays an error when removing an application fails", async () => {
    setupFetch({ deleteOk: false });

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.click(
      await screen.findByRole("button", { name: "Remove" })
    );

    expect(
      await screen.findByText("Application deletion failed.")
    ).toBeInTheDocument();
  });
  
  it("displays an error when reloading applications fails after a status update", async () => {
    let applicationRequestCount = 0;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url, options = {}) => {
        if (
          url === `${API_URL}/api/applications` &&
          (!options.method || options.method === "GET")
        ) {
          applicationRequestCount++;

          if (applicationRequestCount === 1) {
            return jsonResponse({ applications: mockApplications });
          }

          return jsonResponse(
            { detail: "Could not reload applications." },
            false
          );
        }

        if (url === `${API_URL}/api/applications/statistics`) {
          return jsonResponse({ statistics: mockStatistics });
        }

        if (
          url === `${API_URL}/api/applications` &&
          options.method === "PUT"
        ) {
          return jsonResponse({ success: true });
        }

        return jsonResponse({});
      }
    );

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.selectOptions(
      await screen.findByLabelText("Application status"),
      "Interview"
    );

    expect(
      await screen.findByText(
        "Could not load your applications. Please log in again."
      )
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalled();
  });

  it("handles a network error when reloading applications after an update", async () => {
    let applicationRequestCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url, options = {}) => {
        if (
          url === `${API_URL}/api/applications` &&
          (!options.method || options.method === "GET")
        ) {
          applicationRequestCount++;

          if (applicationRequestCount === 1) {
            return jsonResponse({ applications: mockApplications });
          }

          throw new Error("Network unavailable.");
        }

        if (url === `${API_URL}/api/applications/statistics`) {
          return jsonResponse({ statistics: mockStatistics });
        }

        if (
          url === `${API_URL}/api/applications` &&
          options.method === "PUT"
        ) {
          return jsonResponse({ success: true });
        }

        return jsonResponse({});
      }
    );

    const user = userEvent.setup();

    render(<ApplicationTracker authToken="test-token" />);

    await user.selectOptions(
      await screen.findByLabelText("Application status"),
      "Interview"
    );

    expect(
      await screen.findByText("Network unavailable.")
    ).toBeInTheDocument();
  });

});
