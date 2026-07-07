// src/pages/DevSprintBoardPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { getMyTasksBySprint, updateTaskStatus, addTaskComment } from '../api/tasks';
import { getMySprints } from '../api/sprint';
import {
    formatDate, getUser, priorityClass, taskTypeClass,
    statusLabel, statusAction, getErrorMessage,
} from '../utils/helpers';
import { PRIORITY_OPTIONS } from '../utils/constants';
import { classifySprint } from '../utils/sprintHelpers';

// Columns definition for the Kanban Board layout mapping task states to styles
const COLUMNS = [
    { key: 'TODO',        label: 'To Do',      color: '#475569' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#1d4ed8' },
    { key: 'IN_REVIEW',   label: 'In Review',   color: '#92400e' },
    { key: 'DONE',        label: 'Done',        color: '#15803d' },
];

/**
 * DevSprintBoardPage Component
 * --------------------------------------------------------------------------------
 * A Kanban board view tailored for Developers and Testers to drag, view, and transition
 * tasks assigned to them within the active/planning sprints.
 * --------------------------------------------------------------------------------
 */
export default function DevSprintBoardPage() {
    // Check logged-in user role
    const userObj = getUser();
    const isTester = userObj?.role_id === 4;

    // State Variables
    const [myTasks, setMyTasks]         = useState([]);             // Holds tasks for the selected sprint
    const [activeSprints, setActiveSprints] = useState([]);         // Sprints list matching user assignments
    const [selectedSprintId, setSelectedSprintId] = useState(null); // Selected sprint tab ID
    const [filterPriority, setFilterPriority] = useState('');       // Selected priority dropdown value
    const [loading, setLoading]         = useState(true);            // Page spinner loader
    const [error, setError]             = useState('');              // Global API fetch errors
    const [updatingTaskId, setUpdatingTaskId] = useState(null);     // Tracks IDs transitioning status
    const [selectedTask, setSelectedTask] = useState(null);      // Current task details loaded in modal

    /**
     * loadSprints Callback
     * Fetches user's relevant sprints, sorts them chronologically by start date,
     * and sets the active sprint as the default selected board.
     */
    const loadSprints = useCallback(async () => {
        try {
            const sprintsRes = await getMySprints();
            const relevant = sprintsRes.data.data || [];
            
            // Sort sprints chronologically
            relevant.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
            setActiveSprints(relevant);

            if (relevant.length > 0) {
                const active = relevant.find(s => classifySprint(s).label === 'Active');
                // Select active sprint by default, falling back to first sprint if none is active
                setSelectedSprintId(prev => prev ?? (active ? active.id : relevant[0].id));
            }
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to load sprint board.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load user's sprints on initial render
    useEffect(() => { loadSprints(); }, [loadSprints]);

    // Load tasks whenever the selected sprint ID changes
    useEffect(() => {
        if (!selectedSprintId) {
            setMyTasks([]);
            return;
        }
        async function fetchTasks() {
            try {
                const res = await getMyTasksBySprint(selectedSprintId);
                setMyTasks(res.data.data?.tasks || []);
            } catch(err) {
                console.error(err);
            }
        }
        fetchTasks();
    }, [selectedSprintId]);

    /**
     * handleStatusAction Function
     * Moves the task forward to its next status (e.g. TODO -> IN_PROGRESS),
     * updates the database, refetches tasks for the active sprint, and syncs open modals.
     */
    async function handleStatusAction(task) {
        const action = statusAction(task.status);
        if (action.disabled || !action.nextStatus) return;
        setUpdatingTaskId(task.id);
        try {
            await updateTaskStatus(task.id, { status: action.nextStatus });
            // Refresh tasks list for current sprint & close modal if open
            const res = await getMyTasksBySprint(selectedSprintId);
            const updated = res.data.data?.tasks || [];
            setMyTasks(updated);
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

    // ── Filter tasks to selected sprint + priority ──
    const boardTasks = myTasks.filter(t => {
        if (selectedSprintId && t.sprint_id !== selectedSprintId) return false;
        if (filterPriority && t.priority !== filterPriority) return false;
        return true;
    });

    // Bucket tasks into columns based on status keys
    const tasksByStatus = {};
    COLUMNS.forEach(col => { tasksByStatus[col.key] = []; });
    boardTasks.forEach(t => {
        if (tasksByStatus[t.status]) tasksByStatus[t.status].push(t);
    });

    const boardTitle = isTester ? 'Testing Board' : 'Sprint Board';
    const selectedSprint = activeSprints.find(s => s.id === selectedSprintId);

    return (
        <div className="page page-wide">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">{boardTitle}</h1>
            </div>

            {/* ── Sprint Selector + Priority Filter Row ── */}
            <div className="filter-bar" style={{ marginBottom: 20 }}>
                {activeSprints.length === 0 ? (
                    <p className="muted">No active sprint tasks assigned to you.</p>
                ) : (
                    <select
                        id="sprint-select"
                        className="form-input filter-select"
                        value={selectedSprintId ?? ''}
                        onChange={e => setSelectedSprintId(Number(e.target.value))}
                    >
                        {activeSprints.map(s => {
                            const { label } = classifySprint(s);
                            return (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({label})
                                </option>
                            );
                        })}
                    </select>
                )}

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

                {filterPriority && (
                    <button className="btn" onClick={() => setFilterPriority('')}>Clear</button>
                )}

                <span className="muted-sm">{boardTasks.length} task{boardTasks.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Warning alert if selected sprint has ended */}
            {selectedSprint && (
                <div style={{ marginBottom: 16 }}>
                    <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                        {selectedSprint.name} · {formatDate(selectedSprint.start_date)} – {formatDate(selectedSprint.end_date)}
                    </p>
                    {classifySprint(selectedSprint).label === 'Ended' && (
                        <div className="alert alert-warning" style={{ padding: '12px 16px', borderRadius: 6, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                            This sprint has ended. Your PM will close it or move unfinished tasks soon.
                        </div>
                    )}
                </div>
            )}

            {/* ── Kanban Board Columns Grid ── */}
            <div className="board">
                {COLUMNS.map(col => (
                    <div key={col.key} className="board-column">
                        <div className="board-col-header">
                            <span className="board-col-title" style={{ color: col.color }}>{col.label}</span>
                            <span className="board-col-count">{tasksByStatus[col.key].length}</span>
                        </div>
                        <div className="board-col-body">
                            {tasksByStatus[col.key].length === 0 ? (
                                <p className="board-empty">No tasks</p>
                            ) : (
                                tasksByStatus[col.key].map(task => (
                                    <DevTaskCard
                                        key={task.id}
                                        task={task}
                                        onAction={handleStatusAction}
                                        updating={updatingTaskId === task.id}
                                        onClick={() => setSelectedTask(task)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Task Detail Modal overlay ── */}
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

/**
 * DevTaskCard Component
 * --------------------------------------------------------------------------------
 * A single card representation inside the Kanban board column.
 * Displays key details, priority levels, estimated hours, and a quick-transition button.
 * --------------------------------------------------------------------------------
 */
function DevTaskCard({ task, onAction, updating, onClick }) {
    const action = statusAction(task.status);
    const btnClass = task.status === 'TODO' ? 'btn-start'
        : task.status === 'IN_PROGRESS' ? 'btn-review'
        : task.status === 'IN_REVIEW' ? 'btn-done'
        : 'btn-completed';

    return (
        <div className="jira-card" style={{ cursor: 'pointer' }} onClick={onClick}>
            <div className="jira-card-key">TASK-{task.id}</div>
            <div className="jira-card-title">{task.title}</div>
            <div className="jira-card-meta">
                <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>
                <span className={`badge ${taskTypeClass(task.task_type)}`}>{task.task_type}</span>
            </div>
            <div className="jira-card-details">
                {task.due_date && <span className="jira-card-detail">📅 {formatDate(task.due_date)}</span>}
                {task.estimated_hours != null && <span className="jira-card-detail">⏱ {task.estimated_hours}h</span>}
            </div>
            {/* Stop propagation to avoid opening the modal when clicking the action button */}
            <div className="jira-card-footer" onClick={e => e.stopPropagation()}>
                <button
                    className={`btn-action ${btnClass}`}
                    disabled={action.disabled || updating}
                    onClick={() => onAction(task)}
                >
                    {updating ? 'Saving…' : action.label}
                </button>
            </div>
        </div>
    );
}

/**
 * TaskDetailModal Component
 * --------------------------------------------------------------------------------
 * Opens an overlay details modal displaying extensive metadata, task description,
 * acceptance criteria, risk factors, and a timeline comment box for progress notes.
 * --------------------------------------------------------------------------------
 */
export function TaskDetailModal({ task, onClose, onAction, updating }) {
    const action = statusAction(task.status);
    const btnClass = task.status === 'TODO' ? 'btn-start'
        : task.status === 'IN_PROGRESS' ? 'btn-review'
        : task.status === 'IN_REVIEW' ? 'btn-done'
        : 'btn-completed';

    // Modal Input States
    const [commentText, setCommentText] = useState('');                 // Stores new comment value
    const [submittingNote, setSubmittingNote] = useState(false);        // Note submit spinner flag
    const [localComments, setLocalComments] = useState(task.comments || []); // Local copy of comments to update instant UI feedback

    /**
     * handleAddNote Function
     * Calls POST api comment router to save note, appends username, and resets textbox on success.
     */
    const handleAddNote = async () => {
        if (!commentText.trim()) return;
        setSubmittingNote(true);
        try {
            const res = await addTaskComment(task.id, { comment: commentText });
            const newComment = res.data.data;
            // Append with author_name for instant UI update without waiting for full reload
            const userObj = getUser();
            setLocalComments([...localComments, { ...newComment, author_name: userObj?.name || 'Me' }]);
            setCommentText('');
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to add note.');
        } finally {
            setSubmittingNote(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 640, width: '92%' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Task Details</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                    {/* Key + Title */}
                    <p className="jira-card-key" style={{ fontSize: '0.8rem', marginBottom: 4 }}>TASK-{task.id}</p>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>{task.title}</h3>

                    {/* Metadata Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
                        <div><span className="label">Status</span><br />
                            <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
                        </div>
                        <div><span className="label">Priority</span><br />
                            <span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span>
                        </div>
                        <div><span className="label">Type</span><br />
                            <span className={`badge ${taskTypeClass(task.task_type)}`}>{task.task_type}</span>
                        </div>
                        <div><span className="label">Effort</span><br />
                            <span className="badge">{task.effort_points ?? '—'} pts</span>
                        </div>
                        <div><span className="label">Project</span><br />
                            <span>{task.project_name || '—'}</span>
                        </div>
                        <div><span className="label">Sprint</span><br />
                            <span>{task.sprint_name || '—'}</span>
                        </div>
                        <div><span className="label">Due Date</span><br />
                            <span>{formatDate(task.due_date)}</span>
                        </div>
                        <div><span className="label">Est. Hours</span><br />
                            <span>{task.estimated_hours != null ? `${task.estimated_hours}h` : '—'}</span>
                        </div>
                    </div>

                    {/* Description Paragraph */}
                    {task.description && (
                        <div style={{ marginBottom: 16 }}>
                            <p className="label" style={{ marginBottom: 4 }}>Description</p>
                            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0' }}>
                                {task.description}
                            </div>
                        </div>
                    )}

                    {/* Acceptance Criteria */}
                    {task.acceptance_criteria && (
                        <div style={{ marginBottom: 16 }}>
                            <p className="label" style={{ marginBottom: 4 }}>Acceptance Criteria</p>
                            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap', border: '1px solid #bbf7d0' }}>
                                {task.acceptance_criteria}
                            </div>
                        </div>
                    )}

                    {/* Risk notes */}
                    {task.risk_notes && (
                        <div style={{ marginBottom: 16 }}>
                            <p className="label" style={{ marginBottom: 4 }}>Risk Notes</p>
                            <div style={{ background: '#fff7ed', padding: '10px 14px', borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap', border: '1px solid #fed7aa' }}>
                                {task.risk_notes}
                            </div>
                        </div>
                    )}

                    {/* Progress Notes / Comments Area */}
                    <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Progress Notes</h4>
                        
                        {localComments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                                {localComments.map(c => (
                                    <div key={c.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                                            <span className="muted" style={{ fontSize: 12 }}>{formatDate(c.created_at)}</span>
                                        </div>
                                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>No notes yet.</p>
                        )}

                        {/* Add note text editor */}
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                            <textarea
                                className="form-input"
                                rows={2}
                                placeholder="Add a progress note..."
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                            />
                            <button 
                                className="btn btn-primary" 
                                style={{ alignSelf: 'flex-start' }}
                                onClick={handleAddNote}
                                disabled={submittingNote || !commentText.trim()}
                            >
                                {submittingNote ? 'Adding...' : 'Add Note'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="modal-footer">
                    {!action.disabled ? (
                        <button
                            className={`btn btn-primary ${btnClass}`}
                            disabled={updating}
                            onClick={() => onAction(task)}
                        >
                            {updating ? 'Saving…' : action.label}
                        </button>
                    ) : (
                        <span className="badge badge-DONE" style={{ fontSize: 14 }}>✓ Completed</span>
                    )}
                    <button className="btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
