# TaskFlow – Task Tracking & Project Management

TaskFlow is a role-based task tracking, delegation, and project management application built with React 19, TypeScript, Tailwind CSS, and Supabase.

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher, v20+ recommended)
- **npm** (bundled with Node.js) or `pnpm` / `bun`

### 2. Setup
1. Clone or download and extract this repository.
2. Open a terminal in the project directory:
   ```bash
   cd taskflow
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### 3. Environment Variables (Optional)
The application works immediately out-of-the-box with built-in persistent browser storage and pre-configured demo accounts.

To connect your own live Supabase project:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the values with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-publishable-key"
   ```

### 4. Running the App
- **Development Server:**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Type Check:**
  ```bash
  npm run lint
  ```

- **Production Build:**
  ```bash
  npm run build
  ```

- **Preview Production Build:**
  ```bash
  npm run preview
  ```

---

## Demo Accounts
The application includes pre-configured demo accounts for testing both roles:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Manager** | `manager@demo.com` | `password123` | Dashboard, Projects, Assign Task, Team Members, Reports, User Management |
| **Team Member (User)** | `user@demo.com` | `password123` | Dashboard (personal scope), Projects (assigned scope), My Tasks |

---

## Features
- **Role-Based Access Control (RBAC):** Strict view separation and client-side guards between Managers and Regular Users.
- **Task Delegation & Tracking:** Assign deliverables, deadlines, priorities, and track carry-forward reasons.
- **Project Portfolios:** Manage workspace projects and filter views across single projects or All Projects.
- **Team Allocation:** Manage project memberships and user assignments.
- **User & Role Management:** Activate/deactivate accounts, manage permission roles, and enforce task-dependency safety checks.
- **Reporting & Metrics:** Completion rates, overdue deliverables, and team workload summaries.
