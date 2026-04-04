"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/providers/AppContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { uid } from "@/lib/utils";
import { COLOR_PALETTE } from "@/lib/constants";
import type { TeamMember, TalentEntry } from "@/lib/types";

const TALENT_COLUMNS: { key: string; label: string }[] = [
  { key: "observing", label: "Observing" },
  { key: "contact", label: "Contact" },
  { key: "interviewing", label: "Interviewing" },
  { key: "future_fit", label: "Future Fit" },
];

const EMPTY_MEMBER: Omit<TeamMember, "id"> = {
  name: "",
  role: "",
  initials: "",
  focusArea: "",
  color: COLOR_PALETTE[0],
  status: "active",
};

const EMPTY_TALENT: Omit<TalentEntry, "id"> = {
  name: "",
  linkedin: "",
  role: "",
  notes: "",
  tags: [],
  status: "observing",
};

export default function TeamClient() {
  const { loaded, team, setTeam, talent, setTalent } = useApp();
  const supabase = useMemo(() => createClient(), []);

  useAutoSave(
    team,
    async (currentTeam) => {
      await syncTableById(supabase, "team", currentTeam, (member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        focus: member.focusArea || "",
        color: member.color,
        type: /chief|ceo|coo|cso|board/i.test(member.role) ? "board" : "team",
        status: member.status,
      }));
    },
    300
  );

  useAutoSave(
    talent,
    async (currentTalent) => {
      await syncTableById(supabase, "talent", currentTalent, (item) => ({
        id: item.id,
        name: item.name,
        role: item.role || "",
        status: item.status.replace(" ", "_"),
        notes: item.notes,
      }));
    },
    300
  );

  const [tab, setTab] = useState<"team" | "talent">("team");

  // Team state
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);

  // Talent state
  const [showAddTalent, setShowAddTalent] = useState(false);
  const [talentForm, setTalentForm] = useState({ ...EMPTY_TALENT, tagsInput: "" });
  const [deleteTalentId, setDeleteTalentId] = useState<string | null>(null);

  if (!loaded) {
    return <div className="loading">Loading team...</div>;
  }

  // ---- TEAM handlers ----
  function openAddMember() {
    setMemberForm({ ...EMPTY_MEMBER });
    setShowAddMember(true);
  }

  function handleAddMember() {
    if (!memberForm.name.trim()) return;
    const entry: TeamMember = { id: uid(), ...memberForm };
    setTeam([...team, entry]);
    setShowAddMember(false);
  }

  function openEditMember(member: TeamMember) {
    setMemberForm({
      name: member.name,
      role: member.role,
      initials: member.initials,
      focusArea: member.focusArea,
      color: member.color,
      status: member.status,
    });
    setEditMember(member);
  }

  function handleSaveMember() {
    if (!editMember) return;
    setTeam(team.map((m) => (m.id === editMember.id ? { ...editMember, ...memberForm } : m)));
    setEditMember(null);
  }

  function handleDeleteMember(id: string) {
    setTeam(team.filter((m) => m.id !== id));
    setDeleteMemberId(null);
    if (editMember?.id === id) setEditMember(null);
  }

  // ---- TALENT handlers ----
  function openAddTalent() {
    setTalentForm({ ...EMPTY_TALENT, tagsInput: "" });
    setShowAddTalent(true);
  }

  function handleAddTalent() {
    if (!talentForm.name.trim()) return;
    const tags = talentForm.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const entry: TalentEntry = {
      id: uid(),
      name: talentForm.name.trim(),
      linkedin: (talentForm.linkedin || "").trim(),
      role: talentForm.role.trim(),
      notes: talentForm.notes.trim(),
      tags,
      status: talentForm.status,
    };
    setTalent([...talent, entry]);
    setShowAddTalent(false);
  }

  function handleDeleteTalent(id: string) {
    setTalent(talent.filter((t) => t.id !== id));
    setDeleteTalentId(null);
  }

  const deleteMember = team.find((m) => m.id === deleteMemberId);
  const deleteTalentEntry = talent.find((t) => t.id === deleteTalentId);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">team</div>
          <div className="page-subtitle">People and talent pipeline.</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar" style={{ marginBottom: 24 }}>
        <button
          className={tab === "team" ? "action-btn small-btn" : "ghost-btn small-btn"}
          onClick={() => setTab("team")}
        >
          team
        </button>
        <button
          className={tab === "talent" ? "action-btn small-btn" : "ghost-btn small-btn"}
          onClick={() => setTab("talent")}
        >
          talent
        </button>
      </div>

      {/* ===== TEAM TAB ===== */}
      {tab === "team" && (
        <div>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div className="section-title">members</div>
            <button className="action-btn small-btn" onClick={openAddMember}>+ add member</button>
          </div>
          {team.length === 0 && <div className="empty-state">no team members yet</div>}
          <div className="cards-grid">
            {team.map((member) => (
              <div
                className="entity-card"
                key={member.id}
                onClick={() => openEditMember(member)}
                style={{ cursor: "pointer" }}
              >
                <div className="entity-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ background: member.color }}>
                      {member.initials}
                    </div>
                    <div>
                      <div className="entity-title">{member.name}</div>
                      <div className="entity-subtitle">{member.role}</div>
                    </div>
                  </div>
                  <div className={`badge${member.status !== "active" ? " dot" : ""}`}>
                    {member.status}
                  </div>
                </div>
                {member.focusArea && (
                  <div className="entity-meta">{member.focusArea}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TALENT TAB ===== */}
      {tab === "talent" && (
        <div>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div className="section-title">pipeline</div>
            <button className="action-btn small-btn" onClick={openAddTalent}>+ add talent</button>
          </div>
          <div className="two-col talent-grid">
            {TALENT_COLUMNS.map((col) => {
              const entries = talent.filter((t) => t.status === col.key);
              return (
                <div className="section-stack" key={col.key}>
                  <div className="section-header">
                    <div className="section-title">{col.label}</div>
                    <span className="pill">{entries.length}</span>
                  </div>
                  {entries.length === 0 && (
                    <div className="empty-state" style={{ fontSize: 12 }}>none</div>
                  )}
                  <div className="list-stack">
                    {entries.map((entry) => (
                      <div className="entity-card" key={entry.id}>
                        <div className="entity-header">
                          <div>
                            <div className="entity-title">{entry.name}</div>
                            {entry.linkedin && (
                              <div className="entity-subtitle">
                                <a
                                  href={entry.linkedin.startsWith("http") ? entry.linkedin : `https://${entry.linkedin}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="muted"
                                  style={{ fontSize: 12 }}
                                >
                                  {entry.linkedin}
                                </a>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="pill">{entry.status}</span>
                            <button
                              className="item-delete"
                              onClick={() => setDeleteTalentId(entry.id)}
                              title="delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {entry.notes && (
                          <div className="entity-meta dim">{entry.notes}</div>
                        )}
                        {entry.tags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {entry.tags.map((tag) => (
                              <span className="pill" key={tag} style={{ fontSize: 11 }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== ADD MEMBER MODAL ===== */}
      <Modal show={showAddMember} onClose={() => setShowAddMember(false)} title="add member">
        <div className="modal-field">
          <label className="modal-label">name</label>
          <input
            className="modal-input"
            value={memberForm.name}
            onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
            placeholder="full name"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">role</label>
          <input
            className="modal-input"
            value={memberForm.role}
            onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
            placeholder="e.g. Head of Product"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">initials</label>
          <input
            className="modal-input"
            value={memberForm.initials}
            onChange={(e) => setMemberForm({ ...memberForm, initials: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="e.g. JD"
            maxLength={3}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">focus area</label>
          <input
            className="modal-input"
            value={memberForm.focusArea}
            onChange={(e) => setMemberForm({ ...memberForm, focusArea: e.target.value })}
            placeholder="e.g. Growth"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">status</label>
          <select
            className="modal-select"
            value={memberForm.status}
            onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value })}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">color</label>
          <div className="color-palette">
            {COLOR_PALETTE.map((c) => (
              <div
                key={c}
                className={`swatch${memberForm.color === c ? " selected" : ""}`}
                style={{ background: c }}
                onClick={() => setMemberForm({ ...memberForm, color: c })}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => setShowAddMember(false)}>cancel</button>
          <button className="action-btn" onClick={handleAddMember}>add member</button>
        </div>
      </Modal>

      {/* ===== EDIT MEMBER MODAL ===== */}
      <Modal show={!!editMember} onClose={() => setEditMember(null)} title="edit member">
        <div className="modal-field">
          <label className="modal-label">name</label>
          <input
            className="modal-input"
            value={memberForm.name}
            onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">role</label>
          <input
            className="modal-input"
            value={memberForm.role}
            onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">initials</label>
          <input
            className="modal-input"
            value={memberForm.initials}
            onChange={(e) => setMemberForm({ ...memberForm, initials: e.target.value.toUpperCase().slice(0, 3) })}
            maxLength={3}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">focus area</label>
          <input
            className="modal-input"
            value={memberForm.focusArea}
            onChange={(e) => setMemberForm({ ...memberForm, focusArea: e.target.value })}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">status</label>
          <select
            className="modal-select"
            value={memberForm.status}
            onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value })}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">color</label>
          <div className="color-palette">
            {COLOR_PALETTE.map((c) => (
              <div
                key={c}
                className={`swatch${memberForm.color === c ? " selected" : ""}`}
                style={{ background: c }}
                onClick={() => setMemberForm({ ...memberForm, color: c })}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="danger-btn"
            style={{ marginRight: "auto" }}
            onClick={() => {
              setEditMember(null);
              setDeleteMemberId(editMember!.id);
            }}
          >
            delete
          </button>
          <button className="ghost-btn" onClick={() => setEditMember(null)}>cancel</button>
          <button className="action-btn" onClick={handleSaveMember}>save</button>
        </div>
      </Modal>

      {/* ===== ADD TALENT MODAL ===== */}
      <Modal show={showAddTalent} onClose={() => setShowAddTalent(false)} title="add talent">
        <div className="modal-field">
          <label className="modal-label">name</label>
          <input
            className="modal-input"
            value={talentForm.name}
            onChange={(e) => setTalentForm({ ...talentForm, name: e.target.value })}
            placeholder="full name"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">linkedin</label>
          <input
            className="modal-input"
            value={talentForm.linkedin}
            onChange={(e) => setTalentForm({ ...talentForm, linkedin: e.target.value })}
            placeholder="linkedin.com/in/..."
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">notes</label>
          <textarea
            className="notes-area"
            value={talentForm.notes}
            onChange={(e) => setTalentForm({ ...talentForm, notes: e.target.value })}
            placeholder="optional notes"
            rows={2}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">tags (comma-separated)</label>
          <input
            className="modal-input"
            value={talentForm.tagsInput}
            onChange={(e) => setTalentForm({ ...talentForm, tagsInput: e.target.value })}
            placeholder="e.g. engineering, senior, remote"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">status</label>
          <select
            className="modal-select"
            value={talentForm.status}
            onChange={(e) => setTalentForm({ ...talentForm, status: e.target.value })}
          >
            <option value="observing">observing</option>
            <option value="contact">contact</option>
            <option value="interviewing">interviewing</option>
            <option value="future_fit">future fit</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => setShowAddTalent(false)}>cancel</button>
          <button className="action-btn" onClick={handleAddTalent}>add talent</button>
        </div>
      </Modal>

      {/* ===== DELETE MEMBER CONFIRM ===== */}
      <ConfirmModal
        show={!!deleteMemberId}
        onClose={() => setDeleteMemberId(null)}
        onConfirm={() => deleteMemberId && handleDeleteMember(deleteMemberId)}
        label={deleteMember?.name ?? "member"}
      />

      {/* ===== DELETE TALENT CONFIRM ===== */}
      <ConfirmModal
        show={!!deleteTalentId}
        onClose={() => setDeleteTalentId(null)}
        onConfirm={() => deleteTalentId && handleDeleteTalent(deleteTalentId)}
        label={deleteTalentEntry?.name ?? "talent entry"}
      />
    </div>
  );
}
