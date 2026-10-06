# Auth App

A full-stack authentication app: users sign up, sign in, see a protected home page, upload a profile photo and log out.

- Live frontend: https://auth-app-y3ub.vercel.app
- Swagger: https://auth-app-ten-phi.vercel.app/swagger

## Stack and features

- Backend: NestJS 12, Mongoose (MongoDB), Argon2, sharp, Swagger, Jest
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Yup, Vitest
- Signup, signin and logout with a cookie-based JWT
- Protected home page (`/welcome`) and profile-image upload
- CSRF protection and shared (MongoDB-backed) rate limiting
- Swagger API documentation at `/swagger`

## Local setup

Prerequisites: Node 24.9+, npm and a reachable MongoDB database.

```bash
git clone https://github.com/mostafalzohry/auth-app.git
cd auth-app
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..
```

### Backend environment

`backend/.env` lives inside the backend folder, beside `backend/package.json`. Create it from the example only if it does not already exist; if it exists, edit it instead of overwriting it:

```bash
cp backend/.env.example backend/.env
```

Set these five keys:

```
NODE_ENV=development
PORT=3000
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_GENERATED_SECRET
AUTH_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

Generate the secret with:

```bash
openssl rand -hex 32
```

Never commit `backend/.env`.

### Frontend environment

`BACKEND_URL` defaults to `http://localhost:3000` in development, so no frontend env file is needed.

### Run

Terminal 1, from the repository root:

```bash
cd backend
npm run start:dev
```

Terminal 2, from the repository root:

```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/swagger
