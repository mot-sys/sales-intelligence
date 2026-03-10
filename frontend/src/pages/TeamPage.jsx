/**
 * TeamPage  (P2.1 — Multi-user per organisation)
 *
 * Shows all users in the org, lets admins/owners invite new members
 * and change / remove existing users.
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, RefreshCw, Crown, Shield, Eye, User } from 'lucide-react';
import { get, post, del } from '../api/client';
import * as API from '../api/client';

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_META = {
  owner:  { label: 'Owner',  icon: Crown,  color: 'text-yellow-700 bg-yellow-100' },
  admin:  { label: 'Admin',  icon: Shield, color: 'text-purple-700 bg-purple-100' },
  member: { label: 'Member', icon: User,   color: 'text-blue-700   bg-blue-100'   },
  viewer: { label: 'Viewer', icon: Eye,    color: 'text-gray-700   bg-gray-100'   },
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.member;
  const Icon = meta.icon;
  return (
    <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteRole,   setInviteRole]   = useState('member');
  const [inviteName,   setInviteName]   = useState('');
  const [inviting,     setInviting]     = useState(false);
  const [inviteResult, setInviteResult] = useState(null);  // { ok, msg, url? }
  const [myRole,       setMyRole]       = useState('member');
  const [error,        setError]        = useState(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get('/team');
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message || 'Kunne ikke hente teammedlemmer');
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect own role from /auth/me
  useEffect(() => {
    fetchTeam();
    get('/auth/me').then(me => setMyRole(me.role || 'member')).catch(() => {});
  }, [fetchTeam]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await post('/team/invite', {
        email: inviteEmail.trim(),
        role:  inviteRole,
        name:  inviteName.trim() || undefined,
      });
      setInviteResult({
        ok:  true,
        msg: `Invitation oprettet for ${res.email}`,
        url: res.invite_url,
        token: res.invite_token,
      });
      setInviteEmail('');
      setInviteName('');
      await fetchTeam();
    } catch (e) {
      setInviteResult({ ok: false, msg: e.message || 'Invitation mislykkedes' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId, userEmail) => {
    if (!window.confirm(`Fjern ${userEmail} fra organisationen?`)) return;
    try {
      await del(`/team/${userId}`);
      await fetchTeam();
    } catch (e) {
      setError(e.message || 'Kunne ikke fjerne bruger');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await API.patch(`/team/${userId}/role`, { role: newRole });
      await fetchTeam();
    } catch (e) {
      setError(e.message || 'Kunne ikke ændre rolle');
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Team
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Administrer teammedlemmer og adgangsniveauer for din organisation.
            </p>
          </div>
          <button
            onClick={fetchTeam}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Opdater
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── User list ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">{users.length} bruger{users.length !== 1 ? 'e' : ''}</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Henter teammedlemmer…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Ingen brugere endnu.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.name || <span className="text-gray-400 italic">Intet navn</span>}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                    {u.is_pending && (
                      <span className="text-xs text-amber-600 font-medium">⏳ Invitation afventer</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManage && u.role !== 'owner' ? (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <RoleBadge role={u.role} />
                  )}
                  {canManage && u.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(u.id, u.email)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Fjern bruger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Invite form ───────────────────────────────────────────────────── */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-blue-600" />
            Invitér nyt teammedlem
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="email"
              placeholder="Email-adresse *"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Navn (valgfrit)"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? 'Sender…' : 'Send invitation'}
            </button>
          </div>

          {inviteResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              inviteResult.ok
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {inviteResult.ok ? '✅' : '⚠️'} {inviteResult.msg}
              {inviteResult.url && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Send dette link manuelt:</p>
                  <code className="block bg-white border border-green-100 px-2 py-1.5 rounded text-xs text-gray-700 break-all select-all">
                    {inviteResult.url}
                  </code>
                </div>
              )}
              {!inviteResult.url && inviteResult.token && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">Invite token (sæt FRONTEND_URL for fuld URL):</p>
                  <code className="block bg-white border border-green-100 px-2 py-1.5 rounded text-xs text-gray-700 break-all select-all">
                    {inviteResult.token}
                  </code>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
            <p><strong>Roller:</strong></p>
            <p>🔑 <strong>Admin</strong> — Kan invitere/fjerne members og viewers, se alt</p>
            <p>👤 <strong>Member</strong> — Fuld læse/skriveadgang (standard)</p>
            <p>👁 <strong>Viewer</strong> — Kun læsning</p>
          </div>
        </div>
      )}

      {!canManage && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-sm text-gray-500 text-center">
          Kun admins og owners kan invitere og fjerne brugere.
        </div>
      )}
    </div>
  );
}
