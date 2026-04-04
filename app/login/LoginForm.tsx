import { signIn } from "./actions";

type LoginFormProps = {
  error?: string;
};

export default function LoginForm({ error }: LoginFormProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">
            <span style={{ fontWeight: 600 }}>KIN</span>
            <span className="login-dot" />
          </div>
          <div className="login-subtitle">Internal operating system</div>
        </div>

        <form className="login-form" action={signIn}>
          <div>
            <label className="modal-label">email</label>
            <input
              className="login-input"
              type="email"
              name="email"
              placeholder="you@kindtech.io"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="modal-label">password</label>
            <input
              className="login-input"
              type="password"
              name="password"
              placeholder="Enter your password"
              required
            />
          </div>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="action-btn login-submit" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
