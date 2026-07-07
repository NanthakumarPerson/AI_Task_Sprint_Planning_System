// src/pages/UserManagementPage.jsx
// =============================================================================
// Admin-only page for managing users: list, create, edit, reset password, delete.
// Passwords are bcrypt hashed on the backend — never displayed in the table.
// =============================================================================

import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, resetUserPassword, deleteUser } from '../api/admin';
import { getUser, formatDate, getErrorMessage } from '../utils/helpers';
import { ROLE_OPTIONS } from '../utils/constants';

// Mappings for UI rendering of role types from role_id integers
const ROLE_LABEL = { 1: 'Admin', 2: 'PM', 3: 'Developer', 4: 'Tester' };

/**
 * UserManagementPage Component
 * --------------------------------------------------------------------------------
 * Administrative panel allowing system admins to fetch lists of registered accounts,
 * provision new users with passwords, modify existing account attributes (name, email, role),
 * trigger separate password resets, and delete employee records.
 * --------------------------------------------------------------------------------
 */
export default function UserManagementPage() {
    const currentUser = getUser(); // Retrieve active admin context details

    // ── State variables ──
    const [users, setUsers] = useState([]);                      // Active listing of all users
    const [loading, setLoading] = useState(true);                // User list spinner loader
    const [msg, setMsg] = useState('');                          // Success toast confirmation text
    const [errMsg, setErrMsg] = useState('');                    // Global warning alert texts

    // ── Modal states ──
    const [showModal, setShowModal] = useState(false);          // Toggles modal form overlay visibility
    const [editingUser, setEditingUser] = useState(null);        // Holds target user details if in edit mode, null if adding new user
    const [form, setForm] = useState({ name: '', email: '', password: '', role_id: 3 }); // Form buffer fields
    const [formErrors, setFormErrors] = useState({});            // Field-specific validation indicators
    const [submitting, setSubmitting] = useState(false);          // Submit action loader indicator

    // Fetch user listing on initial mount
    useEffect(() => { loadUsers(); }, []);

    /**
     * loadUsers Function
     * Calls admin API router to fetch all system accounts.
     */
    async function loadUsers() {
        setLoading(true);
        try {
            const res = await getUsers();
            setUsers(res.data.data || []);
        } catch {
            setErrMsg('Failed to load users.');
        } finally {
            setLoading(false);
        }
    }

    // ── Modal helper functions ──
    
    /**
     * openAddModal Function
     * Opens modal in "Add User" mode and resets form inputs.
     */
    function openAddModal() {
        setEditingUser(null);
        setForm({ name: '', email: '', password: '', role_id: 3 });
        setFormErrors({});
        setMsg('');
        setErrMsg('');
        setShowModal(true);
    }

    /**
     * openEditModal Function
     * Pre-populates the modal fields with details of the targeted user for modifications.
     */
    function openEditModal(user) {
        setEditingUser(user);
        setForm({ name: user.name, email: user.email, password: '', role_id: user.role_id });
        setFormErrors({});
        setMsg('');
        setErrMsg('');
        setShowModal(true);
    }

    /**
     * closeModal Function
     * Closes the overlay and flushes buffer forms.
     */
    function closeModal() {
        setShowModal(false);
        setEditingUser(null);
        setFormErrors({});
    }

    // ── Client-side Validation ──
    
    /**
     * validateForm Function
     * Verifies that fields are correctly completed, requiring passwords for new users.
     */
    function validateForm() {
        const e = {};
        if (!form.name.trim()) e.name = 'Name is required.';
        if (!form.email.trim()) e.email = 'Email is required.';
        if (!editingUser && !form.password) e.password = 'Password is required for new users.';
        if (form.password && form.password.length < 6) e.password = 'Password must be at least 6 characters.';
        return e;
    }

    // ── Submit Handlers (Create or Update) ──
    
    /**
     * handleSubmit Function
     * Route handler for form submissions. Depending on the edit status,
     * triggers updates or account creations.
     */
    async function handleSubmit(e) {
        e.preventDefault();
        const errs = validateForm();
        if (Object.keys(errs).length) { setFormErrors(errs); return; }

        setSubmitting(true);
        setFormErrors({});
        setMsg('');
        setErrMsg('');

        try {
            if (editingUser) {
                // ── EDIT MODE ──
                // 1. Update basic information: name, email, role
                await updateUser(editingUser.id, {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    role_id: Number(form.role_id),
                });
                // 2. If a new password was supplied in the edit form, submit reset separately
                if (form.password) {
                    await resetUserPassword(editingUser.id, form.password);
                }
                setMsg(`User "${form.name.trim()}" updated successfully.`);
            } else {
                // ── ADD MODE ──
                await createUser({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    role_id: Number(form.role_id),
                });
                setMsg(`User "${form.name.trim()}" created successfully.`);
            }
            closeModal();
            await loadUsers(); // Refresh listings
        } catch (err) {
            const detail = getErrorMessage(err) || 'Operation failed.';
            setFormErrors({ form: detail });
        } finally {
            setSubmitting(false);
        }
    }

    // ── Delete Handler ──
    
    /**
     * handleDelete Function
     * Prompts for confirmation and deletes the user record from the system.
     */
    async function handleDelete(user) {
        if (!confirm(`Are you sure you want to delete "${user.name}" (${user.email})? This action cannot be undone.`)) return;

        setMsg('');
        setErrMsg('');
        try {
            await deleteUser(user.id);
            setMsg(`User "${user.name}" deleted successfully.`);
            await loadUsers();
        } catch (err) {
            const detail = getErrorMessage(err) || 'Failed to delete user.';
            setErrMsg(detail);
        }
    }

    // Guard: Prevent user from deleting or deactivating their active login session
    const isSelf = (user) => user.id === currentUser?.id;

    return (
        <div className="page">
            {/* Page Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">User Management</h1>
                    <p className="muted-sm" style={{ marginTop: 4 }}>
                        Create, edit, and manage employee accounts.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openAddModal}>
                    + Add Employee
                </button>
            </div>

            {/* Notification messages */}
            {msg && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 12 }}>✓ {msg}</p>}
            {errMsg && <p className="form-error" style={{ marginBottom: 12 }}>{errMsg}</p>}

            {/* ── Users Table Card ── */}
            <div className="card">
                {loading ? (
                    <div className="spinner" style={{ margin: '40px auto' }} />
                ) : users.length === 0 ? (
                    <p className="muted" style={{ padding: 24, textAlign: 'center' }}>No users found.</p>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Created Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <strong>{u.name}</strong>
                                            {/* Renders indicator tag for the currently logged in admin user */}
                                            {isSelf(u) && <span className="badge" style={{ marginLeft: 8, fontSize: 10, background: '#dbeafe', color: '#1d4ed8' }}>You</span>}
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            <span className={`badge badge-${(ROLE_LABEL[u.role_id] || 'User').toLowerCase()}`}>
                                                {ROLE_LABEL[u.role_id] || 'Unknown'}
                                            </span>
                                        </td>
                                        <td>{formatDate(u.created_at)}</td>
                                        <td>
                                            <span className={`badge ${u.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openEditModal(u)}
                                                    title="Edit user"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ background: '#fee2e2', color: '#dc2626' }}
                                                    onClick={() => handleDelete(u)}
                                                    disabled={isSelf(u)}
                                                    title={isSelf(u) ? 'Cannot delete your own account' : 'Delete user'}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Add / Edit Modal Overlay ── */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="card-title">{editingUser ? `Edit: ${editingUser.name}` : 'Add Employee'}</h3>
                            <button className="modal-close" onClick={closeModal}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Name input */}
                            <div className="form-group">
                                <label className="form-label">Name <span className="required">*</span></label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={form.name}
                                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(er => ({ ...er, name: '' })); }}
                                    placeholder="e.g. John Smith"
                                />
                                {formErrors.name && <p className="form-error">{formErrors.name}</p>}
                            </div>

                            {/* Email input */}
                            <div className="form-group">
                                <label className="form-label">Email <span className="required">*</span></label>
                                <input
                                    className="form-input"
                                    type="email"
                                    value={form.email}
                                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFormErrors(er => ({ ...er, email: '' })); }}
                                    placeholder="e.g. john@company.com"
                                />
                                {formErrors.email && <p className="form-error">{formErrors.email}</p>}
                            </div>

                            {/* Password input */}
                            <div className="form-group">
                                <label className="form-label">
                                    Password {editingUser ? '(leave blank to keep current)' : <span className="required">*</span>}
                                </label>
                                <input
                                    className="form-input"
                                    type="password"
                                    value={form.password}
                                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setFormErrors(er => ({ ...er, password: '' })); }}
                                    placeholder={editingUser ? '••••••••' : 'Minimum 6 characters'}
                                />
                                {formErrors.password && <p className="form-error">{formErrors.password}</p>}
                            </div>

                            {/* Role selection dropdown */}
                            <div className="form-group">
                                <label className="form-label">Role <span className="required">*</span></label>
                                <select
                                    className="form-input"
                                    value={form.role_id}
                                    onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}
                                    disabled={editingUser && isSelf(editingUser)}
                                >
                                    {ROLE_OPTIONS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                                {editingUser && isSelf(editingUser) && (
                                    <p className="muted-sm" style={{ marginTop: 4 }}>You cannot change your own role.</p>
                                )}
                            </div>

                            {formErrors.form && <p className="form-error" style={{ marginBottom: 12 }}>{formErrors.form}</p>}

                            <div className="form-actions-row">
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : (editingUser ? 'Save Changes' : 'Create User')}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
