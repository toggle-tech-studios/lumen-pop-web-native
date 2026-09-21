import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as dbRef, get as dbGet, set as dbSet } from 'firebase/database';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, db, rtdb, googleProvider, appleProvider } from './firebase';
import { ChevronRight, User as UserIcon, X, LogOut, Mail, Sparkles, Trophy, Gem, ShieldCheck } from 'lucide-react';

// Helper to guarantee network calls never hang indefinitely
function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

// --- UsernameScreen ---

export function UsernameScreen({ 
  onComplete 
}: { 
  onComplete: (username: string) => void 
}) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim();
    if (!clean || clean.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_\-\.]+$/.test(clean)) {
      setError('Only lowercase letters, numbers, and - _ . allowed');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const lower = clean.toLowerCase();
    let isTaken = false;

    // 1. Check in Cloud Firestore (with 2s timeout)
    if (!isTaken && db) {
      try {
        const snap = await withTimeout(getDoc(doc(db, 'usernames', lower)), 2000);
        if (snap && snap.exists()) {
          isTaken = true;
        }
      } catch (fsErr) {
        console.warn('Firestore check note:', fsErr);
      }
    }

    // 2. Check in Realtime Database (with 2s timeout)
    if (!isTaken && rtdb) {
      try {
        const snapshot = await withTimeout(dbGet(dbRef(rtdb, `usernames/${lower}`)), 2000);
        if (snapshot && snapshot.exists()) {
          isTaken = true;
        }
      } catch (rtdbErr) {
        console.warn('RTDB check note:', rtdbErr);
      }
    }

    if (isTaken) {
      setError('Username is already taken. Try another!');
      setLoading(false);
      return;
    }

    // Reserve username asynchronously (non-blocking)
    const payload = {
      username: clean,
      createdAt: new Date().toISOString()
    };

    if (db) {
      withTimeout(setDoc(doc(db, 'usernames', lower), payload, { merge: true }), 2000).catch(() => undefined);
    }

    if (rtdb) {
      withTimeout(dbSet(dbRef(rtdb, `usernames/${lower}`), payload), 2000).catch(() => undefined);
    }

    setLoading(false);
    onComplete(clean);
  };

  return (
    <div className="center-screen game-shell">
      <div className="land-blob left-[8%] top-[15%] h-28 w-28 bg-cyan-300/15" />
      <div className="land-blob bottom-[13%] right-[7%] h-44 w-44 bg-pink-300/15" />
      
      <div className="stagger relative flex max-w-sm w-full mx-4 flex-col items-center text-center p-8 bg-[#12053c]/90 rounded-[2.5rem] border border-white/15 shadow-2xl backdrop-blur-md">
        <div className="sparkle mb-4 w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
          <UserIcon size={32} className="text-cyan-300 drop-shadow-[0_0_12px_#00f0ff]" />
        </div>
        
        <span className="eyebrow text-cyan-200 uppercase tracking-widest text-[11px]">Welcome Adventurer</span>
        <h1 className="display text-3xl font-extrabold text-white mt-1 mb-2">Claim Your Name</h1>
        <p className="text-white/65 text-xs mb-6 max-w-xs">Pick a unique stargazer username before entering the glowing meadows.</p>
        
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="w-full relative">
            <input 
              type="text" 
              placeholder="e.g. CosmicStar" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3.5 text-white font-medium placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all text-center tracking-wide text-base"
              maxLength={15}
              autoFocus
            />
          </div>
          {error && <p className="text-pink-300 text-xs mt-2.5 px-2 py-1 rounded bg-pink-900/30 border border-pink-500/20">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 w-full mt-5 py-3 text-sm font-bold shadow-[0_0_20px_rgba(255,187,66,0.3)]"
          >
            {loading ? 'Checking availability...' : 'Start Playing'} <ChevronRight size={18} />
          </button>
        </form>
        
        <p className="mt-4 text-[11px] text-white/40">Username is required to save your constellation score.</p>
      </div>
    </div>
  );
}

// --- AuthOverlay ---

