// src/pages/SprintBoardPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTasks, updateTaskStatus, updateTask, reassignTask } from '../api/tasks';
import { getTeamUsers } from '../api/auth';
import { getSprintReport } from '../api/sprint';
import SkeletonLoader from '../components/SkeletonLoader';
import {
    priorityClass, taskTypeClass, getUser, formatDate,
    statusLabel, statusAction, getErrorMessage,
} from '../utils/helpers';
import {
    STATUS_OPTIONS,
    PRIORITY_OPTIONS,
    TASK_TYPE_OPTIONS,
} from '../utils/constants';

// Board status columns definition mapping status keys to styling color attributes
const COLUMNS = [
    { key: 'TODO',        label: 'To Do',      color: '#64748b' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#2563eb' },
    { key: 'IN_REVIEW',   label: 'In Review',   color: '#d97706' },
    { key: 'DONE',        label: 'Done',        color: '#16a34a' },
];

/**
 * SprintBoardPage Component
 * --------------------------------------------------------------------------------
 * A comprehensive Kanban Board layout accessible by PMs, Developers, and Testers.
 * Manages sprint board tasks, supports editing task details, dragging/moving task
 * statuses, filtering tasks by assignee/priority/type, and inline team reassignments.
 * --------------------------------------------------------------------------------
 */
export default function SprintBoardPage({ activeSprintId }) {
    // Extract sprint ID from URL params if loaded via routes
    const { sprintId: paramSprintId } = useParams();
    const sprintId = activeSprintId || paramSprintId;

    // Local State Variables
    const [tasks, setTasks] = useState([]);         // List of tasks matching the sprint ID
    const [sprint, setSprint] = useState(null);       // Active sprint details (name, dates, goal)
    const [loading, setLoading] = useState(true);    // Skeleton rendering loader
    const [error, setError] = useState('');          // Network errors string
    const [updating, setUpdating] = useState(false);  // Status update indicator
    const [selectedTask, setSelectedTask] = useState(null); // Tracks task currently in focus inside details modal

    // Filter states
    const [filterPriority, setFilterPriority] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('all');

    // Editing states
    const [teamUsers, setTeamUsers] = useState([]);        // Complete team member listings for reassignment selectors
    const [showEditTask, setShowEditTask] = useState(null);  // Tracks task ID currently edited in modal
    const [editTaskForm, setEditTaskForm] = useState({});   // Buffer form state for task updates

    // Load team users list on initial mount
    useEffect(() => {
        getTeamUsers().then(res => setTeamUsers(res.data.data || [])).catch(() => {});
    }, []);

    // Determine current user permissions
    const userObj = getUser();
    const isTeamMember = userObj && (userObj.role_id === 3 || userObj.role_id === 4);
    const isPmOrAdmin  = userObj?.role_id === 1 || userObj?.role_id === 2;

    /**
     * loadBoard Callback
     * Fetches the sprint metadata and related task lists from backend APIs.
     */
    const loadBoard = useCallback(async () => {
        if (!sprintId) return;
        try {
            const [tasksRes, sprintRes] = await Promise.all([
                getTasks({ sprint_id: sprintId, limit: 100 }),
                getSprintReport(sprintId),
            ]);
            setTasks(tasksRes.data.data?.tasks || []);
            setSprint(sprintRes.data.data?.sprint || null);
        } catch {
            setError('Failed to load sprint board.');
        } finally {
            setLoading(false);
        }
    }, [sprintId]);

    // Reload board whenever the callback updates or sprintId changes
    useEffect(() => {
        loadBoard();
    }, [loadBoard]);

    /**
     * handleReassign Function
     * Calls reassign task API, then reloads the board to update assignees inline.
     */
    const handleReassign = async (taskId, newAssigneeId) => {
        try {
            await reassignTask(taskId, { assignee_id: newAssigneeId ? parseInt(newAssigneeId) : null });
            await loadBoard();
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to reassign task.');
        }
    };

    /**
     * handleOpenEdit Function
     * Opens the Edit Task modal and populates the buffer state with existing task details.
     */
    const handleOpenEdit = (task) => {
        setShowEditTask(task.id);
        setEditTaskForm({
            title:           task.title,
            description:     task.description || '',
            task_type:       task.task_type,
            priority:        task.priority,
            assignee_id:     task.assignee_id || '',
            due_date:        task.due_date || '',
            estimated_hours: task.estimated_hours ?? '',
        });
    };

    /**
     * handleUpdateTask Function
     * Triggered on edit form submission. Validates fields, sends update request, and reloads data.
     */
    const handleUpdateTask = async (e, taskId) => {
        e.preventDefault();
        try {
            await updateTask(taskId, {
                title:           editTaskForm.title.trim(),
                description:     editTaskForm.description.trim() || null,
                task_type:       editTaskForm.task_type,
                priority:        editTaskForm.priority,
                assignee_id:     editTaskForm.assignee_id ? parseInt(editTaskForm.assignee_id) : null,
                due_date:        editTaskForm.due_date || null,
                estimated_hours: editTaskForm.estimated_hours !== '' ? parseFloat(editTaskForm.estimated_hours) : null,
            });
            setShowEditTask(null);
            await loadBoard();
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to update task.');
        }
    };

    /**
     * handleStatusChange Function
     * Prevents moving a task backward if it is already completed ('DONE'),
     * sends status transition request, and reloads board data.
     */
    const handleStatusChange = async (task, newStatus) => {
        if (task.status === 'DONE' && newStatus !== 'DONE') {
            alert("Task status cannot be moved backwards from Done.");
            return;
        }
        setUpdating(true);
        try {
            await updateTaskStatus(task.id, { status: newStatus });
            await loadBoard();
        } catch (e) {
            alert(e?.response?.data?.detail || e?.response?.data?.message || 'Failed to update status.');
        } finally {
            setUpdating(false);
        }
    };

    const closeTaskModal = () => setSelectedTask(null);

    // ── Apply filters to tasks list ──
    const filteredTasks = tasks.filter((t) => {
        if (filterPriority && t.priority !== filterPriority) return false;
        if (filterType     && t.task_type !== filterType)    return false;
        if (filterStatus   && t.status !== filterStatus)     return false;
        if (filterAssignee === 'my'     && t.assignee_id !== userObj?.id) return false;
        if (filterAssignee === 'review' && t.status !== 'IN_REVIEW')      return false;
        return true;
    });

    // Bucket filtered tasks into their respective columns mapping
    const tasksByStatus = COLUMNS.reduce((acc, col) => {
        acc[col.key] = filteredTasks.filter((t) => t.status === col.key);
        return acc;
    }, {});

    const hasFilters = filterPriority || filterType || filterStatus || filterAssignee !== 'all';

    // Skeleton loaders mimicking column grids
    if (loading) {
        return (
            <div className="page page-wide">
                <div className="page-header">
                    <SkeletonLoader count={1} height={40} style={{ width: '300px' }} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <SkeletonLoader count={3} height={100} style={{ flex: 1 }} />
                    <SkeletonLoader count={3} height={100} style={{ flex: 1 }} />
                    <SkeletonLoader count={3} height={100} style={{ flex: 1 }} />
                    <SkeletonLoader count={3} height={100} style={{ flex: 1 }} />
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="page-center"><p className="form-error">{error}</p></div>;
    }

    const sprintStatus = sprint?.status;

    return (
        <div className="page page-wide">
            {/* Header info */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {sprint?.name ?? `Sprint #${sprintId}`}
                    </h1>
                    {sprint && (
                        <div className="badge badge-info" style={{ marginTop: '8px', padding: '6px 14px', fontSize: '13px' }}>
                            {formatDate(sprint.start_date)} ➔ {formatDate(sprint.end_date)}
                        </div>
                    )}
                </div>
                {!activeSprintId && (
                    <Link to="/dashboard" className="btn">
                        ← Dashboard
                    </Link>
                )}
            </div>

            {/* ── Filter Toolbar row ── */}
            <div className="filter-bar" style={{ alignItems: 'center' }}>
                {isTeamMember ? (
                    <select
                        className="form-input filter-select"
                        value={filterAssignee}
                        onChange={(e) => setFilterAssignee(e.target.value)}
                    >
                        <option value="all">All Assigned Tasks</option>
                        <option value="my">My Tasks</option>
                        {userObj?.role_id === 4 && (
                            <option value="review">Review Tasks</option>
                        )}
                    </select>
                ) : (
                    <select
                        className="form-input filter-select"
                        value={filterAssignee}
                        onChange={(e) => setFilterAssignee(e.target.value)}
                    >
                        <option value="all">All Assignees</option>
                        <option value="my">My Tasks</option>
                    </select>
                )}

                <select
                    className="form-input filter-select"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                >
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                <select
                    className="form-input filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="">All types</option>
                    {TASK_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                <select
                    className="form-input filter-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                {hasFilters && (
                    <button
                        className="btn"
                        onClick={() => {
                            setFilterPriority('');
                            setFilterType('');
                            setFilterStatus('');
                            setFilterAssignee('all');
                        }}
                    >
                        Clear
                    </button>
                )}

                <span className="muted-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ── Kanban columns mapping ── */}
            <div className="board">
                {COLUMNS.map((col) => (
                    <div key={col.key} className={`board-column col-${col.key}`}>
                        {/* Column Header */}
                        <div className="board-col-header">
                            <span className="board-col-title" style={{ color: col.color }}>
                                {col.label}
                            </span>
                            <span className="board-col-count">
                                {tasksByStatus[col.key].length}
                            </span>
                        </div>

                        {/* Column Body */}
                        <div className="board-col-body">
                            {tasksByStatus[col.key].length === 0 ? (
                                <p className="board-empty">No tasks</p>
                            ) : (
                                tasksByStatus[col.key].map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onStatusChange={handleStatusChange}
                                        onEdit={() => handleOpenEdit(task)}
                                        onReassign={(id) => handleReassign(task.id, id)}
                                        onOpen={() => setSelectedTask(task)}
                                        teamUsers={teamUsers}
                                        isPmOrAdmin={isPmOrAdmin}
                                        sprintStatus={sprintStatus}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Edit Task Modal overlay ── */}
            {showEditTask && (
                <div className="overlay" onClick={() => setShowEditTask(null)}>
                    <div className="modal" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Edit Task</h2>
                            <button className="btn-icon" onClick={() => setShowEditTask(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <form onSubmit={(e) => handleUpdateTask(e, showEditTask)} id="boardEditTaskForm">
                                <div className="form-group">
                                    <label className="form-label">Title <span className="required">*</span></label>
                                    <input className="form-input" type="text"
                                        value={editTaskForm.title}
                                        onChange={e => setEditTaskForm(f => ({ ...f, title: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-input" rows={3}
                                        value={editTaskForm.description}
                                        onChange={e => setEditTaskForm(f => ({ ...f, description: e.target.value }))}
                                    />
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Task Type <span className="required">*</span></label>
                                        <select className="form-input" value={editTaskForm.task_type}
                                            onChange={e => setEditTaskForm(f => ({ ...f, task_type: e.target.value }))}>
                                            {TASK_TYPE_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority <span className="required">*</span></label>
                                        <select className="form-input" value={editTaskForm.priority}
                                            onChange={e => setEditTaskForm(f => ({ ...f, priority: e.target.value }))}>
                                            {PRIORITY_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Assignee</label>
                                        <select className="form-input" value={editTaskForm.assignee_id}
                                            onChange={e => setEditTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                                            <option value="">Unassigned</option>
                                            {teamUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input className="form-input" type="date"
                                            value={editTaskForm.due_date}
                                            onChange={e => setEditTaskForm(f => ({ ...f, due_date: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estimated Hours</label>
                                    <input className="form-input" type="number" step="0.5" min="0"
                                        value={editTaskForm.estimated_hours}
                                        onChange={e => setEditTaskForm(f => ({ ...f, estimated_hours: e.target.value }))}
                                        style={{ maxWidth: 200 }}
                                        placeholder="e.g. 4"
                                    />
                                    <p className="muted-sm" style={{ marginTop: 4 }}>Can be set or updated at any sprint stage.</p>
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer form-actions-row">
                            <button type="submit" form="boardEditTaskForm" className="btn btn-primary">Save Changes</button>
                            <button className="btn btn-secondary" onClick={() => setShowEditTask(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Task Detail Modal overlay ── */}
            {selectedTask && (
                <div className="overlay" onClick={closeTaskModal}>
                    <div className="modal" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600 }}>
                                    TASK-{selectedTask.id}
                                </p>
                                <h2 className="modal-title" style={{ margin: 0 }}>{selectedTask.title}</h2>
                            </div>
                            <button className="btn-icon" onClick={closeTaskModal}>✕</button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                            {/* Badges block */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px', marginBottom: 20 }}>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Status</p>
                                    <span className={`badge badge-${selectedTask.status}`}>
                                        {statusLabel(selectedTask.status)}
                                    </span>
                                </div>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Priority</p>
                                    <span className={`badge ${priorityClass(selectedTask.priority)}`}>
                                        {selectedTask.priority}
                                    </span>
                                </div>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Type</p>
                                    <span className={`badge ${taskTypeClass(selectedTask.task_type)}`}>
                                        {selectedTask.task_type}
                                    </span>
                                </div>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Sprint</p>
                                    <span>{selectedTask.sprint_name || '—'}</span>
                                </div>
                            </div>

                            {/* Assignee / Hours blocks */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 28px', marginBottom: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Assignee</p>
                                    <span>{selectedTask.assignee_name || 'Unassigned'}</span>
                                </div>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Due Date</p>
                                    <span>{selectedTask.due_date ? formatDate(selectedTask.due_date) : '—'}</span>
                                </div>
                                <div>
                                    <p className="label" style={{ marginBottom: 4 }}>Est. Hours</p>
                                    <span>{selectedTask.estimated_hours != null ? `${selectedTask.estimated_hours}h` : '—'}</span>
                                </div>
                            </div>

                            {/* Description block */}
                            {selectedTask.description && (
                                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-color)', marginBottom: 16 }}>
                                    <p className="label" style={{ marginBottom: 8 }}>Description</p>
                                    <div style={{
                                        background: 'var(--bg-secondary, #f8fafc)',
                                        padding: '12px 14px',
                                        borderRadius: 6,
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        {selectedTask.description}
                                    </div>
                                </div>
                            )}

                            {/* PM-only Actions row */}
                            {isPmOrAdmin && sprintStatus !== 'completed' && (
                                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                    <p className="label" style={{ marginBottom: 8 }}>Actions</p>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { closeTaskModal(); handleOpenEdit(selectedTask); }}
                                        >
                                            ✏️ Edit Task
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="muted-sm">Reassign:</span>
                                            <select
                                                className="form-input filter-select"
                                                style={{ margin: 0, height: 32, fontSize: '0.8rem' }}
                                                value={selectedTask.assignee_id || ''}
                                                onChange={(e) => {
                                                    handleReassign(selectedTask.id, e.target.value);
                                                    closeTaskModal();
                                                }}
                                            >
                                                <option value="">Unassigned</option>
                                                {teamUsers.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn" onClick={closeTaskModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * TaskCard Component
 * --------------------------------------------------------------------------------
 * Renders an interactive card representing a task on the Kanban board.
 * Supports status transitions via a dropdown menu, inline reassignment for PMs,
 * and clicking to open the main details modal.
 * --------------------------------------------------------------------------------
 */
function TaskCard({ task, onStatusChange, onEdit, onReassign, onOpen, teamUsers, isPmOrAdmin, sprintStatus }) {
    const [showMenu, setShowMenu] = useState(false);

    // List of statuses the task can transition to (excluding its current status)
    const nextStatuses = STATUS_OPTIONS.map((o) => o.value).filter(
        (s) => s !== task.status
    );

    return (
        <div
            className="jira-card"
            onClick={onOpen}
            style={{ cursor: 'pointer' }}
        >
            {/* Identity details */}
            <div className="jira-card-key">TASK-{task.id}</div>
            <div className="jira-card-title">{task.title}</div>

            {/* Badges block */}
            <div className="jira-card-meta">
                <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>
                <span className={`badge ${taskTypeClass(task.task_type)}`}>{task.task_type}</span>
            </div>

            {/* Context details */}
            <div className="jira-card-details">
                {task.assignee_name && <span className="jira-card-detail">👤 {task.assignee_name}</span>}
                {task.due_date      && <span className="jira-card-detail">📅 {formatDate(task.due_date)}</span>}
                {task.estimated_hours != null && <span className="jira-card-detail">⏱ {task.estimated_hours}h</span>}
            </div>

            {/* Actions block - stopPropagation avoids triggering card modal */}
            <div className="jira-card-footer" onClick={(e) => e.stopPropagation()}>
                {/* Status Move selector */}
                <div className="status-menu-wrap">
                    <button
                        className="btn btn-sm"
                        disabled={task.status === 'DONE' || sprintStatus === 'completed'}
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        Move →
                    </button>
                    {showMenu && (
                        <div className="status-menu">
                            {nextStatuses.map((s) => (
                                <button
                                    key={s}
                                    className="status-menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onStatusChange(task, s);
                                    }}
                                >
                                    {statusLabel(s)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inline PM Tools (Edit + Assignee select) */}
                {isPmOrAdmin && (
                    <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            disabled={sprintStatus === 'completed'}
                        >
                            ✏️ Edit
                        </button>
                        <select
                            className="form-input filter-select"
                            style={{ padding: '2px 4px', fontSize: '0.75rem', height: '24px', minWidth: '80px', margin: 0 }}
                            value={task.assignee_id || ''}
                            onChange={(e) => { e.stopPropagation(); onReassign(e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={sprintStatus === 'completed'}
                        >
                            <option value="">Unassigned</option>
                            {teamUsers?.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}