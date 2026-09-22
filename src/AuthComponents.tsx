import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as dbRef, get as dbGet, set as dbSet } from 'firebase/database';
import { 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, db, rtdb, googleProvider, appleProvider } from './firebase';
import { ChevronRight, User as UserIcon, X, LogOut, Mail, Sparkles, Trophy, Gem, ShieldCheck } from 'lucide-react';

// Helper to format safe keys for Firebase Realtime Database
export function toDbKey(name: string): string {
  return encodeURIComponent(name.toLowerCase().trim()).replace(/\./g, '%2E');
}

// Helper to guarantee network calls never hang indefinitely
function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

// --- UsernameScreen ---

export function UsernameScreen({ onComplete, onOpenAuth }: { onComplete: (username: string) => void, onOpenAuth?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_\-\.]+$/.test(clean)) {
      setError('Only lowercase letters, numbers, and - _ . allowed');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    // For new signups, if they don't want capital letters we can guide them, but allow existing passwords like TEST@123
    if (!isReturning && /[A-Z]/.test(password)) {
      setError('New passwords must not contain capital letters');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const dummyEmail = `${clean}@lumenpop.local`;

    try {
      if (isReturning) {
        // Log in: try with entered password first, fallback to lowercase/uppercase if needed
        try {
          await signInWithEmailAndPassword(auth, dummyEmail, password);
        } catch (err1: any) {
          if (password !== password.toLowerCase()) {
            try {
              await signInWithEmailAndPassword(auth, dummyEmail, password.toLowerCase());
            } catch {
              throw err1;
            }
          } else if (password !== password.toUpperCase()) {
            try {
              await signInWithEmailAndPassword(auth, dummyEmail, password.toUpperCase());
            } catch {
              throw err1;
            }
          } else {
            throw err1;
          }
        }
        onComplete(clean);
      } else {
        // Sign up
        const dbKey = toDbKey(clean);
        
        // Check if taken in RTDB first
        if (rtdb) {
          const snapshot = await withTimeout(dbGet(dbRef(rtdb, `usernames/${dbKey}`)), 3000);
          if (snapshot && snapshot.exists()) {
            setError('Username is already taken. Try another or log in.');
            setLoading(false);
            return;
          }
        }

        // Create auth user
        const cred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        
        // Reserve username
        const payload = {
          username: clean,
          ownerUid: cred.user.uid,
          createdAt: new Date().toISOString()
        };
        
        if (rtdb) {
          await dbSet(dbRef(rtdb, `usernames/${dbKey}`), payload);
          await dbSet(dbRef(rtdb, `users/${cred.user.uid}/username`), clean);
        }
        
        onComplete(clean);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('auth/invalid-credential')) {
         setError('Invalid username or password.');
      } else if (err.message?.includes('auth/email-already-in-use')) {
         setError('Username is already registered. Please switch to Returning Player.');
      } else {
         setError(err.message?.replace('Firebase: ', '') || 'Authentication failed');
      }
      setLoading(false);
    }
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
        <h1 className="display text-3xl font-extrabold text-white mt-1 mb-2">{isReturning ? 'Welcome Back' : 'Claim Your Name'}</h1>
        <p className="text-white/65 text-xs mb-6 max-w-xs">{isReturning ? 'Enter your credentials to continue.' : 'Pick a unique stargazer username and password.'}</p>
        
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-3">
          <input 
            type="text" 
            placeholder="Username (e.g. cosmic_star)" 
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3.5 text-white font-medium placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all text-center tracking-wide text-sm"
            maxLength={15}
            required
            autoFocus
          />
          <input 
            type="password" 
            placeholder={isReturning ? "Password" : "Password (min 8 chars, no capitals)"} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3.5 text-white font-medium placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all text-center tracking-wide text-sm"
            minLength={8}
            required
          />
          {error && <p className="text-pink-300 text-xs mt-1 px-2 py-1 rounded bg-pink-900/30 border border-pink-500/20">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 w-full mt-2 py-3 text-sm font-bold shadow-[0_0_20px_rgba(255,187,66,0.3)]"
          >
            {loading ? 'Processing...' : isReturning ? 'Log In' : 'Start Playing'} <ChevronRight size={18} />
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsReturning(!isReturning); setError(''); }}
          className="mt-4 text-xs text-cyan-300 hover:text-cyan-200 underline font-medium transition-colors"
        >
          {isReturning ? 'Need a new username? Create one' : 'Already claimed a username? Log in'}
        </button>
        
        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-4 text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1.5"
          >
            Or log in with Google / Email <ChevronRight size={12} />
          </button>
        )}
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
  totalStars = 0,
  completed = {},
  onUserSync
}: { 
  onClose: () => void;
  username: string;
  coins?: number;
  highestLevel?: number;
  totalStars?: number;
  completed?: Record<number, { stars: number; bestScore: number }>;
  onUserSync?: (data: { username: string; coins?: number; highestLevel?: number, completed?: Record<number, { stars: number; bestScore: number }> }) => void;
}) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [mode, setMode] = useState<'menu' | 'email-sign-in' | 'email-sign-up'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Process redirect result first
    getRedirectResult(auth).catch(err => {
      if(err.code !== 'auth/missing-initial-state') {
        setError(err.message || 'Redirect error');
      }
    });

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && rtdb) {
        try {
          const userRef = dbRef(rtdb, `users/${u.uid}`);
          const snap = await dbGet(userRef);
          
          if (snap.exists() && snap.val()?.username) {
            const userData = snap.val();
            if (onUserSync) {
              onUserSync({
                username: userData.username,
                coins: userData.coins,
                highestLevel: userData.highestLevel,
                completed: userData.completed
              });
            }
          } else if (username) {
            const payload = {
              username,
              email: u.email || '',
              photoURL: u.photoURL || '',
              coins,
              highestLevel,
              completed,
              lastSeen: new Date().toISOString()
            };
            await dbSet(userRef, payload);
            const dbKey = toDbKey(username);
            await dbSet(dbRef(rtdb, `usernames/${dbKey}/ownerUid`), u.uid);
          }
        } catch (e) {
          console.warn('Profile sync error:', e);
        }
      }
    });
  }, [username, coins, highestLevel, completed, onUserSync]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setError(err.message?.replace('Firebase: ', '') || 'Google sign-in failed');
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
      const msg = err.message || 'Authentication failed';
      if (msg.includes('auth/invalid-credential')) {
        setError('Invalid email or password. If you are new, please Sign Up.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setError('Email is already registered. Please Sign In.');
      } else {
        setError(msg.replace('Firebase: ', ''));
      }
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

export function AuthGlobalListener({ onUserSync }: { onUserSync: (data: any) => void }) {
  useEffect(() => {
    // Process redirect result
    getRedirectResult(auth).catch(err => {
      if(err.code !== 'auth/missing-initial-state') {
        console.error('Redirect error:', err);
      }
    });

    return onAuthStateChanged(auth, async (u) => {
      if (u && rtdb) {
        try {
          const userRef = dbRef(rtdb, `users/${u.uid}`);
          const snap = await dbGet(userRef);
          
          if (snap.exists() && snap.val()?.username) {
            const userData = snap.val();
            onUserSync({
              username: userData.username,
              coins: userData.coins,
              highestLevel: userData.highestLevel,
              completed: userData.completed
            });
          }
        } catch (e) {
          console.warn('Profile sync error:', e);
        }
      }
    });
  }, [onUserSync]);

  return null;
}
