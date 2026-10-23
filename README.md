# Nexora Task Manager

A full-stack project and task management application built with React, Node.js, Express.js, and PostgreSQL. Nexora helps teams organize projects, manage tasks, assign responsibilities, and control access based on user roles.

## Overview

Nexora Task Manager provides a centralized platform where administrators, project managers, team members, and viewers can work with projects according to their permissions.

The application follows a client-server architecture. The React frontend communicates with an Express REST API, while PostgreSQL stores application data.

## Features

- **Authentication:** Secure access to protected application routes.
- **Role-based access control:** Permissions based on user roles.
- **Project management:** Create, view, and update projects according to permissions.
- **Project members:** Assign users to projects and manage project membership.
- **Task management:** Create, view, update, and manage tasks.
- **User management:** View and manage users according to administrative permissions.
- **Dashboard:** Display relevant project and task information.
- **PostgreSQL database:** Store and organize application data using relational tables.
- **REST APIs:** Connect frontend components with backend functionality.
- **Responsive interface:** Organize project information through a React-based user interface.

*Note: Available features depend on the functionality implemented in the current version of the application.*

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| API communication | REST APIs, JSON |
| Authentication | JWT-based authentication, where configured |
| Development tools | VS Code, npm, Git, GitHub |

## Project Structure

```text
Nexora-task-manager/
├── backend/
│   ├── routes/
│   ├── middleware/
│   ├── package.json
│   ├── .env
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

The structure above illustrates the main application components. Some filenames and folders may differ in the actual repository.

## Prerequisites

Install the following software before running the project:

- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code or another code editor

Verify your installations:

```bash
node --version
npm --version
psql --version
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Samridhi3505/Nexora-task-manager.git
cd Nexora-task-manager
```

### 2. Configure the PostgreSQL database

Start PostgreSQL and open the PostgreSQL command-line interface or pgAdmin.

Create the application database:

```sql
CREATE DATABASE neostats;
```

Connect to the database:

```sql
\c neostats
```

The application requires the database tables defined by its backend queries. Create them using the project's actual schema or migration files before starting the application.

If the project does not yet contain migrations or a schema setup script, add and document one before submitting the application.

### 3. Configure backend environment variables

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory using the following example:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/neostats
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
FRONTEND_URL=http://localhost:5173
```

Replace `YOUR_PASSWORD` with your local PostgreSQL password and generate a strong secret for `JWT_SECRET`.

The variable names must match those read by the actual backend code. Do not commit your `.env` file.

### 4. Start the backend

Check the scripts defined in `backend/package.json`:

```bash
npm run
```

Run the appropriate script defined by the project. For example, if a `dev` script exists:

```bash
npm run dev
```

If the project uses a `start` script instead, run:

```bash
npm start
```

The backend is expected to run at:

```text
http://localhost:5000
```

If the application exposes the health-check endpoint, test it at:

```text
http://localhost:5000/api/health
```

### 5. Configure the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
```

Create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:5000/api
```

Ensure the variable name matches the API configuration used by the frontend.

### 6. Start the frontend

Check the available scripts:

```bash
npm run
```

For a Vite application with the standard development script, run:

```bash
npm run dev
```

Open the local URL printed in the terminal, usually:

```text
http://localhost:5173
```

Keep the backend and frontend running in separate terminals.

## Application Architecture

Nexora follows a three-layer architecture.

```text
┌──────────────────────────┐
│      React Frontend      │
│  Pages, Components, UI   │
└────────────┬─────────────┘
             │
             │ HTTP / REST APIs
             ▼
┌──────────────────────────┐
│    Express.js Backend    │
│ Routes, Validation, Auth │
└────────────┬─────────────┘
             │
             │ SQL Queries
             ▼
┌──────────────────────────┐
│      PostgreSQL DB       │
│ Users, Projects, Tasks   │
└──────────────────────────┘
```

### Frontend

The frontend is responsible for displaying dashboards, projects, tasks, users, and other application pages. It sends HTTP requests to the backend and renders the returned data.

### Backend

The backend exposes REST API endpoints using Express.js. It validates incoming requests, checks authentication and authorization where configured, executes database operations, and returns JSON responses.

### Database

PostgreSQL stores relational application data. Foreign keys, unique constraints, and transactions should be used where appropriate to maintain consistency.

## Data Model

The main entities of the application are:

### 1. Users

Stores user information, login-related information, account status, and applicable roles.

### 2. Projects

Stores project details, descriptions, status, creator information, and assigned project manager where supported.

### 3. Project Members

