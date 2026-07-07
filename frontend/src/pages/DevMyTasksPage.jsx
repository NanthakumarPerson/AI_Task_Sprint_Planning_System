// src/pages/DevMyTasksPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { getMyTasks, updateTaskStatus } from '../api/tasks';
import { getSprints } from '../api/sprint';
import {
    formatDate, getUser, priorityClass, taskTypeClass,
    statusLabel, getErrorMessage,
} from '../utils/helpers';
import { PRIORITY_OPTIONS } from '../utils/constants';
import { TaskDetailModal } from './DevSprintBoardPage';

/**
 * DevMyTasksPage Component
 * --------------------------------------------------------------------------------
 * Displays a tabular list of all tasks assigned to the current Developer or Tester.
 * Supports filtering by sprint and priority, opening a detailed modal, and moving
 * tasks through their workflow stages.
 * --------------------------------------------------------------------------------
 */
export default function DevMyTasksPage() {
    // Determine user role details
    const userObj = getUser();
    const isTester = userObj?.role_id === 4;

    // Local State Variables
    const [myTasks, setMyTasks]       = useState([]);         // Complete list of assigned tasks
    const [sprints, setSprints]       = useState([]);         // List of active sprints derived from tasks for the dropdown filter
    const [filterSprint, setFilterSprint]   = useState('');   // Selected sprint filter ID
    const [filterPriority, setFilterPriority] = useState(''); // Selected priority filter key
    const [loading, setLoading]       = useState(true);        // Initial page spinner state
    const [error, setError]           = useState('');          // Global API error messages
    const [updatingTaskId, setUpdatingTaskId] = useState(null); // Tracks ID of a task currently updating state to show spinner inside modal/button
    const [selectedTask, setSelectedTask] = useState(null);   // Tracks active task loaded inside the Detail Modal

    /**
     * load Callback
     * Fetches user tasks and all sprint configurations. Finds which sprints actually
     * contain the user's tasks to populate the filter dropdown list.
     */
    const load = useCallback(async () => {
        try {
            const [tasksRes, sprintsRes] = await Promise.all([
                getMyTasks(),
                getSprints(),
            ]);
            const tasks = tasksRes.data.data?.tasks || [];
            setMyTasks(tasks);

            // Build sprint filter list from sprints that appear in tasks
            const mySprintIds = new Set(tasks.map(t => t.sprint_id).filter(Boolean));
            const allSprints = sprintsRes.data.data || [];
            setSprints(allSprints.filter(s => mySprintIds.has(s.id)));
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to load tasks.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Perform initial data fetching on page mount
    useEffect(() => { load(); }, [load]);

    /**
     * handleStatusAction Function
     * Handles transitioning task status to the next state (e.g., TODO -> IN_PROGRESS -> IN_REVIEW -> DONE).
     * Imports the helper function dynamically to calculate the next state, sends the update request,
     * and refreshes local task states to update the table data.
     */
    async function handleStatusAction(task) {
        // Dynamically import status utilities
        const { statusAction } = await import('../utils/helpers');
        const action = statusAction(task.status);
        if (action.disabled || !action.nextStatus) return;
        
        setUpdatingTaskId(task.id);
        try {
            // Put request to transition task status
            await updateTaskStatus(task.id, { status: action.nextStatus });
            // Retrieve refreshed tasks from database
            const res = await getMyTasks();
            const updated = res.data.data?.tasks || [];
            setMyTasks(updated);
            
            // If the updated task is currently viewed in the modal, synchronize the modal's state
            if (selectedTask?.id === task.id) {
                setSelectedTask(updated.find(t => t.id === task.id) || null);
            }
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to update status.');
        } finally {
            setUpdatingTaskId(null);
        }
    }

    // Loading & Error boundary components
    if (loading) return <div className="page-center"><div className="spinner" /></div>;
    if (error)   return <div className="page-center"><p className="form-error">{error}</p></div>;

    // ── Apply filters to tasks list ──
    const filtered = myTasks.filter(t => {
        if (filterSprint   && t.sprint_id !== Number(filterSprint)) return false;
        if (filterPriority && t.priority !== filterPriority)         return false;
        return true;
    });

    const hasFilter = filterSprint || filterPriority;
    const tableTitle = isTester ? 'My Test Tasks' : 'My Tasks';

    return (
        <div className="page page-wide">
            {/* Page Title */}
            <div className="page-header">
                <h1 className="page-title">{tableTitle}</h1>
            </div>

            {/* ── Filter Dropdowns Bar ── */}
            <div className="filter-bar" style={{ marginBottom: 20 }}>
                {/* Sprint Filter */}
                <select
                    className="form-input filter-select"
                    value={filterSprint}
                    onChange={e => setFilterSprint(e.target.value)}
                >
                    <option value="">All Sprints</option>
                    {sprints.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>

                {/* Priority Filter */}
                <select
                    className="form-input filter-select"
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                >
                    <option value="">All Priorities</option>
                    {PRIORITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                {/* Reset button shown only when active filters exist */}
                {hasFilter && (
                    <button className="btn" onClick={() => { setFilterSprint(''); setFilterPriority(''); }}>
                        Clear Filters
                    </button>
                )}

                {/* Task counter status */}
                <span className="muted-sm">
                    {filtered.length} task{filtered.length !== 1 ? 's' : ''}
                    {hasFilter ? ` (filtered from ${myTasks.length})` : ''}
                </span>
            </div>

            {/* ── Task Listing Table ── */}
            <div className="card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Task ID</th>
                            <th>Title</th>
                            <th>Project</th>
                            <th>Sprint</th>
                            <th>Priority</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                                    No tasks found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(task => (
                                <tr key={task.id}>
                                    <td>
                                        <span className="jira-card-key">TASK-{task.id}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                                    <td>{formatDate(task.due_date)}</td>
                                    <td>
                                        <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {/* Modal Trigger */}
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ padding: '4px 12px', fontSize: 13 }}
                                            onClick={() => setSelectedTask(task)}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Task Detail Modal ── */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onAction={handleStatusAction}
                    updating={updatingTaskId === selectedTask.id}
                />
            )}
        </div>
    );
}
