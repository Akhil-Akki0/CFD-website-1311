/**
 * Production Hardened Authentication, Security & 2FA Modal
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  X,
  Smartphone,
  Laptop,
  Trash2,
  RefreshCw,
  LogOut,
  Info
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isAuthModalOpen,
    closeAuthModal,
    login,
    signup,
    logout,
    setup2FA,
    verify2FA,
    disable2FA,
    sessions,
    fetchSessions,
    revokeSession,
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'signup' | 'security'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotpInput, setShowTotpInput] = useState(false);

  // 2FA Setup State
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  // Status & Error
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      if (isAuthenticated) {
        setTab('security');
        fetchSessions().catch(() => {});
      } else {
        setTab('login');
      }
    }
  }, [isAuthModalOpen, isAuthenticated, fetchSessions]);

  if (!isAuthModalOpen) return null;

  // Password Strength Checker
  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password, totpCode || undefined);
      if (res.requires2FA) {
        setShowTotpInput(true);
        setErrorMsg('Two-Factor Authentication is required for this account. Enter the 6-digit code from your authenticator app.');
      } else {
        setSuccessMsg('Successfully authenticated with short-lived JWT & rotating refresh cookies.');
        setTimeout(() => closeAuthModal(), 900);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (strengthScore < 5) {
      setErrorMsg('Password does not meet the minimum 12-character high-entropy policy.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(email, name, password);
      setSuccessMsg('Account registered securely. Email verification token created.');
      setTimeout(() => {
        setTab('login');
        setSuccessMsg('Please log in with your newly registered credentials.');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string, targetPass: string, isSeedAdmin = false) => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (isSeedAdmin) {
        // Admin requires 2FA or demo trigger
        setShowTotpInput(true);
        setTotpCode('');
        setErrorMsg('Admin account has mandatory 2FA enabled. Enter your authenticator code or contact lead engineer.');
      } else {
        await login(targetEmail, targetPass);
        setSuccessMsg(`Authenticated as standard operator (${targetEmail})`);
        setTimeout(() => closeAuthModal(), 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart2FASetup = async () => {
    setErrorMsg(null);
    try {
      const res = await setup2FA();
      setTwoFaSecret(res.secret);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleConfirm2FA = async () => {
    setErrorMsg(null);
    try {
      await verify2FA(verifyCode);
      setSuccessMsg('Two-factor authentication is now active on your account.');
      setTwoFaSecret(null);
      setVerifyCode('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDisable2FA = async () => {
    setErrorMsg(null);
    try {
      await disable2FA(disablePassword, verifyCode);
      setSuccessMsg('2FA has been disabled.');
      setDisablePassword('');
      setVerifyCode('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-surface border border-white/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-md">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-400/30 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {isAuthenticated ? 'Security & Account Center' : 'OpenFOAM Engineering Authentication'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                OWASP Top 10 Hardened • JWT 15m • Rotating Refresh 7d
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40 border border-transparent hover:border-white/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 pt-2 gap-4 text-xs font-medium">
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => { setTab('login'); setErrorMsg(null); }}
                className={`pb-3 border-b-2 transition-colors ${
                  tab === 'login'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setErrorMsg(null); }}
                className={`pb-3 border-b-2 transition-colors ${
                  tab === 'signup'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                Register Account
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setTab('security')}
                className="pb-3 border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 font-semibold"
              >
                Active Sessions & 2FA
              </button>
            </>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="engineer@aerocfd.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {showTotpInput && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-sky-900 dark:text-sky-300">
                    Authenticator Code (TOTP 2FA)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-sky-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full pl-9 pr-3 py-2 font-mono text-center tracking-widest text-sm rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <p className="text-[10px] text-sky-700 dark:text-sky-400">
                    Mandatory for administrative privileges.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Sign In to Engineering Workbench
              </button>

              {/* Quick Test Accounts Bar */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 mb-2">
                  Quick Verification Test Accounts (Seed DB):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('operator@cfd.local', 'UserCFD@2026#Secure', false)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-[11px] transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Operator User</div>
                    <div className="text-[10px] text-slate-400">operator@cfd.local</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('akkedu01@gmail.com', 'AdminCFD@2026#Secure', true)}
                    className="p-2 rounded-lg border border-sky-200 dark:border-sky-900/50 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 text-left text-[11px] transition-colors"
                  >
                    <div className="font-semibold text-sky-700 dark:text-sky-300">Lead Admin (2FA)</div>
                    <div className="text-[10px] text-slate-400">akkedu01@gmail.com</div>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: SIGNUP */}
          {tab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / Call-Sign
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Aerodynamicist"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aerospace@university.edu"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password (High-Entropy Policy: Min 12 Characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 12 chars + Upper + Lower + Number + Special"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Password Strength Checklist */}
                <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Entropy Score:</span>
                    <span className="font-mono text-sky-600 dark:text-sky-400">{strengthScore} / 5</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className={hasLength ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                    <span>12+ characters length</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className={hasUpper && hasLower ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                    <span>Uppercase and lowercase letters</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className={hasNumber ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                    <span>Numeric digits (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className={hasSymbol ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                    <span>Special symbols (!@#$%^&*)</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || strengthScore < 5}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Registering...' : 'Create Secure Account'}
              </button>
            </form>
          )}

          {/* TAB 3: SECURITY & SESSIONS */}
          {tab === 'security' && user && (
            <div className="space-y-5">
              {/* User Profile Overview */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    {user.name}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        user.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {user.role.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">{user.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              {/* 2FA Section */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Two-Factor Authentication (TOTP)
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      user.totpEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {user.totpEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {!user.totpEnabled && !twoFaSecret && (
                  <button
                    onClick={handleStart2FASetup}
                    className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    Set Up Authenticator App
                  </button>
                )}

                {twoFaSecret && (
                  <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg space-y-2 text-xs">
                    <div className="font-semibold text-sky-900 dark:text-sky-300">
                      Step 1: Enter Secret Key into Authenticator
                    </div>
                    <div className="font-mono bg-white dark:bg-slate-900 p-2 rounded border border-sky-300 text-center select-all tracking-wider text-xs">
                      {twoFaSecret}
                    </div>
                    <div className="font-semibold text-sky-900 dark:text-sky-300 pt-2">
                      Step 2: Enter 6-Digit Code to Confirm
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        placeholder="123456"
                        className="flex-1 px-3 py-1.5 text-center font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={handleConfirm2FA}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium"
                      >
                        Activate
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Sessions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Authorized Device Sessions
                  </span>
                  <button
                    onClick={() => fetchSessions()}
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No external sessions logged.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sessions.map((s) => (
                      <div
                        key={s.sessionId}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {s.device || 'Desktop Session'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              IP: {s.ip} • Last seen: {new Date(s.lastSeen).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => revokeSession(s.sessionId)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Revoke Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-500" />
            <span>Tokens are stored in memory & HttpOnly cookies.</span>
          </div>
          <span className="font-mono text-[10px]">DEVELOPED by Akhil.A</span>
        </div>
      </div>
    </div>
  );
};
