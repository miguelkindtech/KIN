"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/providers/AppContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { createClient } from "@/lib/supabase/client";
import { syncTableById } from "@/lib/supabase/sync";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { uid } from "@/lib/utils";
import { COST_CATEGORIES, BILLING_CYCLES } from "@/lib/constants";
import { monthlyEquivalent, annualEstimate } from "@/lib/utils";
import type { Cost } from "@/lib/types";

const EMPTY_FORM = {
  name: "",
  amount: "",
  billingCycle: "monthly",
  category: COST_CATEGORIES[0],
  ownerId: "",
  note: "",
};

export default function CostsClient() {
  const { loaded, costs, setCosts, team } = useApp();
  const supabase = useMemo(() => createClient(), []);

  useAutoSave(
    costs,
    async (currentCosts) => {
      await syncTableById(supabase, "costs", currentCosts, (cost) => ({
        id: cost.id,
        name: cost.name,
        amount: cost.amount,
        billing: cost.billingCycle,
        category:
          cost.category === "AI tools"
            ? "ai"
            : cost.category === "operations"
            ? "ops"
            : cost.category === "subscriptions"
            ? "tools"
            : cost.category,
        owner_id: cost.ownerId || null,
        active: true,
      }));
    },
    300
  );

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!loaded) {
    return <div className="loading">Loading costs...</div>;
  }

  const monthly = costs.reduce((sum, c) => sum + monthlyEquivalent(c), 0);
  const annual = costs.reduce((sum, c) => sum + annualEstimate(c), 0);

  const categoryTotals = COST_CATEGORIES.map((cat) => ({
    cat,
    total: costs
      .filter((c) => c.category === cat)
      .reduce((sum, c) => sum + monthlyEquivalent(c), 0),
  })).filter((row) => row.total > 0);

  function openAdd() {
    setForm({
      ...EMPTY_FORM,
      ownerId: team[0]?.id ?? "",
      category: COST_CATEGORIES[0],
    });
    setShowAdd(true);
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) return;
    const entry: Cost = {
      id: uid(),
      name: form.name.trim(),
      amount,
      billingCycle: form.billingCycle,
      category: form.category,
      ownerId: form.ownerId,
      note: form.note.trim(),
    };
    setCosts([...costs, entry]);
    setShowAdd(false);
    setForm({ ...EMPTY_FORM });
  }

  function handleDelete(id: string) {
    setCosts(costs.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  function ownerName(ownerId: string) {
    return team.find((m) => m.id === ownerId)?.name || "unassigned";
  }

  function formatAmount(cost: Cost) {
    if (cost.billingCycle === "annual") {
      const mo = (cost.amount / 12).toFixed(2);
      return `EUR ${cost.amount.toFixed(2)} / year (EUR ${mo}/mo)`;
    }
    return `EUR ${cost.amount.toFixed(2)} / mo`;
  }

  const deleteCost = costs.find((c) => c.id === deleteId);

  return (
    <div className="page">
      <div className="page-actions">
        <button className="action-btn" onClick={openAdd}>+ add cost</button>
      </div>

      {/* Summary metrics */}
      <div className="overview-grid-3">
        <div className="card">
          <div className="metric">
            <div className="metric-value">EUR {monthly.toFixed(2)}</div>
            <div className="metric-label">total monthly</div>
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <div className="metric-value">EUR {annual.toFixed(2)}</div>
            <div className="metric-label">total annual estimate</div>
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <div className="metric-value">{costs.length}</div>
            <div className="metric-label">active subscriptions</div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <div className="section-stack top-space">
          <div className="section-header">
            <div className="section-title">by category</div>
          </div>
          <div className="brief-card">
            {categoryTotals.map((row) => (
              <div className="brief-item" key={row.cat}>
                <span className="muted">{row.cat}</span>
                <span className="metric-value" style={{ fontSize: 13 }}>EUR {row.total.toFixed(2)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost list */}
      <div className="section-stack top-space">
        <div className="section-header">
          <div className="section-title">all costs</div>
        </div>
        {costs.length === 0 && (
          <div className="empty-state">no costs added yet</div>
        )}
        <div className="list-stack">
          {costs.map((cost) => (
            <div className="entity-card" key={cost.id}>
              <div className="entity-header">
                <div>
                  <div className="entity-title">{cost.name}</div>
                  <div className="entity-subtitle">{formatAmount(cost)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="pill">{cost.category}</span>
                  <button
                    className="item-delete"
                    onClick={() => setDeleteId(cost.id)}
                    title="delete cost"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="entity-meta">
                <span className="muted">owner: </span>{ownerName(cost.ownerId)}
                {cost.note && <span className="dim"> · {cost.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add cost modal */}
      <Modal show={showAdd} onClose={() => setShowAdd(false)} title="add cost">
        <div className="modal-field">
          <label className="modal-label">name</label>
          <input
            className="modal-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Vercel Pro"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">amount</label>
          <input
            className="modal-input"
            type="number"
            min={0}
            step={0.01}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">billing cycle</label>
          <select
            className="modal-select"
            value={form.billingCycle}
            onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">category</label>
          <select
            className="modal-select"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">owner</label>
          <select
            className="modal-select"
            value={form.ownerId}
            onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
          >
            <option value="">unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">note</label>
          <textarea
            className="notes-area"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="optional note"
            rows={2}
          />
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => setShowAdd(false)}>cancel</button>
          <button className="action-btn" onClick={handleAdd}>add cost</button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        show={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        label={deleteCost?.name ?? "cost"}
      />
    </div>
  );
}
