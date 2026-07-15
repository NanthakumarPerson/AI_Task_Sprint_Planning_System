// src/pages/ProjectsPage.jsx
import { useState, useEffect } from 'react';
import { getProjects, createProject } from '../api/projects';
import { getSprints, createSprint, startSprint, updateSprint, completeSprint, cancelSprint } from '../api/sprint';
import { createSingleTask, getTasksBySprint, updateTask, reassignTask, deleteTask } from '../api/tasks';
import { getTeamUsers } from '../api/auth';
import { getUser, formatDate, statusLabel, priorityClass, taskTypeClass, getErrorMessage } from '../utils/helpers';
import { ROLE, TASK_TYPE_OPTIONS, PRIORITY_OPTIONS } from '../utils/constants';
import { classifySprint, sprintStateBadgeClass, SPRINT_STATE_LABELS, isReadyToStart } from '../utils/sprintHelpers';

/**
 * ProjectsPage Component
 * --------------------------------------------------------------------------------
 * A high-level administrative interface designed for PMs and Admins (but viewable by
 * other roles). Allows creating and selecting projects, viewing related sprints,
 * triggering sprint transitions (start, complete, cancel), and managing sprint tasks..
 * --------------------------------------------------------------------------------
 */
export default function ProjectsPage() {
    // Retrieve credentials and permissions context
    const user = getUser();
    const isPmOrAdmin = user?.role_id === ROLE.PM || user?.role_id === ROLE.ADMIN;

    // ── Projects state ──
    const [projects, setProjects] = useState([]);      // List of all projects in system
    const [projLoading, setProjLoading] = useState(true); // Project list spinner state
    const [projError, setProjError] = useState('');      // Project network errors
    const [projName, setProjName] = useState('');        // Form state: new project name
    const [projDesc, setProjDesc] = useState('');        // Form state: new project description
    const [projSubmit, setProjSubmit] = useState(false);  // Form submission indicator

    // ── Sprint state ──
    const [selectedProject, setSelectedProject] = useState(null); // Currently highlighted project
    const [sprints, setSprints] = useState([]);                  // Sprints list matching the selected project
    const [sprintLoading, setSprintLoading] = useState(false);    // Sprint spinner
    const [sprintForm, setSprintForm] = useState({ name: '', goal: '', start_date: '', end_date: '' }); // New sprint buffer form
    const [sprintErrors, setSprintErrors] = useState({});        // Validation error flags for new sprint inputs
    const [sprintSubmit, setSprintSubmit] = useState(false);      // New sprint loading submit flag
    const [sprintMsg, setSprintMsg] = useState('');              // Toast/Feedback banner message for sprint action

    // ── Sprint detail / tasks state ──
    const [selectedSprint, setSelectedSprint] = useState(null);   // Currently highlighted sprint
    const [sprintTasks, setSprintTasks] = useState([]);           // Tasks allocated to selected sprint
    const [tasksLoading, setTasksLoading] = useState(false);      // Tasks spinner
    const [showTasks, setShowTasks] = useState(false);            // Toggles displaying of tasks table
    const [showEditSprint, setShowEditSprint] = useState(false);  // Toggles sprint edit form view
    const [editSprintForm, setEditSprintForm] = useState({ name: '', goal: '', start_date: '', end_date: '' }); // Buffer form for editing sprint
    const [showEditTask, setShowEditTask] = useState(null);      // Tracks ID of task currently edited inside row
    const [editTaskForm, setEditTaskForm] = useState({});         // Buffer form for editing task details

    // ── Add Task modal state ──
    const [showAddTask, setShowAddTask] = useState(false);        // Toggles display of Add Task form
    const [teamUsers, setTeamUsers] = useState([]);              // Complete team users listing
    const [taskForm, setTaskForm] = useState({                   // Buffer form state for new manual tasks
        title: '', description: '', task_type: 'development', priority: 'medium',
        assignee_id: '', due_date: '', estimated_hours: '',
    });
    const [taskErrors, setTaskErrors] = useState({});            // Validation errors for new tasks
    const [taskSubmit, setTaskSubmit] = useState(false);          // Task creation submit loader
    const [taskMsg, setTaskMsg] = useState('');                  // Feedback text for task operations

    // Fetch project listings on initial mount
    useEffect(() => { loadProjects(); }, []);

    /**
     * loadProjects Function
     * Calls API to load list of available projects.
     */
    async function loadProjects() {
        setProjLoading(true);
        try {
            const res = await getProjects();
            setProjects(res.data.data || []);
        } catch {
            setProjError('Failed to load projects.');
        } finally {
            setProjLoading(false);
        }
    }

    /**
     * loadSprints Function
     * Loads list of sprints associated with a specific project ID, and resets child detail states.
     */
    async function loadSprints(projectId) {
        setSprintLoading(true);
        setSprints([]);
        setSelectedSprint(null);
        setShowTasks(false);
        setShowEditSprint(false);
        setShowEditTask(null);
        try {
            const res = await getSprints({ project_id: projectId });
            setSprints(res.data.data || []);
        } catch {
            setSprints([]);
        } finally {
            setSprintLoading(false);
        }
    }

    /**
     * handleSelectProject Function
     * Triggered when a project row is clicked. Selects the project, resets forms, and queries its sprints.
     */
    function handleSelectProject(p) {
        setSelectedProject(p);
        setSprintForm({ name: '', goal: '', start_date: '', end_date: '' });
        setSprintErrors({});
        setSprintMsg('');
        setSelectedSprint(null);
        setShowTasks(false);
        loadSprints(p.id);
    }

    /**
     * handleCreateProject Function
     * Submits a POST request to add a new project to the database, then refreshes listings.
     */
    async function handleCreateProject(e) {
        e.preventDefault();
        if (!projName.trim()) return;
        setProjSubmit(true);
        setProjError('');
        try {
            await createProject({ name: projName, description: projDesc });
            setProjName('');
            setProjDesc('');
            await loadProjects();
        } catch (err) {
            setProjError(getErrorMessage(err) || 'Failed to create project.');
        } finally {
            setProjSubmit(false);
        }
    }

    /**
     * validateSprintForm Function
     * Client-side validation ensuring dates are present and logical before sending API request.
     */
    function validateSprintForm() {
        const e = {};
        if (!sprintForm.name.trim()) e.name = 'Sprint name is required.';
        if (!sprintForm.start_date) e.start_date = 'Start date is required.';
        if (!sprintForm.end_date) e.end_date = 'End date is required.';
        if (sprintForm.start_date && sprintForm.end_date &&
            sprintForm.end_date <= sprintForm.start_date) {
            e.end_date = 'End date must be after start date.';
        }
        return e;
    }

    /**
     * handleCreateSprint Function
     * Validates and submits a POST request to allocate a new sprint under the active project.
     */
    async function handleCreateSprint(e) {
        e.preventDefault();
        const errs = validateSprintForm();
        if (Object.keys(errs).length) { setSprintErrors(errs); return; }

        setSprintSubmit(true);
        setSprintMsg('');
        setSprintErrors({});
        try {
            await createSprint({
                project_id: selectedProject.id,
                name: sprintForm.name,
                goal: sprintForm.goal || null,
                start_date: sprintForm.start_date,
                end_date: sprintForm.end_date,
            });
            setSprintForm({ name: '', goal: '', start_date: '', end_date: '' });
            setSprintMsg('Sprint created successfully.');
            await loadSprints(selectedProject.id);
        } catch (err) {
            setSprintErrors({ form: getErrorMessage(err) || 'Failed to create sprint.' });
        } finally {
            setSprintSubmit(false);
        }
    }

    // ── Sprint detail handlers ──

    /**
     * loadTeamUsers Function
     * Lazy-loads list of team members to populate the task assignee selectors.
     */
    async function loadTeamUsers() {
        if (teamUsers.length === 0) {
            try {
                const res = await getTeamUsers();
                setTeamUsers(res.data.data || []);
            } catch {
                setTeamUsers([]);
            }
        }
    }

    /**
     * handleOpenEditSprint Function
     * Pre-fills the editing sprint form inputs with the selected sprint details.
     */
    function handleOpenEditSprint() {
        setEditSprintForm({
            name: selectedSprint.name,
            goal: selectedSprint.goal || '',
            start_date: selectedSprint.start_date,
            end_date: selectedSprint.end_date,
        });
        setShowTasks(false);
        setShowAddTask(false);
        setShowEditTask(null);
        setShowEditSprint(true);
    }

    /**
     * handleUpdateSprint Function
     * Submits updates to sprint details (name, goal, dates).
     */
    async function handleUpdateSprint(e) {
        e.preventDefault();
        try {
            const payload = { ...editSprintForm };
            // If the sprint is already active or closed, lock start/end dates from modifications
            if (selectedSprint.status !== 'planning') {
                delete payload.start_date;
                delete payload.end_date;
            }

            const res = await updateSprint(selectedSprint.id, payload);
            setSprintMsg('Sprint updated successfully.');
            setShowEditSprint(false);
            await loadSprints(selectedProject.id);
            const updated = res.data?.data;
            if (updated) setSelectedSprint(prev => ({ ...prev, ...updated }));
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to update sprint.');
        }
    }

    /**
     * handleCompleteSprint Function
     * Checks if there are incomplete tasks inside the sprint, prompts whether to dump
     * them back to backlog, and sets the sprint status to 'completed'.
     */
    async function handleCompleteSprint(sprint) {
        try {
            const res = await getTasksBySprint(sprint.id);
            const tasks = res.data.data?.tasks || [];
            const unfinished = tasks.filter(t => t.status !== 'DONE');
            let move_unfinished = false;

            if (unfinished.length > 0) {
                if (!confirm(`Sprint has ${unfinished.length} unfinished tasks. Move them to Backlog? (Canceling will abort sprint completion)`)) return;
                move_unfinished = true;
            } else {
                if (!confirm(`Complete sprint "${sprint.name}"?`)) return;
            }

            await completeSprint(sprint.id, { move_unfinished_to_backlog: move_unfinished });
            setSprintMsg(`Sprint "${sprint.name}" completed!`);
            await loadSprints(selectedProject.id);
            setSelectedSprint(prev => prev ? { ...prev, status: 'completed' } : prev);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to complete sprint.');
        }
    }

    /**
     * handleCancelSprint Function
     * Cancels the sprint and offers to move any unfinished tasks back to the product backlog.
     */
    async function handleCancelSprint(sprint) {
        try {
            const res = await getTasksBySprint(sprint.id);
            const tasks = res.data.data?.tasks || [];
            const unfinished = tasks.filter(t => t.status !== 'DONE');
            let move_unfinished = false;

            if (unfinished.length > 0) {
                if (!confirm(`Sprint has ${unfinished.length} unfinished tasks. Move them to Backlog? (Canceling will abort sprint cancellation)`)) return;
                move_unfinished = true;
            } else {
                if (!confirm(`Cancel sprint "${sprint.name}"?`)) return;
            }

            await cancelSprint(sprint.id, { move_unfinished_to_backlog: move_unfinished });
            setSprintMsg(`Sprint "${sprint.name}" cancelled!`);
            await loadSprints(selectedProject.id);
            setSelectedSprint(prev => prev ? { ...prev, status: 'cancelled' } : prev);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to cancel sprint.');
        }
    }

    /**
     * handleReassignTask Function
     * Reassigns a specific task to another developer and refreshes the current task list.
     */
    async function handleReassignTask(taskId, newAssigneeId) {
        try {
            await reassignTask(taskId, { assignee_id: newAssigneeId ? parseInt(newAssigneeId) : null });
            await handleViewTasks(selectedSprint);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to reassign task.');
        }
    }

    /**
     * handleRemoveTask Function
     * Validates state and deletes a task from the active sprint.
     */
    async function handleRemoveTask(task) {
        if (task.status === 'DONE') {
            alert("Cannot remove a 'DONE' task.");
            return;
        }
        if (task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') {
            if (!confirm(`Task is currently ${statusLabel(task.status)}. Are you sure you want to remove it from the sprint?`)) return;
        }
        try {
            await deleteTask(task.id);
            await handleViewTasks(selectedSprint);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to delete task.');
        }
    }

    /**
     * handleOpenEditTask Function
     * Pre-fills the inline task edit form.
     */
    async function handleOpenEditTask(task) {
        await loadTeamUsers();
        setShowEditTask(task.id);
        setEditTaskForm({
            title: task.title,
            description: task.description || '',
            task_type: task.task_type,
            priority: task.priority,
            assignee_id: task.assignee_id || '',
            due_date: task.due_date || '',
            estimated_hours: task.estimated_hours || ''
        });
    }

    /**
     * handleUpdateTask Function
     * Submits edit task updates.
     */
    async function handleUpdateTask(e, taskId) {
        e.preventDefault();
        try {
            await updateTask(taskId, {
                title: editTaskForm.title.trim(),
                description: editTaskForm.description.trim() || null,
                task_type: editTaskForm.task_type,
                priority: editTaskForm.priority,
                assignee_id: editTaskForm.assignee_id ? parseInt(editTaskForm.assignee_id) : null,
                due_date: editTaskForm.due_date || null,
                estimated_hours: editTaskForm.estimated_hours ? parseFloat(editTaskForm.estimated_hours) : null,
            });
            setShowEditTask(null);
            await handleViewTasks(selectedSprint);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to update task.');
        }
    }

    function handleSelectSprint(s) {
        setSelectedSprint(s);
        setShowTasks(false);
        setShowAddTask(false);
        setTaskMsg('');
    }

    /**
     * handleViewTasks Function
     * Queries and displays all tasks currently assigned inside the selected sprint.
     */
    async function handleViewTasks(sprint) {
        setTasksLoading(true);
        setShowTasks(true);
        setShowAddTask(false);
        try {
            const res = await getTasksBySprint(sprint.id);
            setSprintTasks(res.data.data?.tasks || []);
        } catch {
            setSprintTasks([]);
        } finally {
            setTasksLoading(false);
        }
    }

    /**
     * handleStartSprint Function
     * Switches the sprint state from 'planning' to 'active' so team members can work on it.
     */
    async function handleStartSprint(sprint) {
        if (!confirm(`Start sprint "${sprint.name}"? Tasks can no longer be added once the sprint is active.`)) return;
        try {
            await startSprint(sprint.id);
            setSprintMsg(`Sprint "${sprint.name}" started!`);
            await loadSprints(selectedProject.id);
            setSelectedSprint(prev => prev ? { ...prev, status: 'active' } : prev);
        } catch (err) {
            alert(getErrorMessage(err) || 'Failed to start sprint.');
        }
    }

    /**
     * handleOpenAddTask Function
     * Opens task creation sub-form.
     */
    async function handleOpenAddTask() {
        setShowAddTask(true);
        setShowTasks(false);
        setTaskForm({
            title: '', description: '', task_type: 'development', priority: 'medium',
            assignee_id: '', due_date: '', estimated_hours: '',
        });
        setTaskErrors({});
        setTaskMsg('');
        await loadTeamUsers();
    }

    function validateTaskForm() {
        const e = {};
        if (!taskForm.title.trim()) e.title = 'Title is required.';
        if (!taskForm.task_type) e.task_type = 'Task type is required.';
        if (!taskForm.priority) e.priority = 'Priority is required.';
        return e;
    }

    /**
     * handleCreateTask Function
     * Creates a manual task in the DB allocated to the active project & selected sprint.
     */
    async function handleCreateTask(e) {
        e.preventDefault();
        const errs = validateTaskForm();
        if (Object.keys(errs).length) { setTaskErrors(errs); return; }

        setTaskSubmit(true);
        setTaskErrors({});
        setTaskMsg('');
        try {
            await createSingleTask({
                project_id: selectedProject.id,
                sprint_id: selectedSprint.id,
                title: taskForm.title.trim(),
                description: taskForm.description.trim() || null,
                task_type: taskForm.task_type,
                priority: taskForm.priority,
                assignee_id: taskForm.assignee_id ? parseInt(taskForm.assignee_id) : null,
                due_date: taskForm.due_date || null,
                estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
            });
            setTaskMsg('Task created successfully!');
            setTaskForm({
                title: '', description: '', task_type: 'development', priority: 'medium',
                assignee_id: '', due_date: '', estimated_hours: '',
            });
        } catch (err) {
            setTaskErrors({ form: getErrorMessage(err) || 'Failed to create task.' });
        } finally {
            setTaskSubmit(false);
        }
    }

    return (
        <div className="page">
            {/* Title */}
            <div className="page-header">
                <h1 className="page-title">Projects</h1>
            </div>

            {/* Main grid split: Left column is project listings, Right column is sprints detail */}
            <div className="dash-grid">
                {/* ── LEFT COLUMN: Projects list ── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">All Projects</h3>
                    </div>

                    {projLoading ? (
                        <div className="spinner" />
                    ) : projError && projects.length === 0 ? (
                        <p className="form-error">{projError}</p>
                    ) : projects.length === 0 ? (
                        <p className="muted">No projects yet. Create one to get started.</p>
                    ) : (
                        <ul className="item-list">
                            {projects.map((p) => (
                                <li
                                    key={p.id}
                                    className={`item-row project-row${selectedProject?.id === p.id ? ' project-row--selected' : ''}`}
                                    onClick={() => handleSelectProject(p)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div>
                                        <strong className="item-name">{p.name}</strong>
                                        {p.description && (
                                            <p className="muted-sm" style={{ marginTop: 2 }}>{p.description}</p>
                                        )}
                                    </div>
                                    <span className="badge">{p.status || 'Active'}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* PM Form to create new projects */}
                    {isPmOrAdmin && (
                        <div className="new-project-panel" style={{ marginTop: '32px', padding: '20px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                            <h4 className="card-title" style={{ marginBottom: '16px' }}>New Project</h4>
                            <form onSubmit={handleCreateProject}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="proj-name">
                                        Project Name <span className="required">*</span>
                                    </label>
                                    <input
                                        id="proj-name"
                                        className={`form-input ${projSubmit && !projName.trim() ? 'error' : ''}`}
                                        type="text"
                                        value={projName}
                                        onChange={(e) => setProjName(e.target.value)}
                                        placeholder="e.g. Apollo Portal"
                                        required
                                    />
                                    {projSubmit && !projName.trim() && <p className="form-error">Project name cannot be empty.</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="proj-desc">Description</label>
                                    <textarea
                                        id="proj-desc"
                                        className="form-input"
                                        rows={3}
                                        value={projDesc}
                                        onChange={(e) => setProjDesc(e.target.value)}
                                        placeholder="Optional description…"
                                    />
                                </div>
                                {projError && (
                                    <p className="form-error" style={{ marginBottom: 10 }}>{projError}</p>
                                )}
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={projSubmit || !projName.trim()}
                                >
                                    {projSubmit ? 'Creating…' : 'Create Project'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Sprints panel ── */}
                <div className="card">
                    {!selectedProject ? (
                        <div className="empty-state">
                            <p>Select a project to view and manage its sprints.</p>
                        </div>
                    ) : (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">Sprints — {selectedProject.name}</h3>
                            </div>

                            {sprintLoading ? (
                                <div className="spinner" style={{ margin: '16px auto' }} />
                            ) : sprints.length === 0 ? (
                                <p className="muted" style={{ marginBottom: 16 }}>No sprints yet for this project.</p>
                            ) : (
                                <ul className="item-list" style={{ marginBottom: 20 }}>
                                    {sprints.map((s) => {
                                        const state = classifySprint(s);
                                        return (
                                            <li
                                                key={s.id}
                                                className={`item-row${selectedSprint?.id === s.id ? ' project-row--selected' : ''}`}
                                                onClick={() => handleSelectSprint(s)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div>
                                                    <strong className="item-name">{s.name}</strong>
                                                    <p className="muted-sm" style={{ marginTop: 2 }}>
                                                        {formatDate(s.start_date)} – {formatDate(s.end_date)}
                                                    </p>
                                                </div>
                                                <span className={`badge ${sprintStateBadgeClass(state)}`}>
                                                    {SPRINT_STATE_LABELS[state]}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            {/* ── Sprint Detail Dashboard (when a sprint is selected) ── */}
                            {selectedSprint && isPmOrAdmin && (() => {
                                const state = classifySprint(selectedSprint);
                                return (
                                    <>
                                        <div className="section-divider" style={{ margin: '4px 0 16px' }} />

                                        {/* Scheduled to start today alert */}
                                        {state === 'ready_to_start' && (
                                            <div className="ai-premium-card" style={{ marginBottom: 16, padding: 16, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sprint is scheduled to start today!</h4>
                                                        <p className="muted-sm" style={{ margin: '4px 0 0' }}>Ready to launch this sprint and start working on its tasks?</p>
                                                    </div>
                                                    <button className="btn btn-primary btn-sm btn-glow" onClick={() => handleStartSprint(selectedSprint)}>
                                                        ▶ Start Sprint
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Sprint ended alert */}
                                        {state === 'ended' && (
                                            <div className="ai-premium-card" style={{ marginBottom: 16, padding: 16, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-danger)' }}>Sprint has ended!</h4>
                                                        <p className="muted-sm" style={{ margin: '4px 0 0' }}>This sprint's scheduled end date has passed. Please complete it to move unfinished tasks.</p>
                                                    </div>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleCompleteSprint(selectedSprint)}>
                                                        Complete Sprint
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <h4 className="card-title">Sprint: {selectedSprint.name}</h4>
                                        <p className="muted-sm" style={{ marginTop: 4 }}>
                                            Status: <span className={`badge ${sprintStateBadgeClass(state)}`}>
                                                {SPRINT_STATE_LABELS[state]}
                                            </span>
                                        </p>

                                        {/* Action buttons depending on status (planning vs active vs closed) */}
                                        {(selectedSprint.status === 'planning') && (
                                            <div className="sprint-detail-actions" style={{ marginTop: 12 }}>
                                                <button className="btn btn-primary btn-sm" onClick={handleOpenAddTask}>
                                                    + Add Task
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewTasks(selectedSprint)}>
                                                    View Tasks
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={handleOpenEditSprint}>
                                                    ✏️ Edit Sprint
                                                </button>
                                                {state === 'ready_to_start' && (
                                                    <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#15803d' }}
                                                        onClick={() => handleStartSprint(selectedSprint)}>
                                                        ▶ Start Sprint
                                                    </button>
                                                )}
                                                <button className="btn btn-danger btn-sm" onClick={() => handleCancelSprint(selectedSprint)}>
                                                    Cancel Sprint
                                                </button>
                                            </div>
                                        )}

                                        {(selectedSprint.status === 'active') && (
                                            <div className="sprint-detail-actions" style={{ marginTop: 12 }}>
                                                <button className="btn btn-primary btn-sm" onClick={handleOpenAddTask}>
                                                    + Add Task
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewTasks(selectedSprint)}>
                                                    View Tasks
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={handleOpenEditSprint}>
                                                    ✏️ Edit Sprint
                                                </button>
                                                <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#15803d' }}
                                                    onClick={() => handleCompleteSprint(selectedSprint)}>
                                                    Complete Sprint
                                                </button>
                                                {state === 'active' && (
                                                    <span className="badge badge-sprint-active" style={{ padding: '6px 12px', marginLeft: 'auto' }}>Sprint Active</span>
                                                )}
                                            </div>
                                        )}

                                        {(selectedSprint.status === 'completed' || selectedSprint.status === 'cancelled') && (
                                            <div className="sprint-detail-actions" style={{ marginTop: 12 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewTasks(selectedSprint)}>
                                                    View Tasks
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={handleOpenEditSprint}>
                                                    ✏️ Edit Sprint
                                                </button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* ── Edit Sprint Form block ── */}
                            {showEditSprint && (
                                <>
                                    <div className="section-divider" style={{ margin: '16px 0' }} />
                                    <h4 className="card-title" style={{ marginBottom: 12 }}>
                                        Edit Sprint: {selectedSprint.name}
                                    </h4>
                                    <form onSubmit={handleUpdateSprint}>
                                        <div className="form-group">
                                            <label className="form-label">Project</label>
                                            <input
                                                className="form-input"
                                                type="text"
                                                value={selectedProject.name}
                                                disabled
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                Sprint Name <span className="required">*</span>
                                            </label>
                                            <input
                                                className="form-input"
                                                type="text"
                                                value={editSprintForm.name}
                                                onChange={(e) => setEditSprintForm(f => ({ ...f, name: e.target.value }))}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Sprint Goal</label>
                                            <textarea
                                                className="form-input"
                                                rows={2}
                                                value={editSprintForm.goal}
                                                onChange={(e) => setEditSprintForm(f => ({ ...f, goal: e.target.value }))}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="form-group">
                                                <label className="form-label">
                                                    Start Date <span className="required">*</span>
                                                </label>
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    value={editSprintForm.start_date}
                                                    onChange={(e) => setEditSprintForm(f => ({ ...f, start_date: e.target.value }))}
                                                    disabled={selectedSprint.status !== 'planning'}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">
                                                    End Date <span className="required">*</span>
                                                </label>
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    value={editSprintForm.end_date}
                                                    onChange={(e) => setEditSprintForm(f => ({ ...f, end_date: e.target.value }))}
                                                    disabled={selectedSprint.status !== 'planning'}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        {selectedSprint.status !== 'planning' && (
                                            <p className="muted-sm" style={{ marginBottom: 12 }}>
                                                Dates cannot be changed because the sprint is {selectedSprint.status}.
                                            </p>
                                        )}

                                        <div className="form-actions-row">
                                            <button type="submit" className="btn btn-primary">Save Changes</button>
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowEditSprint(false)}>Cancel</button>
                                        </div>
                                    </form>
                                </>
                            )}

                            {/* ── View Tasks List table ── */}
                            {showTasks && (
                                <>
                                    <div className="section-divider" style={{ margin: '16px 0' }} />
                                    <h4 className="card-title" style={{ marginBottom: 12 }}>
                                        Tasks in {selectedSprint?.name} ({sprintTasks.length})
                                    </h4>
                                    {tasksLoading ? (
                                        <div className="spinner" style={{ margin: '12px auto' }} />
                                    ) : sprintTasks.length === 0 ? (
                                        <p className="muted">No tasks yet. Click "Add Task" to create one.</p>
                                    ) : (
                                        <div className="table-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Key</th>
                                                        <th>Title</th>
                                                        <th>Type</th>
                                                        <th>Priority</th>
                                                        <th>Assignee</th>
                                                        <th>Status</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sprintTasks.map((t) => (
                                                        <tr key={t.id}>
                                                            <td><span className="jira-card-key">TASK-{t.id}</span></td>
                                                            <td>{t.title}</td>
                                                            <td><span className={`badge ${taskTypeClass(t.task_type)}`}>{t.task_type}</span></td>
                                                            <td><span className={`badge ${priorityClass(t.priority)}`}>{t.priority}</span></td>
                                                            <td>
                                                                {/* Assignee select box allowing PMs to reassign dynamically */}
                                                                <select
                                                                    className="form-input filter-select"
                                                                    style={{ padding: '2px 8px', fontSize: '0.8rem', height: 'auto', minWidth: '100px' }}
                                                                    value={t.assignee_id || ''}
                                                                    onChange={(e) => handleReassignTask(t.id, e.target.value)}
                                                                    disabled={selectedSprint?.status === 'completed'}
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {teamUsers.map(u => (
                                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td><span className={`badge badge-${t.status}`}>{statusLabel(t.status)}</span></td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                                        onClick={() => handleOpenEditTask(t)}
                                                                        disabled={selectedSprint?.status === 'completed'}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    {selectedSprint?.status === 'active' && (
                                                                        <button
                                                                            className="btn btn-secondary btn-sm"
                                                                            style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#dc2626' }}
                                                                            onClick={() => handleRemoveTask(t)}
                                                                            disabled={t.status === 'DONE'}
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Edit Task Form Modal overlay ── */}
                            {showEditTask && (
                                <div className="overlay" onClick={() => setShowEditTask(null)}>
                                    <div className="modal" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h2 className="modal-title">Edit Task</h2>
                                            <button className="btn-icon" onClick={() => setShowEditTask(null)}>✕</button>
                                        </div>
                                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                            <form onSubmit={(e) => handleUpdateTask(e, showEditTask)} id="editTaskFormId">
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
                                                    <textarea
                                                        className="form-input"
                                                        rows={3}
                                                        value={editTaskForm.description}
                                                        onChange={e => setEditTaskForm(f => ({ ...f, description: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="form-grid-2">
                                                    <div className="form-group">
                                                        <label className="form-label">Task Type <span className="required">*</span></label>
                                                        <select className="form-input" value={editTaskForm.task_type}
                                                            onChange={e => setEditTaskForm(f => ({ ...f, task_type: e.target.value }))}
                                                            disabled={selectedSprint?.status === 'active'}
                                                        >
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
                                                    />
                                                </div>
                                            </form>
                                        </div>
                                        <div className="modal-footer form-actions-row">
                                            <button type="submit" form="editTaskFormId" className="btn btn-primary">Save Changes</button>
                                            <button className="btn btn-secondary" onClick={() => setShowEditTask(null)}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Add Task Form Panel ── */}
                            {showAddTask && (selectedSprint?.status === 'planning' || selectedSprint?.status === 'active') && (
                                <>
                                    <div className="section-divider" style={{ margin: '16px 0' }} />
                                    <h4 className="card-title" style={{ marginBottom: 12 }}>
                                        Add Task to {selectedSprint.name}
                                    </h4>
                                    <form onSubmit={handleCreateTask}>
                                        <div className="form-group">
                                            <label className="form-label">Title <span className="required">*</span></label>
                                            <input className="form-input" type="text"
                                                value={taskForm.title}
                                                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                                                placeholder="e.g. Implement login API"
                                            />
                                            {taskErrors.title && <p className="form-error">{taskErrors.title}</p>}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Description</label>
                                            <textarea className="form-input" rows={3}
                                                value={taskForm.description}
                                                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                                                placeholder="Optional description…"
                                            />
                                        </div>

                                        <div className="form-grid-2">
                                            <div className="form-group">
                                                <label className="form-label">Task Type <span className="required">*</span></label>
                                                <select className="form-input" value={taskForm.task_type}
                                                    onChange={e => setTaskForm(f => ({ ...f, task_type: e.target.value }))}>
                                                    {TASK_TYPE_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Priority <span className="required">*</span></label>
                                                <select className="form-input" value={taskForm.priority}
                                                    onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                                                    {PRIORITY_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-grid-2">
                                            <div className="form-group">
                                                <label className="form-label">Assignee</label>
                                                <select className="form-input" value={taskForm.assignee_id}
                                                    onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                                                    <option value="">Unassigned</option>
                                                    {teamUsers.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.name} ({u.role_id === 3 ? 'Developer' : 'Tester'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Due Date</label>
                                                <input className="form-input" type="date"
                                                    value={taskForm.due_date}
                                                    onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Estimated Hours</label>
                                            <input className="form-input" type="number" step="0.5" min="0"
                                                value={taskForm.estimated_hours}
                                                onChange={e => setTaskForm(f => ({ ...f, estimated_hours: e.target.value }))}
                                                placeholder="e.g. 4"
                                                style={{ maxWidth: 200 }}
                                            />
                                        </div>

                                        {/* Context description banner */}
                                        <p className="muted-sm" style={{ marginBottom: 12 }}>
                                            Project: <strong>{selectedProject.name}</strong> · Sprint: <strong>{selectedSprint.name}</strong> · Status: <span className="badge badge-todo">todo</span>
                                        </p>

                                        {taskErrors.form && <p className="form-error" style={{ marginBottom: 10 }}>{taskErrors.form}</p>}
                                        {taskMsg && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>✓ {taskMsg}</p>}

                                        <div className="form-actions-row">
                                            <button type="submit" className="btn btn-primary" disabled={taskSubmit}>
                                                {taskSubmit ? 'Creating…' : 'Create Task'}
                                            </button>
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddTask(false)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}

                            {/* ── PM Form: Create new Sprints ── */}
                            {isPmOrAdmin && (
                                <>
                                    <div className="section-divider" style={{ margin: '20px 0 16px' }} />
                                    <h4 className="card-title" style={{ marginBottom: 12 }}>New Sprint</h4>
                                    <form onSubmit={handleCreateSprint}>
                                        <div className="form-group">
                                            <label className="form-label">
                                                Sprint Name <span className="required">*</span>
                                            </label>
                                            <input
                                                className="form-input"
                                                type="text"
                                                value={sprintForm.name}
                                                onChange={(e) => setSprintForm(f => ({ ...f, name: e.target.value }))}
                                                placeholder="e.g. Sprint 1 – Auth & Core"
                                            />
                                            {sprintErrors.name && <p className="form-error">{sprintErrors.name}</p>}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Sprint Goal</label>
                                            <textarea
                                                className="form-input"
                                                rows={2}
                                                value={sprintForm.goal}
                                                onChange={(e) => setSprintForm(f => ({ ...f, goal: e.target.value }))}
                                                placeholder="Optional sprint goal…"
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="form-group">
                                                <label className="form-label">
                                                    Start Date <span className="required">*</span>
                                                </label>
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    value={sprintForm.start_date}
                                                    onChange={(e) => setSprintForm(f => ({ ...f, start_date: e.target.value }))}
                                                />
                                                {sprintErrors.start_date && <p className="form-error">{sprintErrors.start_date}</p>}
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">
                                                    End Date <span className="required">*</span>
                                                </label>
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    value={sprintForm.end_date}
                                                    onChange={(e) => setSprintForm(f => ({ ...f, end_date: e.target.value }))}
                                                />
                                                {sprintErrors.end_date && <p className="form-error">{sprintErrors.end_date}</p>}
                                            </div>
                                        </div>

                                        {sprintErrors.form && <p className="form-error" style={{ marginBottom: 10 }}>{sprintErrors.form}</p>}
                                        {sprintMsg && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>✓ {sprintMsg}</p>}

                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={sprintSubmit}
                                        >
                                            {sprintSubmit ? 'Creating…' : 'Create Sprint'}
                                        </button>
                                    </form>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}