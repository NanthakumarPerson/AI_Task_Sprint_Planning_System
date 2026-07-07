import React, { useState, useEffect } from 'react';
import { getBacklogTasks, assignSprint, deleteTask } from '../api/tasks';
import { getSprints } from '../api/sprint';
import { getTeamUsers } from '../api/auth';
import { getErrorMessage, priorityClass, taskTypeClass, statusLabel } from '../utils/helpers';
import SkeletonLoader from '../components/SkeletonLoader';
import { ROLE } from '../utils/constants';
import { classifySprint, SPRINT_STATE_LABELS } from '../utils/sprintHelpers';

/**
 * BacklogPage Component
 * --------------------------------------------------------------------------------
 * Manages backlog tasks (tasks that have not yet been assigned to a sprint).
 * Renders lists of unallocated items, allows managers to assign them to active/upcoming
 * sprints, view task details, or delete tasks.
 * --------------------------------------------------------------------------------
 */
export default function BacklogPage() {
    // Local State Variables
    const [tasks, setTasks] = useState([]);         // List of backlog tasks (sprint_id is null)
    const [loading, setLoading] = useState(true);    // Skeleton spinner indicator during fetch
    const [sprints, setSprints] = useState([]);    // Active/Planning sprints available for assignment
    const [teamUsers, setTeamUsers] = useState([]);  // List of team users (for assignees)
    
    // Modal state for viewing a single task's full details
    const [selectedTask, setSelectedTask] = useState(null);
    // Toast notification banner state
    const [toast, setToast] = useState(null);

    /**
     * showToast Function
     * Triggers a temporary floating feedback alert at the bottom-right of the viewport.
     */
    function showToast(msg, type = 'success') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500); // Automatically dismisses toast after 3.5 seconds
    }

    // Trigger data fetching when the component first mounts
    useEffect(() => {
        fetchData();
    }, []);

    /**
     * fetchData Function
     * Loads backlog tasks, sprints, and team members in parallel to optimize load speeds.
     */
    async function fetchData() {
        setLoading(true);
        try {
            const [tasksRes, sprintsRes, usersRes] = await Promise.all([
                getBacklogTasks(),
                getSprints(), // Fetch all sprints in the workspace
                getTeamUsers(),
            ]);
            setTasks(tasksRes.data.data?.tasks || []);
            
            // Offer sprints that are active, upcoming, or ready to start.
            // Exclude completed, cancelled, or ended sprints.
            setSprints((sprintsRes.data.data || []).filter(s => {
                const state = classifySprint(s);
                return ['active', 'upcoming', 'ready_to_start', 'planning'].includes(state);
            }));
            setTeamUsers(usersRes.data.data || []);
        } catch (err) {
            console.error("Failed to fetch backlog data", err);
        } finally {
            setLoading(false);
        }
    }

    /**
     * handleAssignSprint Function
     * Updates a task's sprint association, removes it from the current backlog list,
     * and shows a success toast notification.
     */
    async function handleAssignSprint(taskId, sprintId) {
        if (!sprintId) return;
        const sprintName = sprints.find(s => String(s.id) === String(sprintId))?.name || 'Sprint';
        const task = tasks.find(t => t.id === taskId);
        try {
            await assignSprint(taskId, sprintId);
            // Remove the newly assigned task from the local backlog state list
            setTasks(tasks => tasks.filter(t => t.id !== taskId));
            showToast(`TASK-${taskId}${task?.title ? ` "${task.title}"` : ''} moved to ${sprintName} ✓`);
        } catch (err) {
            showToast(getErrorMessage(err) || 'Failed to assign sprint.', 'error');
        }
    }

    /**
     * handleDelete Function
     * Prompts for confirmation and deletes the task from the system via API.
     */
    async function handleDelete(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTask(taskId);
            // Remove deleted task from local state
            setTasks(tasks => tasks.filter(t => t.id !== taskId));
            // Close details modal if the active task was deleted
            if (selectedTask?.id === taskId) setSelectedTask(null);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to delete task.');
        }
    }

    /**
     * handleRowClick Function
     * Opens the detail modal when a user clicks on a table row.
     */
    function handleRowClick(task) {
        setSelectedTask(task);
    }

    return (
        <div className="page page-wide backlog-page">
            {/* Floating Toast Alerts */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                    color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                    padding: '12px 20px', borderRadius: 10, fontWeight: 500, fontSize: 14,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <span>{toast.type === 'error' ? '⚠️' : '✅'}</span> {toast.msg}
                </div>
            )}
            
            <h2 className="page-title">Backlog (Not assigned)</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
                Tasks that have been created but are not yet assigned to any sprint.
            </p>

            {/* Skeletons vs Empty States vs Backlog Table */}
            {loading ? (
                <div style={{ marginTop: '40px' }}>
                    <SkeletonLoader count={1} height={40} style={{ marginBottom: 12, width: '100%' }} />
                    <SkeletonLoader count={5} height={60} style={{ width: '100%' }} />
                </div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <p>No tasks in the backlog.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrapper task-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Priority</th>
                                    <th>Assignee</th>
                                    <th>Status</th>
                                    <th>Move to Sprint</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((t) => (
                                    <tr key={t.id} onClick={() => handleRowClick(t)} style={{ cursor: 'pointer' }}>
                                        <td><span className="jira-card-key">TASK-{t.id}</span></td>
                                        <td style={{ fontWeight: 500 }}>{t.title}</td>
                                        <td>
                                            <span className={`badge ${taskTypeClass(t.task_type)}`}>{t.task_type}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${priorityClass(t.priority)}`}>{t.priority}</span>
                                        </td>
                                        <td>{t.assignee_name || <span className="muted">Unassigned</span>}</td>
                                        <td>
                                            <span className={`badge badge-${t.status}`}>{statusLabel(t.status)}</span>
                                        </td>
                                        {/* e.stopPropagation avoids triggering row click modal */}
                                        <td onClick={e => e.stopPropagation()}>
                                            <select 
                                                className="form-input filter-select"
                                                style={{ padding: '4px 8px', height: 'auto', minWidth: 140 }}
                                                value=""
                                                onChange={(e) => handleAssignSprint(t.id, e.target.value)}
                                            >
                                                <option value="" disabled>Select sprint...</option>
                                                {sprints.map(s => {
                                                     const state = classifySprint(s);
                                                     return (
                                                         <option key={s.id} value={s.id}>
                                                             {s.name} ({SPRINT_STATE_LABELS[state] || state})
                                                         </option>
                                                     );
                                                 })}
                                             </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button 
                                                className="btn btn-secondary btn-sm"
                                                style={{ color: 'var(--color-danger)' }}
                                                onClick={() => handleDelete(t.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Task Details Modal overlay ── */}
            {selectedTask && (
                <div className="modal-backdrop" onClick={() => setSelectedTask(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header" style={{ marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>TASK-{selectedTask.id}: {selectedTask.title}</h3>
                            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                <span className={`badge ${taskTypeClass(selectedTask.task_type)}`}>{selectedTask.task_type}</span>
                                <span className={`badge ${priorityClass(selectedTask.priority)}`}>{selectedTask.priority}</span>
                                <span className={`badge badge-${selectedTask.status}`}>{statusLabel(selectedTask.status)}</span>
                            </div>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label className="form-label">Description</label>
                                <div style={{ background: 'var(--color-bg)', padding: 12, borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                                    {selectedTask.description || <span className="muted">No description</span>}
                                </div>
                            </div>
                            {selectedTask.acceptance_criteria && (
                                <div>
                                    <label className="form-label">Acceptance Criteria</label>
                                    <div style={{ background: 'var(--color-bg)', padding: 12, borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                                        {selectedTask.acceptance_criteria}
                                    </div>
                                </div>
                            )}
                            {selectedTask.risk_notes && (
                                <div>
                                    <label className="form-label">Risks</label>
                                    <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                                        {selectedTask.risk_notes}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label className="form-label">Assignee</label>
                                    <div>{selectedTask.assignee_name || 'Unassigned'}</div>
                                </div>
                                <div>
                                    <label className="form-label">Effort Points</label>
                                    <div>{selectedTask.effort_points || '-'}</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="btn btn-danger" onClick={() => handleDelete(selectedTask.id)}>Delete</button>
                            <button className="btn btn-primary" onClick={() => setSelectedTask(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
