
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import { apiRequest } from '../services/api.js'
import '../styles/ProjectDetails.css'

export default function ProjectDetails() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadProject() {
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest(`/projects/${id}`)
      const item = data.project || data
      setProject(item)
      setForm({
        name: item.name || '',
        description: item.description || '',
      })
    } catch (err) {
      setError(err.message || 'Could not load project.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      const data = await apiRequest(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })

      const updated = data.project || { ...project, ...form }
      setProject(updated)
      setForm({
        name: updated.name || '',
        description: updated.description || '',
      })
      setMessage('Project updated successfully.')
    } catch (err) {
      setError(err.message || 'Could not update project.')
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="page">
        <p><Link to="/projects">← All projects</Link></p>
        <h1>Project Details</h1>

        {loading && <p>Loading project...</p>}
        {error && <p role="alert">{error}</p>}
        {message && <p>{message}</p>}

        {!loading && project && (
          <>
            <p>Project ID: {project.id}</p>
            <p>Status: {project.status}</p>

            <form onSubmit={handleSubmit}>
              <label>
                Project name
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>

              <button type="submit">Save changes</button>
            </form>

            <p><Link to={`/projects/${id}/tasks`}>View project tasks</Link></p>
            <p><Link to={`/projects/${id}/team`}>Manage project team</Link></p>
          </>
        )}
      </main>
    </div>
  )
}
