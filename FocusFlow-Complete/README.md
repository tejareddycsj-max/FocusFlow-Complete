# FocusFlow — Intelligent Study Planning and Productivity System

FocusFlow is a web-based student productivity application designed to help students organize academic tasks, manage study sessions, monitor productivity, and receive AI-powered study guidance.

## Features

- **Dashboard:** View study progress and productivity information.
- **Task Management:** Create, update, delete, and organize academic tasks.
- **Study Planner:** Organize study activities and priorities.
- **Pomodoro Timer:** Manage focused study sessions and breaks.
- **Productivity Analytics:** Track study activity and progress.
- **Achievements:** Earn XP and track productivity milestones.
- **User Authentication:** Register and log in securely using JWT authentication.
- **AI Study Assistant:** Get study recommendations and subject explanations using Google Gemini.

## Technology Stack

### Frontend
- HTML
- CSS
- JavaScript
- Chart.js

### Backend
- Node.js
- Express.js
- Prisma ORM

### Database
- Neon PostgreSQL

### Authentication
- JSON Web Tokens (JWT)
- bcryptjs

### Artificial Intelligence
- Google Gemini API

## Project Structure

```text
FocusFlow-Complete/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes/
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── script.js
│   └── style.css
│
├── .gitignore
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Set up the backend

Open the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the backend directory and configure:

```env
DATABASE_URL="your_neon_database_connection_string"
JWT_SECRET="your_secure_jwt_secret"
GEMINI_API_KEY="your_gemini_api_key"
```

The Gemini API key is needed for AI-generated responses.

Apply the existing database migrations:

```bash
npx prisma migrate dev
```

Start the backend:

```bash
npm run dev
```

### 3. Run the frontend

Open the `frontend` folder in VS Code and launch `index.html` using the Live Server extension.

Keep the backend running in a separate terminal.

## Database

FocusFlow uses Neon PostgreSQL for cloud database storage and Prisma ORM for database operations.

It stores user accounts, tasks, study sessions, chat history, and associated productivity information.

## AI Integration

The AI Study Assistant integrates Google's Gemini API to provide contextual study guidance.

It can use student task information and chat history to generate relevant study suggestions and explanations.

A fallback recommendation system is also available when Gemini cannot generate a response.

## Authentication and Security

- User registration and login
- Password hashing with bcryptjs
- JWT-based authentication
- Protected backend API routes
- User-specific database access
- Environment variables for sensitive credentials

Never commit `.env` files or expose API keys and authentication secrets.

## Project Objective

The main objective