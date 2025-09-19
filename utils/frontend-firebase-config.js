// Firebase configuration for frontend (client-side)
// This file should be used in your React/Vue/Next.js frontend

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// For development: connect to emulators
if (process.env.NODE_ENV === 'development' && !auth.config.emulator) {
  // Uncomment these lines if you want to use Firebase emulators in development
  // connectAuthEmulator(auth, "http://localhost:9099");
  // connectFirestoreEmulator(db, 'localhost', 8080);
}

export default app;

// Example usage in your frontend components:

/*
// Sign up with email and password
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

async function signUp(email, password, displayName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update display name
    await updateProfile(user, {
      displayName: displayName
    });
    
    // Get ID token to send to backend
    const idToken = await user.getIdToken();
    
    // Create profile in backend
    const response = await fetch('/api/firebase-auth/create-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        username: displayName,
        displayName: displayName
      })
    });
    
    const result = await response.json();
    console.log('Profile created:', result);
    
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
}

// Sign in with email and password
import { signInWithEmailAndPassword } from 'firebase/auth';

async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get ID token for backend authentication
    const idToken = await user.getIdToken();
    
    // Store token in localStorage or state management
    localStorage.setItem('firebaseToken', idToken);
    
    return user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

// Sign out
import { signOut } from 'firebase/auth';

async function signOutUser() {
  try {
    await signOut(auth);
    localStorage.removeItem('firebaseToken');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Listen to authentication state changes
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log('User signed in:', user.uid);
    // Get fresh token for API calls
    user.getIdToken().then(token => {
      localStorage.setItem('firebaseToken', token);
    });
  } else {
    // User is signed out
    console.log('User signed out');
    localStorage.removeItem('firebaseToken');
  }
});
*/