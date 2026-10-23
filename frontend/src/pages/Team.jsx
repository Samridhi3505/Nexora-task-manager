
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../services/api.js';
import '../styles/Team.css';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function normalizeRole(role = '') {
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function getMemberId(member) {
  return member.user_id ?? member.id;
}

export default function Team() {
  const { id: projectId } = useParams();
  const user = getStoredUser();
  const role = normalizeRole(user?.role);

  const isAdmin = role === 'admin';
  const isManager = ['project_manager', 'projectmanager'].includes(role);
  const isMember = ['team_member', 'teammember'].includes(role);
  const isViewer = role === 'viewer';

  const canManageTeam = isManager;
  const canViewWorkspaceUsers = isAdmin;

  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [form, setForm] = useState({
    user_id: '',
    project_role: 'Team Member',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pageInfo = {
    admin: {
      eyebrow: 'ADMIN WORKSPACE',
      title: 'Project Team',
      subtitle: 'Review project membership and workspace users.',
    },
    project_manager: {
      eyebrow: 'MANAGEMENT WORKSPACE',
      title: 'Manage Project Team',
      subtitle: 'Coordinate the members of your project.',
    },
    projectmanager: {
      eyebrow: 'MANAGEMENT WORKSPACE',
      title: 'Manage Project Team',
      subtitle: 'Coordinate the members of your project.',
    },
    team_member: {
      eyebrow: 'TEAM WORKSPACE',
      title: 'My Teammates',
      subtitle: 'See the people collaborating on this project.',
    },
    teammember: {
      eyebrow: 'TEAM WORKSPACE',
      title: 'My Teammates',
      subtitle: 'See the people collaborating on this project.',
    },
    viewer: {
      eyebrow: 'READ-ONLY WORKSPACE',
      title: 'Team Directory',
      subtitle: 'View the team associated with this project.',
    },
  };

  const page = pageInfo[role] || {
    eyebrow: 'WORKSPACE',
    title: 'Project Team',
    subtitle: 'View project team information.',
  };

  const loadTeam = useCallback(async () => {
    if (!localStorage.getItem('token') || !user?.id) {
      setMembers([]);
      setUsers([]);
      setError('Please log in to view team information.');
      setLoading(false);
      return;
    }

    if (!projectId) {
      setMembers([]);
      setUsers([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const memberData = await apiRequest(
        `/projects/${encodeURIComponent(projectId)}/members`
      );

      setMembers(getList(memberData, 'members'));

      if (canViewWorkspaceUsers || canManageTeam) {
        try {
          const userData = await apiRequest('/users');
          setUsers(getList(userData, 'users'));
        } catch {
          // Member viewing can still work if the users list is unavailable.
          setUsers([]);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      setMembers([]);
      setUsers([]);
      setError(err.message || 'Could not load project team members.');
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    user?.id,
    canViewWorkspaceUsers,
    canManageTeam,
  ]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const existingMemberIds = useMemo(
    () => new Set(members.map((member) => String(getMemberId(member)))),
    [members]
  );

  const availableUsers = useMemo(
    () =>
      users.filter((candidate) => {
        const active = candidate.is_active !== false;
        const notAlreadyAdded = !existingMemberIds.has(
          String(candidate.id)
        );
        const notCurrentUser =
          String(candidate.id) !== String(user?.id);

        return active && notAlreadyAdded && notCurrentUser;
      }),
    [users, existingMemberIds, user?.id]
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const text = `${member.name || ''} ${member.email || ''}`
          .toLowerCase();

        const matchesSearch = text.includes(search.trim().toLowerCase());
        const memberRole = normalizeRole(
          member.project_role || member.role || 'team_member'
        );

        const matchesRole =
          roleFilter === 'all' || memberRole === roleFilter;

        return matchesSearch && matchesRole;
      }),
    [members, search, roleFilter]
  );

  const projectManagersCount = members.filter((member) =>
    ['project_manager', 'projectmanager'].includes(
      normalizeRole(member.project_role || member.role)
    )
  ).length;

  const teamMembersCount = members.filter((member) =>
    ['team_member', 'teammember'].includes(
      normalizeRole(member.project_role || member.role)
    )
  ).length;

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function addMember(event) {
    event.preventDefault();

    if (!projectId) {
      setError('Open a specific project before adding a team member.');
      return;
    }

    if (!canManageTeam) {
      setError('You do not have permission to manage this team.');
      return;
    }

    if (!form.user_id) {
      setError('Please select a user.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await apiRequest(
        `/projects/${encodeURIComponent(projectId)}/members`,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: Number(form.user_id),
            project_role: form.project_role,
          }),
        }
      );

      setForm({
        user_id: '',
        project_role: 'Team Member',
      });

      setNotice('Team member added successfully.');
      await loadTeam();
    } catch (err) {
      setError(err.message || 'Could not add team member.');
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member) {
    if (!projectId || !canManageTeam) {
      setError('You do not have permission to remove team members.');
      return;
    }

    const memberId = getMemberId(member);

    if (memberId == null) {
      setError('Could not identify this team member.');
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.name || 'this member'} from the project?`
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await apiRequest(
        `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' }
      );

      setNotice('Team member removed successfully.');
      await loadTeam();
    } catch (err) {
      setError(err.message || 'Could not remove team member.');
    }
  }

  if (!user || !localStorage.getItem('token')) {
    return (
      <main className="team-page">
        <section className="team-panel">
          <h1>Please log in</h1>
          <p>You need to log in to view team information.</p>
          <Link to="/login">Go to login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="team-page">
      <header className="team-header">
        <div>
          <p className="team-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="team-subtitle">{page.subtitle}</p>
        </div>

        {projectId && (
          <Link
            className="team-back-link"
            to={`/projects/${projectId}`}
          >
            ← Back to project
          </Link>
        )}
      </header>

      {error && (
        <div className="team-error" role="alert">
          <span>{error}</span>
          {projectId && (
            <button type="button" onClick={loadTeam}>
              Try again
            </button>
          )}
        </div>
      )}

      {notice && (
        <p className="team-notice" role="status">
          {notice}
        </p>
      )}

      {!projectId ? (
        <section className="team-panel">
          <h2>Select a project</h2>
          <p>
            Team members are associated with individual projects.
            Open a project to view and manage its team.
          </p>
          <Link to="/projects">Browse projects →</Link>
        </section>
      ) : (
        <>
          <section className="team-stats">
            <article className="team-stat-card">
              <span>Project Members  : </span>
              <strong>{members.length}</strong>
            </article>

            <article className="team-stat-card">
              <span>Project Managers  : </span>
              <strong>{projectManagersCount}</strong>
            </article>

            <article className="team-stat-card">
              <span>Team Members  : </span>
              <strong>{teamMembersCount}</strong>
            </article>
          </section>

          {canManageTeam && (
            <section className="team-panel team-form-card">
              <h2>Add Team Member</h2>
              <p>Add an existing workspace user to this project.</p>

              <form className="team-form" onSubmit={addMember}>
                <label>
                  Select user
                  <select
                    name="user_id"
                    value={form.user_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Choose a user</option>
                    {availableUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.email})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Project role
                  <select
                    name="project_role"
                    value={form.project_role}
                    onChange={handleFormChange}
                  >
                    <option value="Team Member">Team Member  : </option>
                    <option value="Viewer">Viewer  : </option>
                  </select>
                </label>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving || !form.user_id}
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>

                {!loading && availableUsers.length === 0 && (
                  <p>No additional active users are available to add.</p>
                )}
              </form>
            </section>
          )}

          {canViewWorkspaceUsers && (
            <section className="team-panel">
              <h2>Workspace Users</h2>
              <p>{users.length} users returned by the users API.</p>
              <Link to="/users">Open user management →</Link>
            </section>
          )}

          <section className="team-panel">
            <div className="team-section-heading">
              <div>
                <h2>
                  {isMember
                    ? 'Your Teammates'
                    : isViewer
                      ? 'Team Directory'
                      : 'Current Project Members'}
                </h2>
                <p>Search members and filter by project role.</p>
              </div>
            </div>

            <div className="team-toolbar">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email..."
                aria-label="Search team members"
              />

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter by project role"
              >
                <option value="all">All roles</option>
                <option value="project_manager">Project Manager  : </option>
                <option value="team_member">Team Member  : </option>
                <option value="viewer">Viewer  : </option>
              </select>
            </div>

            {loading ? (
              <p className="team-loading">Loading team members...</p>
            ) : filteredMembers.length === 0 ? (
              <div className="team-empty-state">
                <h3>No team members found</h3>
                <p>
                  {members.length === 0
                    ? 'No members have been added to this project yet.'
                    : 'Try changing your search or role filter.'}
                </p>
              </div>
            ) : (
              <div className="team-members-grid">
                {filteredMembers.map((member) => (
                  <article
                    className="team-member-card"
                    key={getMemberId(member)}
                  >
                    <div className="team-member-avatar">
                      {(member.name || member.email || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="team-member-info">
                      <h3>{member.name || 'Unnamed User'}</h3>
                      <p>{member.email || 'Email unavailable'}</p>
                      <span className="team-role-badge">
                        {member.project_role ||
                          member.role ||
                          'Team Member'}
                      </span>
                    </div>

                    {canManageTeam && (
                      <button
                        className="team-remove-button"
                        type="button"
                        onClick={() => removeMember(member)}
                      >
                        Remove
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {isViewer && (
            <p className="team-readonly-note">
              You have read-only access to this team directory.
            </p>
          )}
        </>
      )}
    </main>
  );
}
