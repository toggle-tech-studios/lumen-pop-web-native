import re

with open('src/AuthComponents.tsx', 'r') as f:
    code = f.read()

# We will export a new component AuthListener
auth_listener = """
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
"""

# Let's just append it to the end
code += auth_listener

with open('src/AuthComponents.tsx', 'w') as f:
    f.write(code)
