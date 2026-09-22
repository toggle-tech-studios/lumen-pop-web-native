import re

with open('src/AuthComponents.tsx', 'r') as f:
    code = f.read()

# Replace the block that doesn't call onComplete
old_block = """        if (rtdb) {
          await dbSet(dbRef(rtdb, `usernames/${dbKey}`), payload);
          await dbSet(dbRef(rtdb, `users/${cred.user.uid}/username`), clean);
        }
        
        // AuthGlobalListener will handle the sync and App.tsx will switch screen"""

new_block = """        if (rtdb) {
          await dbSet(dbRef(rtdb, `usernames/${dbKey}`), payload);
          await dbSet(dbRef(rtdb, `users/${cred.user.uid}/username`), clean);
        }
        
        onComplete(clean);"""

code = code.replace(old_block, new_block)

old_login_block = """        // Log in
        await signInWithEmailAndPassword(auth, dummyEmail, password);
        // AuthGlobalListener will handle the sync and App.tsx will switch screen"""

new_login_block = """        // Log in
        await signInWithEmailAndPassword(auth, dummyEmail, password);
        onComplete(clean);"""

code = code.replace(old_login_block, new_login_block)

with open('src/AuthComponents.tsx', 'w') as f:
    f.write(code)
