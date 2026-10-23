
const API_BASE_URL = 'http://localhost:5000/api'

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Attach the JWT to authenticated requests.
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      'Cannot connect to the Nexora server. Make sure the backend is running on port 5000.'
    )
  }

  // Handle empty or non-JSON responses safely.
  const responseText = await response.text()
  let data = {}

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { message: responseText }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    throw new Error(
      data.message || `Request failed (${response.status})`
    )
  }

  return data
}
