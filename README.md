<h1 align="center">🤖 AI Sprint Planner</h1>

<p align="center">
  <strong>An AI-powered Agile project management platform for intelligent sprint planning, task breakdown, and team collaboration.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Google%20Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
</p>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Database Schema](#-database-schema)
- [Role-Based Access Control](#-role-based-access-control)
- [API Endpoints](#-api-endpoints)
- [Frontend Structure](#-frontend-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [Demo Accounts](#-demo-accounts)
- [Folder Structure](#-folder-structure)

---

## 🧠 About the Project

**AI Sprint Planner** is a full-stack Agile project management web application that combines traditional sprint planning workflows with AI-powered automation. It allows teams to manage projects, write software requirements, and automatically break them down into structured, sprint-ready tasks using **Google Gemini AI**.

The system supports **four user roles** — Admin, Project Manager, Developer, and Tester — each with their own tailored dashboard and access permissions.

### 🎯 Problem It Solves

Traditional sprint planning is manual, time-consuming, and error-prone. PMs write requirements, then manually break them down into tasks, estimate effort, and assign them — which can take hours. This platform automates that entire breakdown using AI, turning a natural-language requirement into a complete set of structured developer and tester tasks within seconds.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Secure login/logout with role-based session management |
| 👥 **Role-Based Dashboards** | Separate views for Admin, PM, Developer, and Tester |
| 📋 **Project Management** | Create and manage multiple projects with status tracking |
| 🏃 **Sprint Management** | Create sprints, manage lifecycle (Planning → Active → Completed) |
| 🤖 **AI Task Breakdown** | Paste a requirement → Gemini AI generates structured tasks automatically |
| 🗂️ **Kanban Sprint Board** | Kanban board with columns: To Do → In Progress → In Review → Done |
| 📦 **Backlog Management** | View and manage unassigned tasks, assign them to sprints |
| 📊 **Reports & Analytics** | Sprint velocity, task completion charts, team performance metrics |
| 👤 **User Management** | Admin can create, view, activate/deactivate team member accounts |
| 💬 **Task Comments** | Threaded comments on individual task cards for team communication |
| 📱 **Responsive UI** | Mobile-first design with collapsible sidebar |

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance Python web framework for REST APIs |
| **SQLAlchemy** | Python ORM for database modelling and queries |
| **Alembic** | Database migration management |
| **PostgreSQL** | Primary relational database |
| **python-jose** | JWT token creation and verification |
| **passlib / bcrypt** | Secure password hashing |
| **Google Gemini AI SDK** | AI-powered requirement-to-task generation |
| **httpx** | Async HTTP client for external API calls |
| **pydantic-settings** | Environment variable management and validation |
| **uvicorn** | ASGI server to run FastAPI |

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | Component-based UI library |
| **Vite 8** | Ultra-fast frontend build tool and dev server |
| **React Router v7** | Client-side routing and navigation |
| **Axios** | HTTP client for API calls to the backend |
| **Lucide React** | Modern icon library |
| **Vanilla CSS** | Custom styling with CSS variables and animations |

---

## 🏗 Project Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (User)                     │
└─────────────────────┬───────────────────────────────────┘
                      │  HTTP
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                    │
│   index.html → main.jsx → App.jsx → Router             │
│   ┌──────────────────────────────────────────────┐     │
│   │  ProtectedRoute (Auth Guard + Role Check)    │     │
│   │    └── SidebarLayout (Shell UI)              │     │
│   │          └── <Outlet /> → Page Components    │     │
│   └──────────────────────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │  REST API (JSON)
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (FastAPI + Python)                 │
│   main.py → Routers → Services → Repositories         │
│   ┌─────────────────────────────────────────────┐     │
│   │  Auth │ Projects │ Sprints │ Tasks │ AI     │     │
│   └─────────────────────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │  SQLAlchemy ORM
                      ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                        │
│  users │ projects │ sprints │ tasks │ requirements     │
│  task_comments │ ai_task_suggestions                   │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Google Gemini AI API                       │
│  (Requirement analysis → structured task generation)   │
└─────────────────────────────────────────────────────────┘
```

### Backend Layer Design (Clean Architecture)

```
app/
├── routers/       ← HTTP layer: receives requests, calls services
├── services/      ← Business logic: orchestrates operations
├── repositories/  ← Data access layer: database queries only
├── models/        ← SQLAlchemy ORM models (table definitions)
├── schemas/       ← Pydantic schemas (request/response validation)
└── core/          ← Config, database connection, security utilities
```

---

## 🗃 Database Schema

### `users`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique user ID |
| `name` | String(100) | Display name |
| `email` | String(150) | Unique email used for login |
| `password_hash` | Text | bcrypt-hashed password |
| `role_id` | Integer | 1=Admin, 2=PM, 3=Developer, 4=Tester |
| `is_active` | Boolean | Soft deactivation flag |
| `created_at` | Timestamp | Auto-set on creation |

### `projects`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique project ID |
| `name` | String | Project title |
| `description` | Text | Project summary |
| `owner_id` | FK → users | PM/Admin who owns it |
| `status` | String | Active / Completed / On Hold |

### `sprints`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique sprint ID |
| `project_id` | FK → projects | Parent project |
| `name` | String | Sprint name |
| `start_date` | Date | Sprint start |
| `end_date` | Date | Sprint end |
| `status` | String | Planning / Active / Completed |

### `tasks`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique task ID |
| `project_id` | FK → projects | Parent project |
| `sprint_id` | FK → sprints (nullable) | NULL = in Backlog |
| `requirement_id` | FK → requirements | AI-linked requirement |
| `assignee_id` | FK → users | Developer/Tester assigned |
| `title` | String(250) | Task headline |
| `task_type` | String | Backend / Frontend / Testing / Bug / Documentation |
| `priority` | String | Low / Medium / High / Critical |
| `status` | String | TODO / IN_PROGRESS / IN_REVIEW / DONE |
| `estimated_hours` | Float | Time estimate |
| `effort_points` | Integer | Story points (AI-generated) |
| `acceptance_criteria` | Text | Definition of Done (AI-generated) |
| `risk_notes` | Text | Risk warnings (AI-generated) |
| `is_deleted` | Boolean | Soft delete flag |

### `requirements`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique requirement ID |
| `project_id` | FK → projects | Parent project |
| `title` | String | Requirement title |
| `description` | Text | Full requirement text |
| `created_by` | FK → users | PM/Admin who wrote it |
| `status` | String | Draft / Approved / Archived |

### `task_comments`

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Unique comment ID |
| `task_id` | FK → tasks | Parent task |
| `author_id` | FK → users | Comment author |
| `content` | Text | Comment body |

---

## 👥 Role-Based Access Control

| Role | ID | Dashboard | Can Access |
|---|---|---|---|
| **Admin** | 1 | `/dashboard` | Everything — all pages + User Management |
| **Project Manager** | 2 | `/dashboard` | Projects, Sprints, Requirements, Backlog, Reports, Tasks |
| **Developer** | 3 | `/my-dashboard` | My Dashboard, My Sprint Board, My Tasks |
| **Tester** | 4 | `/my-dashboard` | My Dashboard, Testing Board, My Test Tasks |

### Access Guard Flow

```
User visits a protected page
       ↓
ProtectedRoute checks localStorage for JWT token
       ↓
No token? → Redirect to /login
       ↓
Has token? → Check role_id against route permissions
       ↓
Developer/Tester on PM-only route? → Redirect to /my-dashboard
Non-Admin on /admin/* route?       → Redirect to default dashboard
       ↓
All checks pass → Render inside SidebarLayout → <Outlet /> → Page
```

---

## 🔌 API Endpoints

### Auth — `/auth`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login and receive JWT token |
| `POST` | `/auth/register` | Register a new user |
| `GET` | `/auth/me` | Get current authenticated user profile |

### Projects — `/projects`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects` | List all projects |
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects/{id}` | Get single project details |
| `PATCH` | `/projects/{id}` | Update project |

### Sprints — `/sprints`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sprints?project_id=X` | List all sprints for a project |
| `POST` | `/sprints` | Create a new sprint |
| `GET` | `/sprints/{id}` | Get sprint details |
| `PATCH` | `/sprints/{id}/status` | Update sprint status |
| `GET` | `/sprints/{id}/board` | Get full Kanban board data |

### Tasks — `/tasks`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tasks` | List tasks (filter by sprint, project, assignee) |
| `POST` | `/tasks` | Create a new task |
| `GET` | `/tasks/{id}` | Get single task |
| `PATCH` | `/tasks/{id}` | Update task fields |
| `PATCH` | `/tasks/{id}/status` | Update task status only |
| `DELETE` | `/tasks/{id}` | Soft-delete a task |
| `POST` | `/tasks/{id}/comments` | Add a comment to a task |
| `GET` | `/tasks/{id}/comments` | Get all comments for a task |
| `PATCH` | `/tasks/{id}/assign` | Assign task to a user |

### Requirements — `/requirements`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/requirements` | List all requirements |
| `POST` | `/requirements` | Create a new requirement |
| `GET` | `/requirements/{id}` | Get single requirement |

### AI — `/ai`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ai/breakdown` | Send requirement text → Get AI-generated tasks |

### Dashboard — `/dashboard`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/summary` | PM/Admin summary (sprint stats, task counts, team) |
| `GET` | `/dashboard/dev-summary` | Developer/Tester personal dashboard data |

### Admin — `/admin`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users` | Create new user (Admin only) |
| `PATCH` | `/admin/users/{id}/toggle-active` | Activate or Deactivate user |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |

> 📖 Interactive API docs are available at **`http://localhost:8000/docs`** (Swagger UI) when the backend is running.

---

## 🖥 Frontend Structure

```
frontend/src/
├── main.jsx               ← React entry point (mounts App into div#root)
├── App.jsx                ← Root component (activates RouterProvider)
├── index.css              ← Global styles and CSS variables
│
├── routes/
│   └── index.jsx          ← All route definitions (public + protected)
│
├── layouts/
│   ├── ProtectedRoute.jsx ← Auth + role guard for all protected pages
│   └── SidebarLayout.jsx  ← Sidebar navigation shell + <Outlet />
│
├── pages/
│   ├── LoginPage.jsx              ← Login form
│   ├── DashboardPage.jsx          ← PM/Admin overview dashboard
│   ├── DevDashboardPage.jsx       ← Developer/Tester dashboard
│   ├── ProjectsPage.jsx           ← Project listing + sprint management
│   ├── SprintBoardPage.jsx        ← Kanban board (PM view)
│   ├── DevSprintBoardPage.jsx     ← Kanban board (Developer/Tester view)
│   ├── DevMyTasksPage.jsx         ← Personal task list for devs/testers
│   ├── RequirementsPage.jsx       ← Requirements listing
│   ├── CreateRequirementPage.jsx  ← AI-powered requirement + task creation
│   ├── BacklogPage.jsx            ← Unassigned tasks backlog
│   ├── ReportsPage.jsx            ← Sprint reports and metrics
│   └── UserManagementPage.jsx     ← Admin user management
│
├── api/
│   ├── axios.js           ← Axios instance with base URL + auth headers
│   ├── auth.js            ← Login, register, me
│   ├── projects.js        ← Project CRUD
│   ├── sprint.js          ← Sprint CRUD + board
│   ├── tasks.js           ← Task CRUD + comments + assign
│   ├── requirements.js    ← Requirement CRUD
│   ├── ai.js              ← AI breakdown API call
│   ├── dashboard.js       ← Dashboard summary API
│   └── admin.js           ← Admin user management
│
├── components/
│   └── SkeletonLoader.jsx ← Loading skeleton component
│
└── utils/
    ├── helpers.js         ← getToken, getUser, clearToken helpers
    └── constants.js       ← ROLE constants and app-wide enums
```

### Frontend Rendering Chain

```
Browser → index.html
              ↓  loads script
          src/main.jsx        (ReactDOM.createRoot → mounts <App />)
              ↓
          src/App.jsx          (renders <RouterProvider router={router} />)
              ↓
          routes/index.jsx     (matches current URL → picks a component)
              ↓  (protected routes)
          ProtectedRoute.jsx   (checks JWT token → checks role)
              ↓
          SidebarLayout.jsx    (renders sidebar + header shell)
              ↓
          <Outlet />           (the matched page renders here)
              ↓
          api/*.js             (Axios calls → FastAPI backend → DB)
```

---

## ✅ Prerequisites

Make sure the following are installed on your machine:

- **Node.js** v18 or later — [Download](https://nodejs.org/)
- **Python** v3.10 or later — [Download](https://python.org/)
- **PostgreSQL** v14 or later — [Download](https://postgresql.org/)
- **Git** — [Download](https://git-scm.com/)
- **Google Gemini API Key** — [Get one here](https://aistudio.google.com/app/apikey)

---

## 🚀 Installation & Setup

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/ai-sprint-planner.git
cd ai-sprint-planner
```

---

### Step 2 — Create the PostgreSQL Database

Open your PostgreSQL shell (`psql`) and run:

```sql
CREATE DATABASE sprint_planner;
```

---

### Step 3 — Backend Setup

```bash
cd backend

# Create a Python virtual environment
python -m venv .venv

# Activate it
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

# Install all Python dependencies
pip install -r requirements.txt
```

---

### Step 4 — Configure Environment Variables

```bash
cp .env.example .env
```

Open the newly created `.env` file and fill in your actual values (see the [Environment Variables](#-environment-variables) section below).

---

### Step 5 — Run Database Migrations

```bash
alembic upgrade head
```

This creates all the necessary tables in your PostgreSQL database.

---

### Step 6 — Seed Demo Data *(Optional but Recommended)*

```bash
python seed.py
```

This creates 4 demo user accounts, a sample project, 2 sprints, and initial tasks so you can explore the app immediately.

---

### Step 7 — Frontend Setup

```bash
cd ../frontend
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/sprint_planner

# JWT secret key (use a long random string in production)
SECRET_KEY=your-super-secret-key-change-this-in-production

# JWT token expiry time in minutes
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Google Gemini AI API key (from https://aistudio.google.com/app/apikey)
AI_API_KEY=your-gemini-api-key-here

# Gemini model to use
AI_MODEL_NAME=gemini-2.0-flash

# Timeout in seconds for AI requests
AI_TIMEOUT_SECONDS=30

# Maximum tokens for AI response
AI_MAX_TOKENS=2000
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`.

---

## ▶️ Running the Application

Open **two separate terminal windows**:

### Terminal 1 — Backend

```bash
cd backend
source .venv/bin/activate     # macOS/Linux
# .venv\Scripts\activate      # Windows

uvicorn app.main:app --reload --port 8000
```

- Backend URL: **`http://localhost:8000`**
- Swagger API Docs: **`http://localhost:8000/docs`**

---

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

- Frontend URL: **`http://localhost:5173`**

---

## 👤 Demo Accounts

After running `python seed.py`, these accounts are ready to use:

| Role | Email | Password | What You Can Do |
|---|---|---|---|
| **Admin** | `admin@demo.com` | `password123` | Full access — all features + User Management |
| **Project Manager** | `pm@demo.com` | `password123` | Projects, Sprints, Requirements, Reports, Backlog |
| **Developer** | `dev@demo.com` | `password123` | My Dashboard, Sprint Board, My Tasks |
| **Tester** | `tester@demo.com` | `password123` | My Dashboard, Testing Board, My Test Tasks |

---

## 📁 Folder Structure

```
ai-sprint-planner/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py          ← Reads .env settings
│   │   │   ├── database.py        ← SQLAlchemy engine + session
│   │   │   └── security.py        ← JWT + bcrypt helpers
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── sprint.py
│   │   │   ├── task.py
│   │   │   ├── requirement.py
│   │   │   ├── task_comment.py
│   │   │   └── ai_task_suggestion.py
│   │   ├── schemas/               ← Pydantic request/response models
│   │   ├── repositories/          ← Database query functions
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── ai_service.py      ← Google Gemini integration
│   │   │   ├── task_service.py
│   │   │   ├── sprint_service.py
│   │   │   ├── requirement_service.py
│   │   │   └── project_service.py
│   │   ├── routers/
│   │   │   ├── auth_routes.py
│   │   │   ├── ai_routes.py
│   │   │   ├── task_routes.py
│   │   │   ├── sprint_routes.py
│   │   │   ├── project_routes.py
│   │   │   ├── requirement_routes.py
│   │   │   ├── dashboard.py
│   │   │   └── admin_routes.py
│   │   └── main.py                ← FastAPI app entry point
│   ├── alembic/                   ← Database migration files
│   ├── seed.py                    ← Demo data seeder script
│   ├── requirements.txt           ← Python dependencies
│   ├── .env.example               ← Environment variable template
│   └── alembic.ini
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── api/                   ← Axios API call functions
    │   ├── components/            ← Reusable UI components
    │   ├── layouts/               ← ProtectedRoute + SidebarLayout
    │   ├── pages/                 ← Page-level components
    │   ├── routes/                ← React Router configuration
    │   ├── styles/                ← CSS files
    │   ├── utils/                 ← Helpers and constants
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🔒 Security Notes

- **Never commit `.env`** — it contains your secret key and Gemini API key
- **JWT tokens** are stored in `localStorage` and sent as `Bearer` tokens in `Authorization` headers
- **Passwords** are hashed using `bcrypt` via `passlib` — never stored in plaintext
- **CORS** is configured to only allow `localhost:5173` and `localhost:3000` in development — update for production deployment
- **Soft deletes** — tasks are never hard-deleted from the database, preserving full audit history

---

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">Built with ❤️ using FastAPI · React · PostgreSQL · Google Gemini AI</p>
