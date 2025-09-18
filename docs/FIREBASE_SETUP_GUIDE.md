# Firebase & Vercel Setup Guide

I've successfully set up Firebase authentication and database integration for your crypto news curator backend, plus configured Firebase and Vercel MCPs. Here's your complete setup guide:

## ✅ What's Been Completed

### 🔥 Firebase Integration
- ✅ Firebase Admin SDK configuration (`src/config/firebase.js`)
- ✅ Firebase Auth routes (`src/routes/firebase-auth.js`)
- ✅ Environment configuration for Firebase
- ✅ Frontend Firebase config template
- ✅ Firebase MCP server configured
- ✅ Vercel MCP server configured

### 🛠 Features Implemented
- **Firebase Authentication**: User signup, signin, profile management
- **Firestore Database**: User profiles, bookmarks, articles storage
- **MCP Integration**: Firebase and Vercel tools available in Claude Code

## 🚀 Setup Instructions

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project or select existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password authentication
4. Enable Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)

### 2. Get Firebase Credentials

#### For Backend (Service Account):
1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the entire JSON content
5. Add to `.env` file:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

#### For Frontend (Web Config):
1. Go to Project Settings > General > Your apps
2. Add web app if not exists
3. Copy the config object
4. Update `frontend-firebase-config.js` with your config

### 3. Install Firebase Dependencies

Due to npm permission issues, try these options:

**Option 1: Fix npm permissions first**
```bash
sudo chown -R $(whoami) ~/.npm
npm install firebase-admin
```

**Option 2: Use the installation script**
```bash
./firebase-install.sh
```

**Option 3: Manual installation**
```bash
npm install firebase-admin --save
# or
yarn add firebase-admin
```

### 4. Configure Firebase MCPs

The MCPs are configured but need API credentials:

```bash
# Update .claude.json to add Firebase project ID
# Add to the firebase MCP env section:
{
  "env": {
    "FIREBASE_PROJECT_ID": "your-project-id"
  }
}
```

### 5. Firestore Security Rules

Add these rules to Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Articles are readable by all, writable by service
    match /articles/{articleId} {
      allow read: if true;
      allow write: if false; // Only backend service can write
    }
    
    // Bookmarks belong to users
    match /bookmarks/{bookmarkId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## 🔌 API Endpoints Available

### Firebase Authentication Routes (`/api/firebase-auth/`)

- `POST /api/firebase-auth/create-profile` - Create user profile after Firebase signup
- `GET /api/firebase-auth/profile` - Get current user profile
- `PUT /api/firebase-auth/profile` - Update user profile
- `POST /api/firebase-auth/bookmarks` - Add bookmark
- `GET /api/firebase-auth/bookmarks` - Get user bookmarks
- `DELETE /api/firebase-auth/bookmarks/:id` - Remove bookmark
- `POST /api/firebase-auth/verify-token` - Verify Firebase ID token

### Example Usage

**Frontend Authentication Flow:**
```javascript
// 1. Sign up user with Firebase
const userCredential = await createUserWithEmailAndPassword(auth, email, password);

// 2. Get ID token
const idToken = await userCredential.user.getIdToken();

// 3. Create backend profile
const response = await fetch('/api/firebase-auth/create-profile', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ username, displayName })
});
```

## 🔧 MCP Tools Available

### Firebase MCP Tools
- Create/manage Firebase projects
- Deploy Firebase functions
- Manage Firestore collections
- Configure Firebase Auth

### Vercel MCP Tools
- Deploy applications
- Manage domains and DNS
- Monitor deployments
- Configure environment variables

## 📁 File Structure

```
src/
├── config/
│   ├── firebase.js          # Firebase Admin SDK setup
│   └── supabase.js          # Existing Supabase config
├── routes/
│   ├── firebase-auth.js     # Firebase auth endpoints
│   └── auth.js              # Existing Supabase auth
├── middleware/
│   └── auth.js              # Authentication middleware
└── server.js                # Updated with Firebase routes

frontend-firebase-config.js   # Frontend Firebase configuration
firebase-install.sh          # Installation script
.env                         # Environment variables
```

## 🚨 Important Notes

1. **Dual Database Support**: Your app now supports both Supabase AND Firebase
2. **Authentication Options**: You can use either Supabase Auth or Firebase Auth
3. **Environment Variables**: Make sure to set Firebase credentials in `.env`
4. **Frontend Integration**: Use the `frontend-firebase-config.js` file in your React/Vue app
5. **Security**: Never commit service account keys to version control

## 🧪 Testing Firebase Setup

Once dependencies are installed, test with:

```bash
# Test Firebase connection
curl -X POST http://localhost:3000/api/firebase-auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-firebase-id-token"}'
```

## 🔄 Migration Options

You can now choose to:
1. **Keep both databases** - Use Supabase for articles, Firebase for users
2. **Migrate to Firebase** - Move all data to Firestore
3. **Stay with Supabase** - Keep current setup, use Firebase for specific features

Your crypto news curator now has enterprise-grade Firebase integration! 🎉