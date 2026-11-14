# FocusFlow Backend

Express + Prisma + PostgreSQL backend for the FocusFlow frontend. The AI Study Assistant uses the Gemini API when a key is configured and otherwise returns a study-record-based fallback recommendation.

## Requirements

- Node.js 18.18 or newer
- PostgreSQL installed and running
- A Gemini API key (optional; needed for generated AI answers)

## Setup (PowerShell / VS Code terminal)

1. Open this `backend` folder in VS Code.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and update `DATABASE_URL` with your PostgreSQL username/password. Add your Gemini key if you want AI-generated answers. **Do not share your `.env` file or commit it to Git.**
4. Create a PostgreSQL database named `focusflow_db` (or change the database name in `DATABASE_URL`).
5. Create the database tables and seed the sample student/tasks:

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

6. Start the API:

   ```bash
   npm run dev
   ```

7. Test these URLs:
   - `http://localhost:5000/health`
   - `http://localhost:5000/api/dashboard`
   - `http://localhost:5000/api/ai/history`

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | API health check |
| GET | `/api/dashboard` | Dashboard metrics and topic analytics |
| GET, POST | `/api/tasks` | List and create tasks |
| PATCH, DELETE | `/api/tasks/:id` | Update or delete a task |
| GET, POST | `/api/sessions` | Focus session statistics and logging |
| GET, PUT | `/api/profile` | Read and update student profile |
| PUT | `/api/settings` | Update Pomodoro settings |
| GET | `/api/ai/history` | Read AI chat history |
| POST | `/api/ai/chat` | Send a message to FocusFlow AI |

## Frontend connection

The frontend's `script.js` points to `http://localhost:5000/api`. The AI chat uses `/ai/history` and `/ai/chat`. The current frontend keeps tasks, profile, timer sessions, and dashboard display data in browser `localStorage`; those parts are not yet synchronized with PostgreSQL.

## Important development note

This starter backend attaches one default demo student (`vardhan@university.edu`) to requests and does not implement login/authentication. It is suitable for a local college-project demo, not for public production deployment. Add authentication, per-user authorization, input validation, and a restricted CORS origin before deploying it publicly.
