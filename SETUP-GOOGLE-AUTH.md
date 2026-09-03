# Google Authentication Setup Guide

## 1. Install Dependencies

Run this command to install all required packages:

```bash
npm install next-auth@^4.24.5 @auth/prisma-adapter@^1.0.12 @prisma/client@^5.8.0 bcryptjs@^2.4.3
npm install -D prisma@^5.8.0
```

## 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - Development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`
5. Copy the Client ID and Client Secret

## 3. Set Up Environment Variables

Create a `.env.local` file in your project root (copy from `.env.example`):

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_secret_here
DATABASE_URL=your_database_connection_string
```

To generate NEXTAUTH_SECRET, run:
```bash
openssl rand -base64 32
```

## 4. Update Your Database Schema

If you already have a User model, you need to:

1. **Backup your database first!**
2. Merge the provided `prisma/schema.prisma` with your existing schema
3. Make sure your User model includes these fields:
   - `id` (String, required)
   - `email` (String, unique)
   - `password` (String, optional - for existing users)
   - `accounts` (Account relation)
   - `sessions` (Session relation)

4. Run the migration:
```bash
npx prisma migrate dev --name add-oauth-support
```

## 5. Database Migration for Existing Users

Your existing users will automatically work! Here's how:

- **Existing users** can still sign in with email/password
- When they sign in with Google (same email), their Google account gets linked automatically
- They can then use either method to sign in

## 6. Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Visit `http://localhost:3000/auth/signin`
3. Try signing in with both methods

## 7. Protect Your Routes

Example of protecting a page:

```javascript
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"

export default function ProtectedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (!session) {
    router.push("/auth/signin")
    return null
  }

  return (
    <div>
      <h1>Protected Content</h1>
      <p>Welcome {session.user.email}</p>
    </div>
  )
}
```

## 8. API Route Protection

Example of protecting an API route:

```javascript
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  // Your protected API logic here
  res.status(200).json({ data: "Protected data" })
}
```

## Files Created

- `pages/api/auth/[...nextauth].js` - NextAuth configuration with Google + Credentials
- `pages/auth/signin.js` - Sign-in page with both Google and email/password
- `pages/auth/error.js` - Error page for authentication errors
- `pages/_app.js` - SessionProvider wrapper
- `prisma/schema.prisma` - Database schema for authentication
- `.env.example` - Environment variables template

## Important Notes

- The automatic account linking happens when a user with an existing email signs in with Google
- Existing users can continue using their passwords
- No data loss occurs - all user data is preserved
- You can remove password authentication later if all users migrate to Google

## Troubleshooting

- If Google sign-in fails, check your redirect URIs match exactly
- Make sure all environment variables are set correctly
- Ensure your database is running and accessible
- Check the browser console and server logs for errors
