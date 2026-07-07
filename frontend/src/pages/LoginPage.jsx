import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../api/auth";
import { saveToken, saveUser, getErrorMessage } from "../utils/helpers";
import { validateEmail } from "../utils/validators";

/**
 * LoginPage Component
 * --------------------------------------------------------------------------------
 * Renders the authentication screen. It handles input collection, email validation,
 * API requests, error displaying, loading state management, and user redirection.
 * --------------------------------------------------------------------------------
 */
function LoginPage() {
  // Navigation hook to programmatically redirect users after a successful login
  const navigate = useNavigate();

  // Local State Variables
  const [email, setEmail] = useState("");              // Stores the input value for the user's email
  const [password, setPassword] = useState("");        // Stores the input value for the user's password
  const [showPassword, setShowPassword] = useState(false); // Controls visibility of the password input (text vs password)
  const [rememberMe, setRememberMe] = useState(false);  // Holds remember me state (not yet integrated)
  const [emailErr, setEmailErr] = useState("");        // Stores email validation error messages (if invalid)
  const [error, setError] = useState("");              // Stores global API or authentication error messages
  const [loading, setLoading] = useState(false);        // Handles disabling state of the submit button while login API is pending

  /**
   * handleEmailBlur Callback
   * Runs local email validation when the user clicks away (blurs) from the email field.
   */
  const handleEmailBlur = useCallback(() => {
    setEmailErr(validateEmail(email));
  }, [email]);

  /**
   * handleEmailChange Callback
   * Updates state value and clears any general validation errors as the user types.
   */
  const handleEmailChange = useCallback((e) => {
    setEmail(e.target.value);
    if (error) setError("");
  }, [error]);

  /**
   * handlePasswordChange Callback
   * Updates the password state value and clears general validation errors.
   */
  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
    if (error) setError("");
  }, [error]);

  /**
   * handleSubmit Callback
   * Form submission handler. Validates inputs on client-side, triggers the login API request,
   * stores local storage tokens/user details, and triggers routing redirection.
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); // Prevents page reload on submit

    // Client-side validations prior to invoking API
    const err = validateEmail(email);
    if (err) { setEmailErr(err); return; }
    if (!password) { setError("Password is required."); return; }

    setLoading(true);
    setError("");
    try {
      // Calls post request auth API
      const res = await loginApi(email, password);
      if (res.success) {
        saveToken(res.data.token); // Saves JWT token in local storage
        saveUser(res.data.user);   // Saves user profile object in local storage
        navigate("/dashboard");     // Navigates to default Planning Dashboard
      }
    } catch (err) {
      // Catch network or validation errors and set appropriate feedback message
      setError(getErrorMessage(err) || "Invalid email or password.");
    } finally {
      setLoading(false); // Re-enables the login button
    }
  }, [email, password, navigate]);

  return (
    <div className="login-page">
      {/* LEFT SECTION: Informational panel showcasing app's value proposition */}
      <div className="login-left">
        <div className="login-logo-area">
          <div className="login-logo-mark"></div>
          <h2 className="login-app-name">AI Sprint Planner</h2>
        </div>

        <div className="login-illustration-area">
          <h1 className="login-hero-title">Plan sprints smarter with AI</h1>
          <p className="login-hero-desc">
            Break requirements into tasks, manage sprints, and track project progress in one workspace.
          </p>

          {/* Workflow path roadmap */}
          <div className="login-workflow">
            <div className="login-mini-card">Requirement</div>
            <div className="login-workflow-arrow">→</div>
            <div className="login-mini-card">AI Tasks</div>
            <div className="login-workflow-arrow">→</div>
            <div className="login-mini-card">Sprint</div>
            <div className="login-workflow-arrow">→</div>
            <div className="login-mini-card">Reports</div>
          </div>

          {/* Mockup kanban board showing what the app features */}
          <div className="login-kanban-preview">
            <div className="login-hero-card">
              <div className="login-kanban-col-title">TO DO</div>
              <div className="login-mini-card">Requirement Created</div>
              <div className="login-mini-card">AI Task Breakdown</div>
            </div>
            <div className="login-hero-card">
              <div className="login-kanban-col-title">IN PROGRESS</div>
              <div className="login-mini-card">Sprint Planning</div>
            </div>
            <div className="login-hero-card">
              <div className="login-kanban-col-title">TESTING</div>
              <div className="login-mini-card">Testing Assigned</div>
            </div>
            <div className="login-hero-card">
              <div className="login-kanban-col-title">DONE</div>
              <div className="login-mini-card">Velocity Report</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: Standard credentials input form */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to continue to your workspace</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="login-form-group">
              <label className="login-label" htmlFor="email">Email</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">✉</span>
                <input
                  id="email"
                  type="email"
                  className={`login-input ${emailErr ? "error" : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  autoComplete="email"
                  aria-invalid={!!emailErr}
                />
              </div>
              {emailErr && <span className="login-error-text">{emailErr}</span>}
            </div>

            {/* Password Field */}
            <div className="login-form-group">
              <label className="login-label" htmlFor="password">Password</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">🔒</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                />
                {/* Toggle password visibility text vs hidden */}
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="login-options">
            </div>

            {/* Error alerts */}
            {error && <div className="login-error">{error}</div>}

            {/* Sign in Submission Button */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Assistant Info */}
          <div className="login-demo-box">
            Demo roles: PM • Developer • Tester • Admin
          </div>

          <div className="login-footer">
            © 2026 AI Sprint Planner
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;