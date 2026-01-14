# Faculty Leave Management System

A simple Node.js + MySQL web app for managing faculty profiles, timetables, and leave applications with basic authentication and session management. Frontend is plain HTML/CSS/JS served statically; backend is Express.

## Features
- Authentication: Signup (with bcrypt-hashed passwords) and Login using sessions.
- Profile: View username, email, department, role, salary, max and total leaves.
- Timetable: Add, list, and delete class entries per user.
- Leave Application: Apply for leave across a date range; auto-checks replacement availability based on timetable; auto-increments total leaves on approval.
- Salary Update: Update salary from profile view.

## Tech Stack
- Backend: Express, mysql2, express-session, body-parser, cors, dotenv, bcrypt
- Frontend: HTML, CSS (no framework), vanilla JS
- Database: MySQL

## File Structure
- [server.js](server.js): Express app, routes, MySQL connection, session setup
- [package.json](package.json): Dependencies
- [package-lock.json](package-lock.json): Locked dependency versions
- [login-signup.html](login-signup.html): Landing page with links to Login/Signup
- [login-page.html](login-page.html): Login form (fetches `/login`)
- [signup-page.html](signup-page.html): Signup form (posts to `/signup`)
- [profile.html](profile.html): Profile dashboard; apply leave, update salary, navigate to timetable
- [timetable.html](timetable.html): Manage timetable entries and list current timetable
- [styles/](styles): Page-specific stylesheets
- [.env](.env): Environment variables (not committed)
- [.gitignore](.gitignore): Ignores `.env`, `node_modules`, and `queries.txt`


## Environment Variables
 Current app uses these keys:
```
HOST=localhost
USER=your_mysql_username
PASSWORD=your_mysql_password
DATABASE=faculty_leave
PORT=5201
```

## Database Schema (example)
The server expects the following tables/columns based on queries in [server.js](server.js). Adjust types as needed.

```sql
-- Users
CREATE TABLE signup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  department ENUM('AIML','DS','IT','CSE','MECHANICAL') NOT NULL,
  password VARCHAR(255) NOT NULL, -- bcrypt hash
  role ENUM('faculty','admin') NOT NULL,
  salary INT DEFAULT 0,
  max_leaves INT DEFAULT 10,
  total_leaves INT DEFAULT 0
);

-- Timetable
CREATE TABLE faculty_schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  day_of_week ENUM('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject VARCHAR(255) NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES signup(id) ON DELETE CASCADE
);

-- Leave applications
CREATE TABLE leave_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  leave_type VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL
);
```

## API Endpoints
All endpoints served by [server.js](server.js). Sessions are used for auth; protected routes require a successful login.

- POST `/signup`
  - Body: `{ username, email, department, password, confirmPassword, role, salary? }`
  - Validates department/role; hashes password; creates user; redirects to `/login-page.html`.

- POST `/login`
  - Body: `{ username, password }` (username can be username or email)
  - On success: `{ email, role, department }` and sets session (`userEmail`, `userRole`, `userDepartment`).

- POST `/logout`
  - Destroys session.

- GET `/profile` (auth required)
  - Returns `{ username, email, department, role, max_leaves, total_leaves, salary }` for the logged-in user.

- GET `/timetable` (auth required)
  - Returns the logged-in user’s timetable: `[{ schedule_id, day_of_week, start_time, end_time, subject, room_number }]`.

- POST `/timetable/add` (auth required)
  - Body: `{ day_of_week, start_time, end_time, subject, room_number }`
  - Creates a timetable entry for the logged-in user.

- DELETE `/timetable/delete/:scheduleId` (auth required)
  - Deletes a timetable entry if it belongs to the logged-in user.

- POST `/update-salary` (auth required)
  - Body: `{ newSalary }`
  - Updates the logged-in user’s salary (non-negative integer).

- POST `/apply-leave` (auth required)
  - Body: `{ type, startDate, endDate, reason }`
  - Validates dates; for each day in the range, checks timetable and replacement availability; if all required replacements exist, inserts an approved leave and increments `total_leaves` by number of days.

## Frontend Pages
- [login-signup.html](login-signup.html): Entry page; links to login and signup.
- [login-page.html](login-page.html): Sends `POST /login`, stores `email` and `role` in localStorage, then redirects to profile.
- [signup-page.html](signup-page.html): Posts to `POST /signup` with client-side validation.
- [profile.html](profile.html): Loads `GET /profile`; includes modals to call `POST /apply-leave` and `POST /update-salary`; link to timetable.
- [timetable.html](timetable.html): Calls `GET /timetable`, `POST /timetable/add`, and `DELETE /timetable/delete/:scheduleId`.

## Setup & Run
Prerequisites: Node.js, MySQL.

1) Install dependencies
```bash
npm install
```

2) Configure environment
- Create `.env` (see variables above).

3) Prepare database
- Create the database and tables (see schema example) and ensure credentials match `.env`.

4) Start the server
```bash
node server.js
```
- Server runs on `http://localhost:${PORT}` (default 5201).

5) Open the app
- Open [login-signup.html](login-signup.html) in a browser, or directly navigate to [login-page.html](login-page.html) / [signup-page.html](signup-page.html).

## Notes & Recommendations
- Sessions: Current setup uses the default in-memory store; use a persistent session store (e.g., Redis) for production.
- CORS: Enabled globally via `cors()`.
- Static files: Served from the project root via `express.static(__dirname)`.
- Security: Do not commit `.env`; set a strong `SESSION_SECRET`.
- Consistent installs: Use `npm ci` in CI to honor `package-lock.json`.
