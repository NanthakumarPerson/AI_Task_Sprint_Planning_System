import { useState, useEffect } from "react";
import { getProjects } from "../api/projects";
import { getSprints, getSprintReport } from "../api/sprint";
import { BarChart3 } from "lucide-react";

/**
 * ReportsPage Component
 * --------------------------------------------------------------------------------
 * Renders velocity trackers and performance charts for Sprints.
 * Features cascading dropdowns to select a project, then select a sprint,
 * and outputs metrics detailing task counts, complete tasks, sprint velocity
 * (using either task counts or Story Points), and member progress summaries.
 * --------------------------------------------------------------------------------
 */
export default function ReportsPage() {
    // State variables
    const [projects, setProjects] = useState([]);                  // System projects list
    const [sprints, setSprints] = useState([]);                    // Sprints list matching selected project
    const [selectedProject, setSelectedProject] = useState("");     // Highlighted project ID filter
    const [selectedSprint, setSelectedSprint] = useState("");       // Highlighted sprint ID filter
    const [report, setReport] = useState(null);                    // Active report statistics returned by database
    const [loading, setLoading] = useState(false);                  // Report query spinner loader
    const [error, setError] = useState("");                        // Network error warnings

    // Load projects list on page initial mount
    useEffect(() => {
        getProjects()
            .then((res) => {
                const list = res.data.data || [];
                setProjects(list);
                // Pre-select first project in dropdown if lists are populated
                if (list.length > 0) setSelectedProject(String(list[0].id));
            })
            .catch(() => setError("Failed to load projects."));
    }, []);

    // Cascade: Load sprints whenever selected project ID changes
    useEffect(() => {
        if (!selectedProject) return;
        getSprints({ project_id: Number(selectedProject) })
            .then((res) => {
                const list = res.data.data || [];
                setSprints(list);
                // Default select the first sprint in lists, or clear report if project has no sprints
                if (list.length > 0) {
                    setSelectedSprint(String(list[0].id));
                } else {
                    setSelectedSprint("");
                    setReport(null);
                }
            })
            .catch(() => setError("Failed to load sprints."));
    }, [selectedProject]);

    // Cascade: Query sprint velocity analytics report when selected sprint ID updates
    useEffect(() => {
        if (!selectedSprint) {
            setReport(null);
            return;
        }
        setLoading(true);
        setError("");
        getSprintReport(selectedSprint)
            .then((res) => {
                setReport(res.data.data || null);
            })
            .catch(() => setError("Failed to load sprint report."))
            .finally(() => setLoading(false));
    }, [selectedSprint]);

    return (
        <div className="page">
            {/* Page Title */}
            <div className="page-header">
                <h1 className="page-title">Sprint Reports</h1>
            </div>

            {/* Project / Sprint selectors filter box */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 16 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Project</label>
                        <select
                            className="form-input"
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            <option value="">— Select Project —</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Sprint</label>
                        <select
                            className="form-input"
                            value={selectedSprint}
                            onChange={(e) => setSelectedSprint(e.target.value)}
                            disabled={!selectedProject || sprints.length === 0}
                        >
                            <option value="">— Select Sprint —</option>
                            {sprints.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Spinner vs Error alerts vs Empty states vs Report metrics */}
            {loading ? (
                <div className="page-center">
                    <div className="spinner" />
                </div>
            ) : error ? (
                <p className="form-error">{error}</p>
            ) : !selectedSprint ? (
                <div className="card empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px' }}>
                    <div style={{ background: 'var(--color-primary-tint)', color: 'var(--color-primary)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                        <BarChart3 size={32} />
                    </div>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text)' }}>No Report Available</h3>
                    <p className="muted">Select a project and sprint above to view its analytics report.</p>
                </div>
            ) : report ? (
                <div className="dash-grid">
                    {/* Sprint Metrics Card */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Velocity & Status</h3>
                        <div className="summary-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                            <div className="summary-card">
                                <span className="summary-label">Total Tasks</span>
                                <span className="summary-value">{report.summary?.total_tasks ?? 0}</span>
                            </div>
                            <div className="summary-card">
                                <span className="summary-label">To Do</span>
                                <span className="summary-value">{report.summary?.todo_tasks ?? 0}</span>
                            </div>
                            <div className="summary-card">
                                <span className="summary-label">In Progress</span>
                                <span className="summary-value">{report.summary?.in_progress_tasks ?? 0}</span>
                            </div>
                            <div className="summary-card">
                                <span className="summary-label">In Review</span>
                                <span className="summary-value">{report.summary?.in_review_tasks ?? 0}</span>
                            </div>
                            <div className="summary-card">
                                <span className="summary-label">Done</span>
                                <span className="summary-value dash-DONE">{report.summary?.done_tasks ?? 0}</span>
                            </div>
                            <div className="summary-card" style={{ gridColumn: "span 2" }}>
                                <span className="summary-label">
                                    Sprint Velocity
                                    {/* Displays if velocity is calculated using task counts or Story Points */}
                                    {report.summary?.velocity_mode === 'task_count'
                                        ? ' (done tasks — no SP set)'
                                        : ' (SP)'}
                                </span>
                                <span className="summary-value">
                                    {report.summary?.velocity ?? 0}
                                    {report.summary?.velocity_mode === 'effort_points' ? ' SP' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Member Allocation Card */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Team Allocation</h3>
                        {report.member_breakdown?.length === 0 ? (
                            <p className="muted">No member allocations found.</p>
                        ) : (
                            <ul className="item-list">
                                {report.member_breakdown?.map((m) => (
                                    <li key={m.user_id} className="item-row">
                                        <div>
                                            <strong className="item-name">{m.name}</strong>
                                            <p className="muted-sm" style={{ marginTop: 2 }}>
                                                {m.todo} To Do / {m.in_progress} In Progress / {m.in_review} In Review / {m.done} Done
                                            </p>
                                        </div>
                                        <span className="badge">{m.assigned} tasks</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
