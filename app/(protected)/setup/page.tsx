export default function SetupPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">setup</div>
          <div className="page-subtitle">
            Final Supabase and deployment checklist for KIN.
          </div>
        </div>
      </div>

      <div className="section-stack">
        <div className="card">
          <div className="section-title">1. environment</div>
          <p className="muted">
            Copy <code>.env.example</code> into <code>.env.local</code> and add
            your Supabase URL and anon key.
          </p>
        </div>

        <div className="card">
          <div className="section-title">2. database</div>
          <p className="muted">
            Run <code>supabase/schema.sql</code> in the Supabase SQL editor.
            This creates all tables, policies, realtime-ready data models, the
            whitelist RPC and the attachments bucket.
          </p>
        </div>

        <div className="card">
          <div className="section-title">3. board access</div>
          <p className="muted">
            Create the board users in Supabase Auth first, then update the email
            placeholders in <code>supabase/seed.sql</code> and run it to insert
            the profile rows plus the initial KIN data.
          </p>
        </div>

        <div className="card">
          <div className="section-title">4. local validation</div>
          <p className="muted">
            Start the app with <code>npm run dev</code>, test email and
            password login, then create one note, one event and one document
            upload to confirm
            auth, database and storage are all connected.
          </p>
        </div>

        <div className="card">
          <div className="section-title">5. deploy</div>
          <p className="muted">
            Push the repo to GitHub, connect it to Vercel, add the same
            environment variables there and set the Supabase Auth site URL to
            the Vercel domain.
          </p>
        </div>
      </div>
    </div>
  );
}
