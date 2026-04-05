export default function SetupPage() {
  return (
    <div className="page">
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
          <div className="section-title">3. kind. ai database</div>
          <p className="muted">
            Run <code>lib/rag/schema.sql</code> in the Supabase SQL editor as a
            second step. This enables <code>pgvector</code>, creates the{" "}
            <code>kin_embeddings</code> table and the{" "}
            <code>match_embeddings</code> RPC function.
          </p>
        </div>

        <div className="card">
          <div className="section-title">4. board access</div>
          <p className="muted">
            Create the board users in Supabase Auth first, then update the email
            placeholders in <code>supabase/seed.sql</code> and run it to insert
            the profile rows plus the initial kind. data.
          </p>
        </div>

        <div className="card">
          <div className="section-title">5. environment variables</div>
          <div className="setup-checklist">
            <div className="setup-item">
              <strong>NEXT_PUBLIC_SUPABASE_URL</strong>
              <span>Your public Supabase project URL.</span>
            </div>
            <div className="setup-item">
              <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>
              <span>Your public browser key.</span>
            </div>
            <div className="setup-item">
              <strong>SUPABASE_SERVICE_ROLE_KEY</strong>
              <span>
                Secret server-side key used only for indexing and retrieval.
              </span>
            </div>
            <div className="setup-item">
              <strong>OPENAI_API_KEY</strong>
              <span>
                Used for embeddings with <code>text-embedding-3-small</code>.
              </span>
            </div>
            <div className="setup-item">
              <strong>ANTHROPIC_API_KEY</strong>
              <span>
                Used for chat answers with <code>claude-sonnet-4-20250514</code>.
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">6. first indexing</div>
          <p className="muted">
            After the env vars are set, start the app and run a one-time POST to{" "}
            <code>/api/reindex</code>. Example:
          </p>
          <pre className="setup-code">
            <code>curl -X POST http://127.0.0.1:3010/api/reindex</code>
          </pre>
          <p className="muted">
            From that point on, kind. AI auto-indexes changes to verticals,
            applied, notes, events, costs, team and day notes.
          </p>
        </div>

        <div className="card">
          <div className="section-title">7. local validation</div>
          <p className="muted">
            Start the app with <code>npm run dev</code>, test email and
            password login, then create one note, one event and one document
            upload to confirm
            auth, database and storage are all connected.
          </p>
        </div>

        <div className="card">
          <div className="section-title">8. kind. ai test</div>
          <p className="muted">
            Open the floating avatar button in the bottom-right corner and ask:
          </p>
          <pre className="setup-code">
            <code>What&apos;s the state of Compy?</code>
          </pre>
          <p className="muted">
            If it says it has no information, run the reindex step again.
          </p>
        </div>

        <div className="card">
          <div className="section-title">9. deploy</div>
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
