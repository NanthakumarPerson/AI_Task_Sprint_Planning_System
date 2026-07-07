// src/pages/DevDashboardPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyTasks } from '../api/tasks';
import { getSprints } from '../api/sprint';
import {
    formatDate, getUser, priorityClass, taskTypeClass,
    statusLabel, daysRemaining, getErrorMessage,
} from '../utils/helpers';

/**
 * DevDashboardPage Component
 * --------------------------------------------------------------------------------
 * A personalized dashboard layout for Developers and Testers.
 * Highlights tasks assigned specifically to the logged-in user, metrics breakdown
 * by status, active sprints, and a list of tasks due soon.
 * --------------------------------------------------------------------------------
 */
export default function DevDashboardPage() {
    // Retrieve logged-in user context
    const userObj = getUser();
    // Role 4 refers to a Tester
    const isTester = userObj?.role_id === 4;

    // Local State Variables
    const [myTasks, setMyTasks] = useState([]);         // Stores list of tasks assigned to the user
    const [activeSprints, setActiveSprints] = useState([]); // Stores active sprints that include today
    const [loading, setLoading] = useState(true);        // Spinner flag during fetch requests
    const [error, setError] = useState('');              // Error alert messages

    /**
     * load Callback
     * Fetches user tasks and sprints from the backend APIs concurrently,
     * filters active sprints based on the current date, and saves them to local states.
     */
    const load = useCallback(async () => {
        try {
            const [tasksRes, sprintsRes] = await Promise.all([
                getMyTasks(),
                getSprints(),
            ]);
            const tasks = tasksRes.data.data?.tasks || [];
            setMyTasks(tasks);

            // Establish "today" object with hours cleared for accurate date-range comparing
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const allSprints = sprintsRes.data.data || [];
            // Filter sprints that have 'active' status and cover the current calendar date
            const active = allSprints.filter(s => {
                if (s.status !== 'active') return false;
                const start = new Date(s.start_date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(s.end_date);
                end.setHours(0, 0, 0, 0);
                return start <= today && end >= today;
            });
            setActiveSprints(active);
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to load dashboard.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load data once when the component mounts
    useEffect(() => { load(); }, [load]);

    // Loading & Error boundary components
    if (loading) return <div className="page-center"><div className="spinner" /></div>;
    if (error)   return <div className="page-center"><p className="form-error">{error}</p></div>;

    // ── Counts calculation ──
    // Iterate through assigned tasks and count occurrence by status key
    const counts = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
    myTasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

    // ── Due-soon tasks filtering ──
    // Extract top 5 upcoming tasks with valid due dates, excluding completed tasks (DONE), sorted by closest date
    const dueSoon = [...myTasks]
        .filter(t => t.due_date && t.status !== 'DONE')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 5);

    // Text label updates according to user role (Testers view a Testing Board)
    const boardLabel = isTester ? 'Testing Board' : 'Sprint Board';

    return (
        <div className="page">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">My Dashboard</h1>
                <Link to="/my-sprint-board" className="btn btn-primary">
                    Open {boardLabel}
                </Link>
            </div>

            {/* ── Status Count Cards ── */}
            <div className="summary-cards">
                <div className="summary-card border-blue">
                    <span className="summary-label">Total Assigned</span>
                    <span className="summary-value">{myTasks.length}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">To Do</span>
                    <span className="summary-value">{counts.TODO}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">In Progress</span>
                    <span className="summary-value" style={{ color: 'var(--color-primary)' }}>{counts.IN_PROGRESS}</span>
                </div>
                <div className="summary-card border-amber">
                    <span className="summary-label">In Review</span>
                    <span className="summary-value" style={{ color: 'var(--color-warning)' }}>{counts.IN_REVIEW}</span>
                </div>
                <div className="summary-card border-green">
                    <span className="summary-label">Done</span>
                    <span className="summary-value" style={{ color: 'var(--color-success)' }}>{counts.DONE}</span>
                </div>
            </div>

            {/* ── Active Sprints Section ── */}
            {activeSprints.length > 0 && (
                <>
                    <h3 className="section-heading" style={{ marginTop: 24 }}>Active Sprints</h3>
                    <div className="dev-sprints-container">
                        {activeSprints.map(sprint => {
                            const days = daysRemaining(sprint.end_date);
                            // Highlight in red if 3 days or fewer are remaining in the sprint
                            const urgent = days !== null && days <= 3;
                            return (
                                <div key={sprint.id} className="card dev-sprint-info">
                                    <div className="dev-sprint-info-grid">
                                        <div className="dev-sprint-info-item">
                                            <span className="label">Sprint</span>
                                            <span className="value" style={{ fontWeight: 600 }}>{sprint.name}</span>
                                        </div>
                                        {sprint.goal && (
                                            <div className="dev-sprint-info-item">
                                                <span className="label">Goal</span>
                                                <span className="value">{sprint.goal}</span>
                                            </div>
                                        )}
                                        <div className="dev-sprint-info-item">
                                            <span className="label">Start</span>
                                            <span className="value">{formatDate(sprint.start_date)}</span>
                                        </div>
                                        <div className="dev-sprint-info-item">
                                            <span className="label">End</span>
                                            <span className="value">{formatDate(sprint.end_date)}</span>
                                        </div>
                                        <div className="dev-sprint-info-item">
                                            <span className="label">Days Remaining</span>
                                            <span className="value" style={{ color: urgent ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                                                {days === null ? '—' : days > 0 ? `${days} days` : 'Ended'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ── Due Soon Tasks Table ── */}
            <h3 className="section-heading" style={{ marginTop: 24 }}>Due Soon</h3>
            {dueSoon.length === 0 ? (
                <div className="card empty-state"><p>No upcoming due dates.</p></div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Task</th>
                                <th>Project</th>
                                <th>Sprint</th>
                                <th>Priority</th>
                                <th>Due Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dueSoon.map(task => {
                                const days = daysRemaining(task.due_date);
                                const overdue = days !== null && days < 0;
                                const soonUrgent = days !== null && days <= 3 && days >= 0;
                                return (
                                    <tr key={task.id}>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span className="jira-card-key">TASK-{task.id}</span>
                                                <span style={{ fontWeight: 500 }}>{task.title}</span>
                                                <span className={`badge ${taskTypeClass(task.task_type)}`} style={{ alignSelf: 'flex-start', fontSize: 11 }}>
                                                    {task.task_type}
                                                </span>
                                            </div>
                                        </td>
                                        <td>{task.project_name || '—'}</td>
                                        <td>{task.sprint_name || '—'}</td>
                                        <td>
                                            <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>
                                        </td>
                                        {/* Highlight dates dynamically: Red if overdue, amber if due in <= 3 days */}
                                        <td style={{ color: overdue ? '#dc2626' : soonUrgent ? '#d97706' : undefined, fontWeight: (overdue || soonUrgent) ? 600 : undefined }}>
                                            {formatDate(task.due_date)}
                                            {overdue && <span style={{ fontSize: 11, marginLeft: 4 }}>Overdue</span>}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
