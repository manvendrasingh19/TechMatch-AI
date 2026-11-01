import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from './App'

const mockAuthenticatedUser = () => {
  localStorage.setItem('techmatch_token', 'test-jwt-token')

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url.includes('/api/auth/me')) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        }),
      }
    }

    if (url.includes('/api/profile')) {
      return {
        ok: true,
        json: async () => ({
          profile: {
            preferred_location: 'India',
            preferred_categories: [],
            preferred_job_type: 'Any',
            preferred_work_mode: 'Any',
          },
        }),
      }
    }

    if (url.includes('/api/resume/analyze')) {
        return {
            ok: true,
            json: async () => ({
            data: {
                extracted_text: 'Python developer with backend experience.',
                skills: ['Python'],
                filename: 'resume.pdf',
            },
            }),
        }
    }
    if (url.includes('/api/jobs/saved')) {
      return {
        ok: true,
        json: async () => ({
          saved_jobs: [],
        }),
      }
    }

    return {
      ok: true,
      json: async () => ({}),
    }
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TechMatch AI App', () => {
  it('renders the homepage', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /Find the right tech job/i })
    ).toBeInTheDocument()
  })

  it('displays the login form by default', () => {
    render(<App />)


    expect(
      screen.getByRole('heading', { name: 'Welcome to TechMatch AI' })
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('Email Address')
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('Password (minimum 8 characters)')
    ).toBeInTheDocument()
  })

  it('switches to the registration form', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(
      screen.getByRole('heading', { name: 'Create Your Account' })
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('Full Name')
    ).toBeInTheDocument()
  })

  it('switches back to the login form', async () => {
    const user = userEvent.setup()

    render(<App />)


    await user.click(screen.getByRole('button', { name: 'Register' }))
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(
      screen.getByRole('heading', { name: 'Welcome to TechMatch AI' })
    ).toBeInTheDocument()

    expect(
      screen.queryByPlaceholderText('Full Name')
    ).not.toBeInTheDocument()
  })
    it('rejects unsupported resume file formats', async () => {
      mockAuthenticatedUser()
    const { container } = render(<App />)
    await screen.findByText('Test User')

    const fileInput = container.querySelector('input[type="file"]')

    const invalidFile = new File(
      ['This is a text file'],
      'resume.txt',
      { type: 'text/plain' }
    )

    fireEvent.change(fileInput, {
      target: { files: [invalidFile] },
    })

    expect(
      screen.getByText('Please upload a PDF or DOCX resume.')
    ).toBeInTheDocument()
  })

  it('rejects resume files larger than 5 MB', async () => {
    mockAuthenticatedUser()
    const { container } = render(<App />)
    await screen.findByText('Test User')


    const fileInput = container.querySelector('input[type="file"]')

    const largeFile = new File(
      [new ArrayBuffer(5 * 1024 * 1024 + 1)],
      'large-resume.pdf',
      { type: 'application/pdf' }
    )

    fireEvent.change(fileInput, {
      target: { files: [largeFile] },
    })

    expect(
      screen.getByText('File size must be less than 5 MB.')
    ).toBeInTheDocument()
  })
    it('uploads a valid PDF resume successfully', async () => {
      mockAuthenticatedUser()

    const { container } = render(<App />)
    await screen.findByText('Test User')
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: {
            extracted_text: 'Python developer with React experience.',
            skills: ['Python', 'React'],
            filename: 'resume.pdf',
          },
        }),
      }
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse)

    const fileInput = container.querySelector('input[type="file"]')

    const pdfFile = new File(
      ['Sample PDF content'],
      'resume.pdf',
      { type: 'application/pdf' }
    )

    await act(async () => {
        fireEvent.change(fileInput, {
            target: { files: [pdfFile] },
        })
    })
    await screen.findByRole('heading', {
      name: 'Find Your Perfect Tech Job',
    })

    const resumeUploadCalls = fetchMock.mock.calls.filter(
      ([url]) => url.includes('/api/resume/analyze')
    )

    expect(resumeUploadCalls).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/resume/analyze',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    )
  })

  it('uploads a valid DOCX resume successfully', async () => {
    mockAuthenticatedUser()

    const { container } = render(<App />)
    await screen.findByText('Test User')
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: {
              extracted_text: 'Java developer with SQL experience.',
              skills: ['Java', 'SQL'],
              filename: 'resume.docx',
            },
          }),
      })

    const fileInput = container.querySelector('input[type="file"]')

    const docxFile = new File(
      ['Sample DOCX content'],
      'resume.docx',
      {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
    )

    await act(async () => {
        fireEvent.change(fileInput, {
            target: { files: [docxFile] },
        })
    })

    const resumeUploadCalls = fetchMock.mock.calls.filter(
      ([url]) => url.includes('/api/resume/analyze')
    )

    expect(resumeUploadCalls).toHaveLength(1)
  })

  it('displays an error when the backend rejects resume analysis', async () => {
    mockAuthenticatedUser()

    const { container } = render(<App />)
    await screen.findByText('Test User')
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (url.includes('/api/resume/analyze')) {
          return {
            ok: false,
            json: async () => ({
              detail: 'Resume analysis failed.',
            }),
          }
        }

        return {
          ok: true,
          json: async () => ({}),
        }
      })

    const fileInput = container.querySelector('input[type="file"]')

    const pdfFile = new File(
      ['Sample PDF content'],
      'resume.pdf',
      { type: 'application/pdf' }
    )

    fireEvent.change(fileInput, {
      target: { files: [pdfFile] },
    })

    expect(
      await screen.findByText('Resume analysis failed.')
    ).toBeInTheDocument()
  })
    it('renders profile preferences for an authenticated user', async () => {
    mockAuthenticatedUser()

    render(<App />)
    await screen.findByText('Test User')

    expect(
      await screen.findByRole('heading', {
        name: 'Your Job Preferences',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('India, Jabalpur, Remote...')
    ).toHaveValue('India')
  })

  it('selects a technology category', async () => {
    mockAuthenticatedUser()

    const user = userEvent.setup()

    render(<App />)
    await screen.findByText('Test User')


    const category = await screen.findByLabelText(
      'Software Development'
    )

    await user.click(category)

    expect(category).toBeChecked()
  })

  it('deselects an already selected technology category', async () => {
    mockAuthenticatedUser()

    const user = userEvent.setup()

    render(<App />)
    await screen.findByText('Test User')
    const category = await screen.findByLabelText(
      'Software Development'
    )

    await user.click(category)
    expect(category).toBeChecked()

    await user.click(category)
    expect(category).not.toBeChecked()
  })
    it('saves user preferences successfully', async () => {
    mockAuthenticatedUser()

    const fetchMock = globalThis.fetch

    fetchMock.mockImplementation(async (url, options = {}) => {
      if (url.includes('/api/profile') && options.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'Bangalore',
              preferred_categories: ['Software Development'],
              preferred_job_type: 'Full-time',
              preferred_work_mode: 'Remote',
            },
          }),
        }
      }

      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({ saved_jobs: [] }),
        }
      }
    })

    const user = userEvent.setup()

    render(<App />)
    await screen.findByText('Test User')

    const locationInput = await screen.findByPlaceholderText(
      'India, Jabalpur, Remote...'
    )

    await user.clear(locationInput)
    await user.type(locationInput, 'Bangalore')

    await user.click(
      screen.getByLabelText('Software Development')
    )

    const dropdowns = screen.getAllByRole('combobox')

    await user.selectOptions(dropdowns[0], 'Full-time')
    await user.selectOptions(dropdowns[1], 'Remote')

    await user.click(
      screen.getByRole('button', {
        name: 'Save My Preferences',
      })
    )

    expect(
      await screen.findByText(
        'Your profile was saved successfully.'
      )
    ).toBeInTheDocument()

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.includes('/api/profile') &&
        options?.method === 'PUT'
    )

    expect(saveCall).toBeDefined()

    const [, options] = saveCall

    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-jwt-token',
    })

    expect(JSON.parse(options.body)).toMatchObject({
      preferred_location: 'Bangalore',
      preferred_categories: ['Software Development'],
      preferred_job_type: 'Full-time',
      preferred_work_mode: 'Remote',
    })
  })
    it('displays an error when saving profile preferences fails', async () => {
    mockAuthenticatedUser()

    const fetchMock = globalThis.fetch

    fetchMock.mockImplementation(async (url, options = {}) => {
      if (url.includes('/api/profile') && options.method === 'PUT') {
        return {
          ok: false,
          json: async () => ({
            detail: 'Profile update failed.',
          }),
        }
      }

      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({ saved_jobs: [] }),
        }
      }
    })

    const user = userEvent.setup()

    render(<App />)


    await screen.findByRole('heading', {
      name: 'Your Job Preferences',
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Save My Preferences',
      })
    )

    expect(
      await screen.findByText('Profile update failed.')
    ).toBeInTheDocument()
  })
  it('displays job search dashboard after successful resume analysis', async () => {
  mockAuthenticatedUser()

  const fetchMock = globalThis.fetch

  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/api/auth/me')) {
      return {
        ok: true,
        json: async () => ({
          user: { id: 1, name: 'Test User' },
        }),
      }
    }

    if (url.includes('/api/profile')) {
      return {
        ok: true,
        json: async () => ({
          profile: {
            preferred_location: 'India',
            preferred_categories: [],
            preferred_job_type: 'Any',
            preferred_work_mode: 'Any',
          },
        }),
      }
    }

    if (url.includes('/api/jobs/saved')) {
      return {
        ok: true,
        json: async () => ({ saved_jobs: [] }),
      }
    }

    if (url.includes('/api/resume/analyze')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            extracted_text: 'Experienced software developer skilled in Python and React.',
            skills: ['Python', 'React'],
            filename: 'resume.pdf',
          },
        }),
      }
    }

    return {
      ok: true,
      json: async () => ({}),
    }
  });

  const { container } = render(<App />)
  await screen.findByText('Test User')

  const fileInput = container.querySelector('input[type="file"]')

  const pdfFile = new File(
    ['Sample PDF content'],
    'resume.pdf',
    { type: 'application/pdf' }
  )

  await act(async () => {
    fireEvent.change(fileInput, {
      target: { files: [pdfFile] },
    })
  })
  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  expect(
    await screen.findByRole('heading', {
      name: 'Find Your Perfect Tech Job',
    })
  ).toBeInTheDocument()

  expect(
    screen.getByPlaceholderText('e.g. Python Developer')
  ).toBeInTheDocument()

  expect(
    screen.getByRole('button', {
      name: 'Search & Match Jobs',
    })
  ).toBeInTheDocument()
})
it('prevents job search when no job source is selected', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url.includes('/api/auth/me')) {
      return {
        ok: true,
        json: async () => ({
          user: { id: 1, name: 'Test User' },
        }),
      }
    }

    if (url.includes('/api/profile')) {
      return {
        ok: true,
        json: async () => ({
          profile: {
            preferred_location: 'India',
            preferred_categories: [],
            preferred_job_type: 'Any',
            preferred_work_mode: 'Any',
          },
        }),
      }
    }

    if (url.includes('/api/jobs/saved')) {
      return {
        ok: true,
        json: async () => ({ saved_jobs: [] }),
      }
    }

    if (url.includes('/api/resume/analyze')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            extracted_text: 'Software developer skilled in Python.',
            skills: ['Python'],
            filename: 'resume.pdf',
          },
        }),
      }
    }

    return {
      ok: true,
      json: async () => ({}),
    }
  })

  render(<App />)
  await screen.findByText('Test User')

  const fileInput = document.querySelector('input[type="file"]')

  await act(async () => {
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    })
  })

  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  const remotiveCheckbox = screen.getByRole('checkbox', {
    name: /remotive/i,
  })

  const adzunaCheckbox = screen.getByRole('checkbox', {
    name: /adzuna/i,
  })

  expect(remotiveCheckbox).toBeChecked()
  expect(adzunaCheckbox).toBeChecked()

  await user.click(remotiveCheckbox)
  await user.click(adzunaCheckbox)

  expect(remotiveCheckbox).not.toBeChecked()
  expect(adzunaCheckbox).not.toBeChecked()

  await user.click(
    screen.getByRole('button', { name: /search & match jobs/i })
  )

  expect(
    screen.getByText(/select at least one job source/i)
  ).toBeInTheDocument()
})
it('sends the correct filters and authorization token when searching for jobs', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const mockRecommendations = []

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, _options = {}) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({ saved_jobs: [] }),
        }
      }

      if (url.includes('/api/resume/analyze')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              extracted_text:
                'Experienced software developer skilled in Python and React.',
              skills: ['Python', 'React'],
              filename: 'resume.pdf',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/search')) {
        return {
          ok: true,
          json: async () => ({
            total_jobs_after_filters: 0,
            recommendations: mockRecommendations,
            source_warnings: [],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)
  await screen.findByText('Test User')

  // Upload a resume
  const fileInput = document.querySelector('input[type="file"]')

  await act(async () => {
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    })
  })

  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  // Change job keyword and location
  await user.clear(
    screen.getByPlaceholderText('e.g. Python Developer')
  )
  await user.type(
    screen.getByPlaceholderText('e.g. Python Developer'),
    'Python Developer'
  )

  await user.clear(
    screen.getByPlaceholderText('e.g. India or Remote')
  )
  await user.type(
    screen.getByPlaceholderText('e.g. India or Remote'),
    'Remote'
  )


    // Select advanced job filters.
    const advancedFilters = document.querySelectorAll(
    '.advanced-filters select'
    )

    await user.selectOptions(advancedFilters[0], 'Internship')
    await user.selectOptions(advancedFilters[1], 'Fresher')
    await user.selectOptions(advancedFilters[2], 'Remote')

    // Set minimum annual salary.
    await user.type(
    screen.getByPlaceholderText('e.g. 300000'),
    '300000'
    )

    // Select required skills.
    await user.click(
    screen.getByRole('checkbox', { name: 'Python' })
    )

    await user.click(
    screen.getByRole('checkbox', { name: 'React' })
    )


  // Search for jobs
  await user.click(
    screen.getByRole('button', { name: /search & match jobs/i })
  )

  // Verify the API request
  const searchCall = fetchMock.mock.calls.find(([url]) =>
    url.includes('/api/jobs/search')
  )

  expect(searchCall).toBeDefined()

  const [requestUrl, requestOptions] = searchCall

  expect(requestUrl).toBe(
    'http://127.0.0.1:8000/api/jobs/search'
  )

  expect(requestOptions.method).toBe('POST')

  expect(requestOptions.headers).toEqual({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-jwt-token',
  })

  expect(JSON.parse(requestOptions.body)).toEqual({
  resume_text:
    'Experienced software developer skilled in Python and React.',
  keyword: 'Python Developer',
  location: 'Remote',
  sources: ['Remotive', 'Adzuna'],
  limit: 10,
  include_demo: false,
  job_type: 'Internship',
  experience_level: 'Fresher',
  work_mode: 'Remote',
  min_salary: 300000,
  required_skills: ['Python', 'React'],
})

  // Verify successful search with no matching jobs
  expect(
    await screen.findByText(
      /no matching jobs found in the current dataset/i
    )
  ).toBeInTheDocument()
})
it('displays job recommendation cards with correct details', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const mockJobs = [
    {
      id: 101,
      title: 'Python Developer',
      company: 'Tech Solutions',
      description: 'Develop backend applications using Python.',
      match_score: 92,
      skill_match: 90,
      semantic_similarity: 94,
      matched_skills: ['Python', 'SQL'],
      missing_skills: ['Docker'],
      apply_url: 'https://example.com/apply/python',
      source: 'Remotive',
    },
    {
      id: 102,
      title: 'React Developer',
      company: 'Web Innovations',
      description: 'Build modern web applications using React.',
      match_score: 85,
      skill_match: 82,
      semantic_similarity: 88,
      matched_skills: ['React', 'JavaScript'],
      missing_skills: [],
      apply_url: 'https://example.com/apply/react',
      source: 'Adzuna',
    },
  ]

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({ saved_jobs: [] }),
        }
      }

      if (url.includes('/api/resume/analyze')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              extracted_text: 'Python and React developer.',
              skills: ['Python', 'React'],
              filename: 'resume.pdf',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/search')) {
        return {
          ok: true,
          json: async () => ({
            total_jobs_after_filters: 2,
            recommendations: mockJobs,
            source_warnings: [],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)
  await screen.findByText('Test User')

  // Upload resume
  const fileInput = document.querySelector('input[type="file"]')

  await act(async () => {
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    })
  })

  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  // Search for jobs
  await user.click(
    screen.getByRole('button', { name: /search & match jobs/i })
  )

  // Verify job titles and companies
  expect(
    await screen.findByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  expect(
    screen.getByRole('heading', { name: 'React Developer' })
  ).toBeInTheDocument()

  expect(screen.getByText('Tech Solutions')).toBeInTheDocument()
  expect(screen.getByText('Web Innovations')).toBeInTheDocument()

  // Verify match scores
  expect(screen.getByText('92% Match')).toBeInTheDocument()
  expect(screen.getByText('85% Match')).toBeInTheDocument()

  // Verify descriptions
  expect(
    screen.getByText('Develop backend applications using Python.')
  ).toBeInTheDocument()

  // Verify skill matches and missing skills
  expect(
    screen.getAllByText('Python', { selector: '.matched-skill' })
    ).toHaveLength(2)

  expect(screen.getByText('Docker', { selector: '.missing-skill' }))
    .toBeInTheDocument()

  expect(screen.getByText('No missing listed skills'))
    .toBeInTheDocument()

  // Verify application links
  const applicationLinks = screen.getAllByRole('link', {
    name: /view application/i,
    })

    expect(applicationLinks).toHaveLength(2)

    expect(applicationLinks[0]).toHaveAttribute(
    'href',
    'https://example.com/apply/python'
    )

    expect(applicationLinks[1]).toHaveAttribute(
    'href',
    'https://example.com/apply/react'
    )

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/jobs/search',
    expect.objectContaining({
      method: 'POST',
    })
  )

  // Verify save buttons
  expect(screen.getAllByRole('button', { name: /save job/i }))
    .toHaveLength(2)
})
it('saves a job successfully with the correct API request', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const mockJob = {
    id: 101,
    title: 'Python Developer',
    company: 'Tech Solutions',
    description: 'Develop backend applications using Python.',
    match_score: 92,
    skill_match: 90,
    semantic_similarity: 94,
    matched_skills: ['Python', 'SQL'],
    missing_skills: ['Docker'],
    apply_url: 'https://example.com/apply/python',
    source: 'Remotive',
  }

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, options = {}) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved') && options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            message: 'Job saved successfully.',
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({
            saved_jobs: [mockJob],
          }),
        }
      }

      if (url.includes('/api/resume/analyze')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              extracted_text: 'Python developer with backend experience.',
              skills: ['Python'],
              filename: 'resume.pdf',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/search')) {
        return {
          ok: true,
          json: async () => ({
            total_jobs_after_filters: 1,
            recommendations: [mockJob],
            source_warnings: [],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)
  await screen.findByText('Test User')

  // Upload resume
  const fileInput = document.querySelector('input[type="file"]')

  await act(async () => {
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    })
  })

  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  // Search for jobs
  await user.click(
    screen.getByRole('button', { name: /search & match jobs/i })
  )

  // Wait for recommendation
  expect(
    await screen.findByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  // Save the recommendation
  await user.click(
    screen.getByRole('button', { name: /save job/i })
  )

  // Verify POST request
  const saveCall = fetchMock.mock.calls.find(
    ([url, options]) =>
      url.includes('/api/jobs/saved') && options?.method === 'POST'
  )

  expect(saveCall).toBeDefined()

  const [requestUrl, requestOptions] = saveCall

  expect(requestUrl).toBe('http://127.0.0.1:8000/api/jobs/saved')

  expect(requestOptions.headers).toEqual({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-jwt-token',
  })

  expect(JSON.parse(requestOptions.body)).toEqual({
    job: mockJob,
  })

  // Verify that saved jobs are reloaded after saving
  await act(async () => {
    await Promise.resolve()
  })

  const savedJobsCalls = fetchMock.mock.calls.filter(
    ([url, options]) =>
      url.includes('/api/jobs/saved') && options?.method !== 'POST'
  )

  expect(savedJobsCalls.length).toBeGreaterThanOrEqual(2)
})
it('displays an error when saving a job fails', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const mockJob = {
    id: 101,
    title: 'Python Developer',
    company: 'Tech Solutions',
    description: 'Develop backend applications using Python.',
    match_score: 92,
    skill_match: 90,
    semantic_similarity: 94,
    matched_skills: ['Python', 'SQL'],
    missing_skills: ['Docker'],
    apply_url: 'https://example.com/apply/python',
    source: 'Remotive',
  }

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, options = {}) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved') && options.method === 'POST') {
        return {
          ok: false,
          json: async () => ({
            detail: 'Unable to save this job.',
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({ saved_jobs: [] }),
        }
      }

      if (url.includes('/api/resume/analyze')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              extracted_text: 'Python developer with backend experience.',
              skills: ['Python'],
              filename: 'resume.pdf',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/search')) {
        return {
          ok: true,
          json: async () => ({
            total_jobs_after_filters: 1,
            recommendations: [mockJob],
            source_warnings: [],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)
  await screen.findByText('Test User')

  const fileInput = document.querySelector('input[type="file"]')

  await act(async () => {
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    })
  })

  await screen.findByRole('heading', {
    name: 'Find Your Perfect Tech Job',
  })

  await user.click(
    screen.getByRole('button', { name: /search & match jobs/i })
  )

  expect(
    await screen.findByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: /save job/i })
  )

  expect(
    await screen.findByRole('alert')
  ).toHaveTextContent('Unable to save this job.')

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/jobs/saved',
    expect.objectContaining({
      method: 'POST',
    })
  )
})
it('removes a saved job successfully', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const savedJob = {
    id: 201,
    job: {
      id: 101,
      title: 'Python Developer',
      company: 'Tech Solutions',
      source: 'Remotive',
      apply_url: 'https://example.com/apply/python',
    },
  }

  let savedJobs = [savedJob]

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, options = {}) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved') && options.method === 'DELETE') {
        savedJobs = []

        return {
          ok: true,
          json: async () => ({
            message: 'Job removed successfully.',
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({
            saved_jobs: savedJobs,
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )


  render(<App />)
  await screen.findByText('Test User')

  const fileInput = document.querySelector('input[type="file"]')

    await act(async () => {
    fireEvent.change(fileInput, {
        target: {
        files: [
            new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
            }),
        ],
        },
    })
    })
  // Open the saved jobs section
  await user.click(
    screen.getByRole('button', { name: /view saved jobs/i })
  )

  // Verify saved job appears
  expect(
    await screen.findByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  expect(screen.getByText('Tech Solutions')).toBeInTheDocument()

  // Remove the saved job
  await user.click(
    screen.getByRole('button', { name: /remove/i })
  )

  // Verify successful deletion and refreshed list
  expect(
    await screen.findByText("You haven't saved any jobs yet.")
  ).toBeInTheDocument()

  // Verify DELETE API request
  const deleteCall = fetchMock.mock.calls.find(
    ([, options]) => options?.method === 'DELETE'
  )

  expect(deleteCall).toBeDefined()

  expect(deleteCall[0]).toBe(
    'http://127.0.0.1:8000/api/jobs/saved/201'
  )

  expect(deleteCall[1].headers).toEqual({
    Authorization: 'Bearer test-jwt-token',
  })
})
it('displays an error when removing a saved job fails', async () => {
  const user = userEvent.setup()

  localStorage.setItem('techmatch_token', 'test-jwt-token')

  const savedJob = {
    id: 201,
    job: {
      id: 101,
      title: 'Python Developer',
      company: 'Tech Solutions',
      source: 'Remotive',
      apply_url: 'https://example.com/apply/python',
    },
  }

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, options = {}) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: { id: 1, name: 'Test User' },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      if (url.includes('/api/resume/analyze')) {
        return {
            ok: true,
            json: async () => ({
            data: {
                extracted_text: 'Python developer with backend experience.',
                skills: ['Python'],
                filename: 'resume.pdf',
            },
            }),
        }
        }
      if (url.includes('/api/jobs/saved') && options.method === 'DELETE') {
        return {
          ok: false,
          json: async () => ({
            detail: 'Unable to remove this saved job.',
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({
            saved_jobs: [savedJob],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)
  await screen.findByText('Test User')
    const fileInput = document.querySelector('input[type="file"]')

    await act(async () => {
    fireEvent.change(fileInput, {
        target: {
        files: [
            new File(['resume content'], 'resume.pdf', {
            type: 'application/pdf',
            }),
        ],
        },
    })
    })

  // Open saved jobs
  await user.click(
    screen.getByRole('button', { name: /view saved jobs/i })
  )

  // Verify saved job is displayed
  expect(
    await screen.findByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  // Attempt to remove the job
  await user.click(
    screen.getByRole('button', { name: /remove/i })
  )

  // Verify error message
  expect(
    await screen.findByRole('alert')
  ).toHaveTextContent('Unable to remove this saved job.')

  // Verify job remains in the list
  expect(
    screen.getByRole('heading', { name: 'Python Developer' })
  ).toBeInTheDocument()

  // Verify DELETE request
  const deleteCall = fetchMock.mock.calls.find(
    ([, options]) => options?.method === 'DELETE'
  )

  expect(deleteCall).toBeDefined()

  expect(deleteCall[0]).toBe(
    'http://127.0.0.1:8000/api/jobs/saved/201'
  )

  expect(deleteCall[1].headers).toEqual({
    Authorization: 'Bearer test-jwt-token',
  })
})

it('registers a new user successfully', async () => {
  const user = userEvent.setup()

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, _options = {}) => {
      if (url.includes('/api/auth/register')) {
        return {
          ok: true,
          json: async () => ({
            message: 'User registered successfully.',
          }),
        }
      }

      if (url.includes('/api/auth/login')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'new-test-token',
            user: {
              id: 2,
              name: 'New User',
              email: 'newuser@example.com',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({
            saved_jobs: [],
          }),
        }
      }

      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: {
              id: 2,
              name: 'New User',
              email: 'newuser@example.com',
            },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)

  await user.click(screen.getByRole('button', { name: /^register$/i }))

  await user.type(screen.getByPlaceholderText('Full Name'), 'New User')
  await user.type(screen.getByPlaceholderText('Email Address'), 'newuser@example.com')
  await user.type(
    screen.getByPlaceholderText('Password (minimum 8 characters)'),
    'password123'
  )

  await user.click(screen.getByRole('button', { name: /create account/i }))

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/register',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })
  )

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
    })
  )

  expect(localStorage.getItem('techmatch_token')).toBe('new-test-token')
})

it('displays an error when user registration fails', async () => {
  const user = userEvent.setup()

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url) => {
      if (url.includes('/api/auth/register')) {
        return {
          ok: false,
          json: async () => ({
            detail: 'Email already registered.',
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)

  // Switch to registration mode.
  await user.click(screen.getByRole('button', { name: /^register$/i }))

  // Enter registration details.
  await user.type(screen.getByPlaceholderText('Full Name'), 'New User')
  await user.type(
    screen.getByPlaceholderText('Email Address'),
    'existing@example.com'
  )
  await user.type(
    screen.getByPlaceholderText('Password (minimum 8 characters)'),
    'password123'
  )

  // Submit registration.
  await user.click(screen.getByRole('button', { name: /create account/i }))

  // Verify the backend error is displayed.
  expect(
    await screen.findByText('Email already registered.')
  ).toBeInTheDocument()

  // Verify registration was attempted but login was not.
  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/register',
    expect.objectContaining({
      method: 'POST',
    })
  )

  expect(fetchMock).not.toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/login',
    expect.anything()
  )
})

it('logs in an existing user successfully', async () => {
  const user = userEvent.setup()

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url) => {
      if (url.includes('/api/auth/login')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'login-test-token',
            user: {
              id: 1,
              name: 'Existing User',
              email: 'existing@example.com',
            },
          }),
        }
      }

      if (url.includes('/api/jobs/saved')) {
        return {
          ok: true,
          json: async () => ({
            saved_jobs: [],
          }),
        }
      }

      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            user: {
              id: 1,
              name: 'Existing User',
              email: 'existing@example.com',
            },
          }),
        }
      }

      if (url.includes('/api/profile')) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              preferred_location: 'India',
              preferred_categories: [],
              preferred_job_type: 'Any',
              preferred_work_mode: 'Any',
            },
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)

  await user.type(
    screen.getByPlaceholderText('Email Address'),
    'existing@example.com'
  )

  await user.type(
    screen.getByPlaceholderText('Password (minimum 8 characters)'),
    'password123'
  )

  // There are two Login buttons: the tab and the form submit button.
  const loginButtons = screen.getAllByRole('button', { name: /^login$/i })
  await user.click(loginButtons[1])

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'password123',
      }),
    })
  )

  expect(localStorage.getItem('techmatch_token')).toBe('login-test-token')

  expect(
    await screen.findByText('Your Job Preferences')
  ).toBeInTheDocument()
})

it('displays an error when login fails', async () => {
  const user = userEvent.setup()

  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (url) => {
      if (url.includes('/api/auth/login')) {
        return {
          ok: false,
          json: async () => ({
            detail: 'Invalid email or password.',
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({}),
      }
    }
  )

  render(<App />)

  await user.type(
    screen.getByPlaceholderText('Email Address'),
    'wrong@example.com'
  )

  await user.type(
    screen.getByPlaceholderText('Password (minimum 8 characters)'),
    'wrongpassword'
  )

  const loginButtons = screen.getAllByRole('button', { name: /^login$/i })
  await user.click(loginButtons[1])

  expect(
    await screen.findByText('Invalid email or password.')
  ).toBeInTheDocument()

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
    })
  )

  expect(localStorage.getItem('techmatch_token')).toBeNull()
})

})
