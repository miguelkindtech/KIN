import Image from "next/image";
import { signIn } from "./actions";

type LoginFormProps = {
  error?: string;
};

export default function LoginForm({ error }: LoginFormProps) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <Image
            src="/kind-logo.png"
            alt="kind."
            width={180}
            height={63}
            priority
            className="login-logo"
          />
          <div className="login-subtitle">where the company thinks.</div>
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
