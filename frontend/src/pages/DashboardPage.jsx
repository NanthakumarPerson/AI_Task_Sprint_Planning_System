// src/pages/DashboardPage.jsx  (PM / Admin only — Dev/Tester routed to DevDashboardPage)
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardSprint } from '../api/dashboard';
import { getProjects } from '../api/projects';
import { formatDate, statusLabel, getUser } from '../utils/helpers';
import SkeletonLoader from '../components/SkeletonLoader';

/**
 * DashboardPage Component
 * --------------------------------------------------------------------------------
 * Serves as the primary dashboard for Project Managers (PMs) and Admins.
 * It automatically redirects Developers and Testers to their specific dashboard
 * (`/my-dashboard`) to avoid permission/role conflicts.
 * --------------------------------------------------------------------------------
 */
export default function DashboardPage() {
    const navigate = useNavigate();
    
    // Retrieve current logged-in user profile details from local storage helper
    const userObj = getUser();
    // Roles: 3 (Developer), 4 (Tester) are classified as Team Members
    const isTeamMember = userObj && (userObj.role_id === 3 || userObj.role_id === 4);

    // Redirect Team Members to the developer dashboard on component mount
    useEffect(() => {
        if (isTeamMember) {
            navigate('/my-dashboard', { replace: true });
        }
    }, [isTeamMember, navigate]);

    // Local State Variables
    const [summary, setSummary] = useState(null);       // Holds active sprint info, task counts, and member allocations
    const [projects, setProjects] = useState([]);      // Holds lists of projects in the workspace
    const [loading, setLoading]   = useState(true);     // Handles loading skeletons
    const [error, setError]       = useState('');       // Holds API load error messages

    // Fetch dashboard summary and projects data concurrently
    useEffect(() => {
        // Don't fire PM/Admin-only API calls for team members — they get redirected away.
        // This prevents noisy 403 errors in the console.
        if (isTeamMember) return;
        
        async function load() {
            try {
                // Fetch sprint summaries and project listings in parallel
                const [summaryRes, projectsRes] = await Promise.all([
                    getDashboardSprint(),
                    getProjects(),
                ]);
                setSummary(summaryRes.data.data);
                setProjects(projectsRes.data.data || []);
            } catch {
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [isTeamMember]);

    // If loading, render structured skeleton elements mimicking the final page layout
    if (loading) return (
        <div className="page page-wide">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
            </div>
            <SkeletonLoader count={1} height={100} style={{ marginBottom: 20 }} />
            <SkeletonLoader count={1} height={100} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 20 }}>
                <SkeletonLoader count={4} height={40} style={{ flex: 1 }} />
                <SkeletonLoader count={4} height={40} style={{ flex: 1 }} />
            </div>
        </div>
    );
    
    // Display global error screen if network request failed
    if (error)   return <div className="page-center"><p className="form-error">{error}</p></div>;

    // Destructure properties from summary state
    const active_sprints = summary?.active_sprints || [];
    const tasks          = summary?.task_summary   || {};
    const members        = summary?.member_breakdown || [];

    // Calculate overall sprint progress percentages
    const totalTasks  = tasks.total_tasks || 0;
    const doneTasks   = tasks.done_tasks  || 0;
    const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return (
        <div className="page">
            {/* Header: Section Title + CTA Link to create requirements */}
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <Link to="/requirements/new" className="btn btn-primary">+ New Requirement</Link>
            </div>

            {/* Active Sprint Section */}
            {active_sprints.length > 0 ? (
                <div className="active-sprints-container">
                    {active_sprints.map(sprint => (
                        <div key={sprint.id} className="card sprint-banner" style={{ marginBottom: '1rem' }}>
                            <div className="sprint-banner-top">
                                <div>
                                    <p className="sprint-label">Active sprint</p>
                                    <h2 className="sprint-name">{sprint.name}</h2>
                                    <p className="sprint-dates">
                                        {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                                    </p>
                                </div>
                                <Link to={`/sprints/${sprint.id}/board`} className="btn btn-primary">
                                    View Board
                                </Link>
                            </div>
                        </div>
                    ))}
                    {/* Overall Progress bar tracking done tasks against total tasks */}
                    <div className="card sprint-banner">
                        <div className="progress-wrap">
                            <div className="progress-meta">
                                <span>{progressPct}% complete (Overall)</span>
                                <span>{doneTasks} / {totalTasks} tasks done</span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card empty-state"><p>No active sprint found.</p></div>
            )}

            {/* Metric Summary Cards representing task status distributions */}
            <div className="summary-cards">
                <div className="summary-card border-blue">
                    <span className="summary-label">Total tasks</span>
                    <span className="summary-value">{tasks.total_tasks ?? '—'}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">To do</span>
                    <span className="summary-value">{tasks.todo_tasks ?? '—'}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">In progress</span>
                    <span className="summary-value">{tasks.in_progress_tasks ?? '—'}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">In Review</span>
                    <span className="summary-value" style={{ color: 'var(--color-warning)' }}>{tasks.in_review_tasks ?? '—'}</span>
                </div>
                <div className="summary-card border-green">
                    <span className="summary-label">Done</span>
                    <span className="summary-value dash-done">{tasks.done_tasks ?? '—'}</span>
                </div>
            </div>

            {/* Split Grid: Project list on left, Team member task counts on right */}
            <div className="dash-grid">
                {/* Project List card */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Projects</h3>
                        <Link to="/projects" className="btn-link">View all</Link>
                    </div>
                    {projects.length === 0 ? (
                        <p className="muted">No projects yet.</p>
                    ) : (
                        <ul className="item-list">
                            {projects.map(p => (
                                <li key={p.project_id ?? p.id} className="item-row">
                                    <span className="item-name">{p.project_name ?? p.name}</span>
                                    {p.active_sprint_name && (
                                        <span className="badge">{p.active_sprint_name}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Team member breakdown card */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Team breakdown</h3>
                    </div>
                    {members.length === 0 ? (
                        <p className="muted">No member data yet.</p>
                    ) : (
                        <ul className="item-list">
                            {members.map(m => (
                                <li key={m.user_id} className="item-row member-row">
                                    <div className="member-avatar">
                                        {m.name?.charAt(0).toUpperCase() ?? '?'}
                                    </div>
                                    <div className="member-info">
                                        <span className="item-name">{m.name}</span>
                                        <span className="muted-sm">{m.done}/{m.total} done</span>
                                    </div>
                                    <span className="badge">{m.in_progress} active</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}