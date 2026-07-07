// src/layouts/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../utils/helpers';
import { ROLE } from '../utils/constants';

// Paths that only PM (role 2) or Admin (role 1) can access
const PM_ADMIN_ONLY = ['/requirements/new', '/projects', '/reports', '/requirements'];

// Paths that only Admin (role 1) can access
const ADMIN_ONLY = ['/admin'];

export default function ProtectedRoute({ children }) {
    const token = getToken();
    if (!token) return <Navigate to="/login" replace />;

    const user = getUser();
    const roleId = user?.role_id;

    const currentPath = window.location.pathname;

    // Block admin-only routes from non-admins
    const isAdminRoute = ADMIN_ONLY.some((p) => currentPath.startsWith(p));
    if (isAdminRoute && roleId !== ROLE.ADMIN) {
        const defaultDash = (roleId === ROLE.DEVELOPER || roleId === ROLE.TESTER) ? '/my-dashboard' : '/dashboard';
        return <Navigate to={defaultDash} replace />;
    }

    // Block PM/Admin-only routes from Developers/Testers
    const isTeamMember = roleId === ROLE.DEVELOPER || roleId === ROLE.TESTER;
    const isBlocked = PM_ADMIN_ONLY.some((p) => currentPath.startsWith(p));
    if (isTeamMember && isBlocked) {
        return <Navigate to="/my-dashboard" replace />;
    }

    return children;
}