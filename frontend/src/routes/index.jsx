// src/routes/index.jsx
// --------------------------------------------------------------------------------
// This file defines the core routing structure of our React application.
// We use React Router v6's createBrowserRouter to set up a path hierarchy.
// Routes are split into public pages (like /login) and protected pages (which
// require the user to be logged in and wrap the views in a consistent Sidebar Layout).
// --------------------------------------------------------------------------------

import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../layouts/ProtectedRoute';
import SidebarLayout from '../layouts/SidebarLayout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import SprintBoardPage from '../pages/SprintBoardPage';
import CreateRequirementPage from '../pages/CreateRequirementPage';
import RequirementsPage from '../pages/RequirementsPage';
import ProjectsPage from '../pages/ProjectsPage';
import ReportsPage from '../pages/ReportsPage';
import UserManagementPage from '../pages/UserManagementPage';
import BacklogPage from '../pages/BacklogPage';
import DevDashboardPage from '../pages/DevDashboardPage';
import DevSprintBoardPage from '../pages/DevSprintBoardPage';
import DevMyTasksPage from '../pages/DevMyTasksPage';

import { useRouteError } from 'react-router-dom';

/**
 * RootBoundary Component
 * --------------------------------------------------------------------------------
 * This functions as a global error boundary. If any child page fails to load,
 * throws an exception, or encounters rendering crashes, React Router will render 
 * this boundary instead of showing a blank screen. This enhances app stability.
 * --------------------------------------------------------------------------------
 */
function RootBoundary() {
    const error = useRouteError();
    console.error("Root error boundary caught:", error);
    return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
            <h1 style={{ color: '#dc2626' }}>Oops! Something went wrong.</h1>
            <p style={{ margin: '1rem 0', color: '#4b5563' }}>An unexpected error occurred while rendering this page.</p>
            <p style={{ marginBottom: '2rem', fontSize: '0.875rem', color: '#9ca3af' }}>{error?.message || error?.statusText || "Unknown error"}</p>
            <button 
                onClick={() => window.location.href = '/dashboard'}
                style={{ padding: '8px 16px', background: '#4682B4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                Return to Dashboard
            </button>
        </div>
    );
}

const router = createBrowserRouter([
    // ── Public route — no login needed ─────────────────────────────────────
    // AuthGuard Loader: If the user is already authenticated (token exists in
    // localStorage), we prevent them from visiting the login page again. Instead,
    // we read their role_id and redirect them automatically to their respective dashboard.
    // ────────────────────────────────────────────────────────────────────────
    {
        path: '/login',
        element: <LoginPage />,
        errorElement: <RootBoundary />,
        loader: () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const user = JSON.parse(localStorage.getItem('user') || 'null');
                    const roleId = user?.role_id;
                    // Roles 3 (Developer) and 4 (Tester) are directed to the execution dashboard.
                    // Roles 1 (Admin) and 2 (PM) are directed to the planning dashboard.
                    if (roleId === 3 || roleId === 4) {
                        window.location.replace('/my-dashboard');
                    } else {
                        window.location.replace('/dashboard');
                    }
                } catch {
                    // If local data parsing fails, treat session as stale and render login
                }
            }
            return null;
        },
    },

    // ── Protected routes — user must be logged in ──────────────────────────
    // 1. ProtectedRoute checks for a JWT token in localStorage.
    //    If not found, it redirects to /login automatically.
    // 2. SidebarLayout wraps every protected page with the steel blue sidebar + header.
    // 3. All child routes are rendered dynamically inside the <Outlet /> of SidebarLayout.
    // ────────────────────────────────────────────────────────────────────────
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <SidebarLayout />
            </ProtectedRoute>
        ),
        errorElement: <RootBoundary />,
        children: [
            // Redirect root "/" to "/dashboard" as the default landing route
            { index: true, element: <Navigate to="/dashboard" replace /> },

            // Planning Dashboard: shows active sprint summary, tasks counts, team allocation
            { path: 'dashboard', element: <DashboardPage /> },

            // Developer / Tester specific views
            { path: 'my-dashboard', element: <DevDashboardPage /> },
            { path: 'my-sprint-board', element: <DevSprintBoardPage /> },
            { path: 'my-tasks', element: <DevMyTasksPage /> },

            // Projects listing and creation interface
            { path: 'projects', element: <ProjectsPage /> },

            // Reports: metric calculations, velocity trackers, performance tables
            { path: 'reports', element: <ReportsPage /> },

            // Backlog: displays list of tasks that have not yet been assigned to any sprint
            { path: 'backlog', element: <BacklogPage /> },

            // Sprint Kanban Board: view columns (To Do, In Progress, Review, Done) for a given sprint ID
            { path: 'sprints/:sprintId/board', element: <SprintBoardPage /> },

            // Requirement Engineering and AI task breakdown views
            { path: 'requirements', element: <RequirementsPage /> },
            { path: 'requirements/new', element: <CreateRequirementPage /> },

            // Admin only: user creation, list, and role allocations
            { path: 'admin/users', element: <UserManagementPage /> },
        ],
    },
]);

export default router;