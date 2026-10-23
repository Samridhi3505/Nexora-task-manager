
-- Nexora Project Management Database
-- PostgreSQL schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'Team Member'
        CHECK (role IN ('Admin', 'Project Manager', 'Team Member', 'Viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active', 'Completed', 'On Hold')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    project_role VARCHAR(30) NOT NULL DEFAULT 'Team Member'
        CHECK (project_role IN ('Project Manager', 'Team Member', 'Viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'To Do'
        CHECK (status IN ('To Do', 'In Progress', 'Done')),
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High')),
    due_date DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_projects_created_at
    ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project
    ON tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee
    ON tasks(assignee_id);

CREATE INDEX IF NOT EXISTS idx_comments_task
    ON comments(task_id);
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS owner_id INTEGER
REFERENCES users(id);