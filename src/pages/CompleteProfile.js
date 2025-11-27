import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { getUserSession, saveUserSession } from '../lib/session';
import { ROLES, ROLE_LABELS } from '../constants/roles';

export default function CompleteProfile() {
  const nav = useNavigate();
  const sess = getUserSession();
  const [role, setRole] = useState(ROLES.GUEST);
  const [busy, setBusy] = useState(false);

  if (!sess?.uid) return <p>Please login first.</p>;

  async function onSave(e) {
    e.preventDefault();
    try {
      setBusy(true);
      const updated = await apiPost('/users/upsert', {
        uid: sess.uid,
        email: sess.email,
        displayName: sess.displayName || '',
        role,
      });
      // keep session in sync
      saveUserSession({ ...sess, role: updated.role });
      nav('/dashboard', { replace: true });
    } catch (err) {
      alert('Failed to save role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560, padding: 24 }}>
      <h2>Complete Profile</h2>
      <p>Select how you’ll use Nesta.</p>
      <form onSubmit={onSave}>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {Object.values(ROLES).map((r) => (
            <label key={r} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
        <button type="submit" disabled={busy} style={{ marginTop: 16 }}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
} 