Associates users with projects and stores their project-specific roles.

### 4. Tasks

Stores task details and associates tasks with projects and, where supported, assigned users.

**Relationships:**

- A user can participate in multiple projects.
- A project can have multiple members.
- A project can contain multiple tasks.
- Tasks can be assigned to users where assignment is supported.
- Project membership can determine what a user is allowed to do within a project.

The exact columns and constraints are defined by the application's database schema.

## Authentication and Authorization

Authentication identifies the user making a request. Authorization determines what that user is allowed to do.

The application is designed around role-based access for the following user types:

| Role | Intended responsibility |
|---|---|
| Admin | Manage users and perform authorized administrative operations |
| Project Manager | Manage assigned projects, team members, and tasks according to permissions |
| Team Member | Access assigned projects and work with permitted tasks |
| Viewer | View permitted project and task information |

The backend must enforce permissions for protected operations. Frontend restrictions alone are not sufficient because API requests can be sent without using the user interface.

Authentication and role permissions should be verified against the actual backend middleware and route implementations.

## Concurrent Updates and Data Integrity

Multiple users may attempt to modify the same project or add the same member at the same time.

The application should handle these situations through:

- **Parameterized SQL queries:** Reduce SQL injection risks.
- **Database constraints:** Prevent invalid relationships and duplicate membership records.
- **Transactions:** Keep related database operations consistent when they must succeed or fail together.
- **Conflict handling:** Use appropriate PostgreSQL conflict-handling mechanisms when concurrent requests create duplicate records.
- **Optimistic locking or conditional updates:** Consider version-based checks or equivalent mechanisms when simultaneous edits must not silently overwrite one another.

These are the intended data-integrity practices; the actual protections depend on the database schema and backend implementation.

## Environment Variables and Security

- Keep database credentials and authentication secrets in local environment files.
- Add `.env` files to `.gitignore`.
- Never publish passwords, private API keys, or production secrets in the repository.
- Validate and sanitize incoming requests on the backend.
- Use parameterized database queries.
- Enforce access permissions on the server.
- Use a strong, unique authentication secret.
- Do not store plaintext passwords; use a suitable password-hashing algorithm.
- Provide only non-sensitive example values in `.env.example`.

## Testing

Before submitting the project, verify the following:

- The backend starts without errors.
- PostgreSQL connects successfully.
- Required database tables and constraints exist.
- The health endpoint responds if implemented.
- The frontend starts and communicates with the backend.
- Login and logout work if implemented.
- Each role has the intended permissions.
- Projects and tasks can be created and updated where permitted.
- Invalid requests return appropriate error responses.
- Duplicate membership and invalid foreign-key operations are handled correctly.

Test the application with separate accounts for each supported role.

## Sample Login Credentials

Sample login credentials should be documented here after the database seed script has been verified and executed.

| Role | Email | Password |
|---|---|---|
| Admin | Add seeded email | Add seeded password |
| Project Manager | Add seeded email | Add seeded password |
| Team Member | Add seeded email | Add seeded password |
| Viewer | Add seeded email | Add seeded password |

Do not use these placeholders as login credentials. Replace them with the actual test accounts created by the project's seed process. Use development-only credentials and never publish real user passwords.

## Common Issues

### PostgreSQL connection error

- Confirm that PostgreSQL is running.
- Check the database name, username, password, host, and port.
- Confirm that the `DATABASE_URL` value matches your local configuration.

### Database relation does not exist

If PostgreSQL reports that a relation or table does not exist, create the required tables using the correct schema or migrations. Confirm that the backend is connected to the intended database.

### Frontend cannot connect to the backend

- Confirm that the backend is running.
- Verify `VITE_API_URL`.
- Check browser developer tools for failed network requests.
- Verify that the backend CORS configuration permits the frontend origin.

### Missing npm script

Run `npm run` in the relevant directory and use a script that actually exists in that directory's `package.json`.

### Port already in use

Stop the process occupying the port or configure an available port through the application's supported environment variables.

## Future Enhancements

Potential improvements include:

- Project activity logs and audit history.
- Notifications for task assignments and status changes.
- Task deadlines and priority-based filtering.
- Advanced project analytics and reporting.
- Pagination and search for large datasets.
- Optimistic locking for concurrent edits.
- Automated backend and frontend tests.

## Author

**Samridhi Thakur**

GitHub: https://github.com/Samridhi3505

## Repository

Source code: https://github.com/Samridhi3505/Nexora-task-manager

## License

No license has been specified yet. Add a license file if you intend to distribute the project under an open-source license.
