import { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, FolderKanban, ListTodo, FileText, 
    PlusCircle, BarChart3, Users, CheckSquare, LogOut,
    Menu, X
} from 'lucide-react';
import { clearToken, getUser } from '../utils/helpers';
import { ROLE } from '../utils/constants';

const ROLE_LABEL = {
    [ROLE.ADMIN]: 'Admin',
    [ROLE.PM]: 'PM',
    [ROLE.DEVELOPER]: 'Developer',
    [ROLE.TESTER]: 'Tester',
};

function getNavGroups(roleId) {
    if (roleId === ROLE.ADMIN || roleId === ROLE.PM) {
        return [
            {
                name: 'Overview',
                items: [
                    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
                    { label: 'Reports', to: '/reports', icon: BarChart3 },
                ]
            },
            {
                name: 'Planning',
                items: [
                    { label: 'Projects', to: '/projects', icon: FolderKanban },
                    { label: 'Requirements', to: '/requirements', icon: FileText },
                    { label: 'New Requirement', to: '/requirements/new', icon: PlusCircle },
                    { label: 'Backlog', to: '/backlog', icon: ListTodo },
                ]
            },
            ...(roleId === ROLE.ADMIN ? [{
                name: 'Settings',
                items: [
                    { label: 'User Management', to: '/admin/users', icon: Users },
                ]
            }] : [])
        ];
    } else {
        return [
            {
                name: 'My Workspace',
                items: [
                    { label: 'My Dashboard', to: '/my-dashboard', icon: LayoutDashboard },
                    { label: roleId === ROLE.TESTER ? 'Testing Board' : 'Sprint Board', to: '/my-sprint-board', icon: FolderKanban },
                    { label: roleId === ROLE.TESTER ? 'My Test Tasks' : 'My Tasks', to: '/my-tasks', icon: CheckSquare },
                ]
            }
        ];
    }
}

export default function SidebarLayout() {
    const navigate = useNavigate();
    const user = getUser();
    const roleId = user?.role_id;
    const navGroups = getNavGroups(roleId);
    const roleLabel = ROLE_LABEL[roleId] ?? 'User';
    const location = useLocation();
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    function handleLogout() {
        clearToken();
        navigate('/login');
    }

    const breadcrumbs = location.pathname
        .split('/')
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '));

    return (
        <div className={`layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
            {/* Mobile Header */}
            <div className="mobile-header">
                <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="login-logo-mark" style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}></div>
                    <span>AI Sprint Planner</span>
                </div>
                <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="login-logo-mark" style={{ transform: 'scale(0.9)', transformOrigin: 'left center' }}></div>
                    <span style={{ fontSize: '18px' }}>AI Sprint Planner</span>
                </div>

                <nav className="sidebar-nav">
                    {navGroups.map((group, gIdx) => (
                        <div key={gIdx} className="sidebar-group">
                            <div className="sidebar-group-label">{group.name}</div>
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) =>
                                            'sidebar-link' + (isActive ? ' active' : '')
                                        }
                                    >
                                        <span className="sidebar-icon">
                                            <Icon size={17} />
                                        </span>
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User info bubble */}
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="sidebar-user-info">
                        <span className="sidebar-user-name">{user?.name ?? 'User'}</span>
                        <span className="sidebar-user-role">{roleLabel}</span>
                    </div>
                </div>

                <button className="sidebar-logout" onClick={handleLogout}>
                    <span className="sidebar-icon">
                        <LogOut size={17} />
                    </span>
                    <span>Logout</span>
                </button>
            </aside>

            {isMobileMenuOpen && (
                <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}