export function AuthOverlay({ 
  onClose, 
  username,
  coins = 0,
  highestLevel = 1,
  totalStars = 0
}: { 
  onClose: () => void;
  username: string;
  coins?: number;
  highestLevel?: number;
  totalStars?: number;
}) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [mode, setMode] = useState<'menu' | 'email-sign-in' | 'email-sign-up'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync profile and progress to both Firestore and Realtime Database
        const payload = {
          username,
          email: u.email,
          photoURL: u.photoURL,
          coins,
          highestLevel,
          lastSeen: new Date().toISOString()
        };

        if (rtdb) {
          try {
            dbSet(dbRef(rtdb, `users/${u.uid}`), payload).catch(() => undefined);
          } catch {
            // ignore
          }
        }

        if (db) {
          try {
            setDoc(doc(db, 'users', u.uid), payload, { merge: true }).catch(() => undefined);
          } catch {
            // ignore
          }
        }
      }
    });
  }, [username, coins, highestLevel]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message?.replace('Firebase: ', '') || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, appleProvider);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message?.replace('Firebase: ', '') || 'Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'email-sign-up') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message?.replace('Firebase: ', '') || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  // Signed in profile view
  if (user) {
    return (
      <div className="overlay z-[100] p-4 flex items-center justify-center">
        <div className="modal relative w-full max-w-sm bg-[#130638] border border-cyan-500/30 rounded-[2rem] p-7 shadow-2xl">
          <button onClick={onClose} className="absolute right-5 top-5 text-white/50 hover:text-white transition-colors" aria-label="Close">
            <X size={20} />
          </button>
          
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.4)] mb-3 bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-white">{username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-black text-white m-0 tracking-tight">{username}</h2>
              <ShieldCheck size={18} className="text-cyan-400" />
            </div>
            <p className="text-xs text-white/60 mt-0.5">{user.email || 'Linked Account'}</p>
          </div>

          {/* Player stats cards */}
          <div className="grid grid-cols-3 gap-2 mb-6 text-center">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <Trophy size={16} className="text-yellow-300 mx-auto mb-1" />
              <div className="text-sm font-bold text-white leading-tight">Lvl {highestLevel}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/50 mt-0.5">Progress</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <Sparkles size={16} className="text-cyan-300 mx-auto mb-1" />
              <div className="text-sm font-bold text-white leading-tight">{totalStars}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/50 mt-0.5">Stars</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
              <Gem size={16} className="text-pink-300 mx-auto mb-1" />
              <div className="text-sm font-bold text-white leading-tight">{coins.toLocaleString()}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/50 mt-0.5">Shards</div>
            </div>
          </div>

          <button 
            onClick={handleSignOut} 
            disabled={loading}
            className="btn-ghost flex items-center justify-center gap-2 w-full text-pink-300 border-pink-500/20 hover:bg-pink-500/10 text-xs py-2.5"
          >
            <LogOut size={16} /> {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  // Not signed in view
  return (
    <div className="overlay z-[100] p-4 flex items-center justify-center">
      <div className="modal relative w-full max-w-sm bg-[#130638] border border-white/20 rounded-[2rem] p-7 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-white/50 hover:text-white transition-colors" aria-label="Close">
          <X size={20} />
        </button>
        
        <div className="flex flex-col items-center mb-5 mt-1 text-center">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center mb-3">
            <UserIcon size={28} className="text-cyan-200" />
          </div>
          <h2 className="text-xl font-bold text-white m-0">Sign In to Lumen Pop</h2>
          <p className="text-xs text-white/60 mt-1.5 max-w-xs">
            Signing in is optional. Link an account to backup your progress across devices and keep your username secure.
          </p>
        </div>

        {error && (
          <p className="text-pink-300 text-xs mb-4 text-center bg-pink-900/30 border border-pink-500/20 p-2 rounded-xl">
            {error}
          </p>
        )}

        {mode === 'menu' ? (
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleGoogleSignIn} 
              disabled={loading}
              className="btn-soft w-full flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-100 font-bold py-3 shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>

            <button 
              onClick={handleAppleSignIn} 
              disabled={loading}
              className="btn-soft w-full flex items-center justify-center gap-3 bg-black text-white border border-white/25 hover:bg-white/10 font-bold py-3"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.65-.8 1.09-1.92.97-3.04-1 .04-2.19.67-2.89 1.48-.61.7-.1.14 1.86-.98 2.99 1.1.09 2.24-.62 2.9-1.43"/>
              </svg>
              Continue with Apple
            </button>

            <div className="flex items-center gap-3 my-1 opacity-40">
              <div className="h-px bg-white flex-1" />
              <span className="text-[10px] font-bold uppercase tracking-widest">OR</span>
              <div className="h-px bg-white flex-1" />
            </div>

            <button 
              onClick={() => setMode('email-sign-in')} 
              className="btn-soft w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              <Mail size={16} /> Continue with Email
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-cyan-300 text-sm"
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-cyan-300 text-sm"
              required
              minLength={6}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1 py-3 text-sm font-bold">
              {loading ? 'Please wait...' : mode === 'email-sign-up' ? 'Create Account' : 'Sign In'}
            </button>
            
            <button 
              type="button" 
              onClick={() => setMode(mode === 'email-sign-up' ? 'email-sign-in' : 'email-sign-up')} 
              className="text-xs text-cyan-300 mt-1 hover:underline text-center"
            >
              {mode === 'email-sign-up' ? 'Already have an account? Sign In' : "Need an account? Sign Up"}
            </button>
            
            <button 
              type="button" 
              onClick={() => setMode('menu')} 
              className="text-xs text-white/50 mt-2 hover:text-white flex items-center justify-center gap-1.5"
            >
              ← Back to options
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Instagram-style Profile DP Icon ---

export function ProfileDP({ onClick, username }: { onClick: () => void; username?: string }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return (
    <button 
      onClick={onClick}
      className="absolute top-3.5 left-4 z-40 w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_14px_rgba(0,240,255,0.35)] active:scale-95 transition-transform cursor-pointer"
      aria-label="User Profile"
      title={user ? `Signed in as ${user.email || username}` : 'Profile & Sign In'}
    >
      <div className="w-full h-full rounded-full bg-[#12053c] overflow-hidden flex items-center justify-center">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
        ) : user ? (
          <span className="text-sm font-extrabold text-cyan-200">
            {username?.charAt(0).toUpperCase() || 'U'}
          </span>
        ) : (
          /* Instagram-style empty avatar placeholder silhouette */
          <div className="w-full h-full bg-[#1b0b4a] flex flex-col items-center justify-center pt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-white/50 mb-0.5" />
            <div className="w-6 h-3 rounded-t-full bg-white/50" />
          </div>
        )}
      </div>
    </button>
  );
}
