# Faculty Leave Management System

A web application for faculty to manage leave applications, timetables, and profile information. Built with Node.js/Express and MySQL, with a vanilla HTML/CSS/JS frontend.

## Features
- **User Authentication** - Register and login with secure password hashing
- **Profile Management** - View and update profile info, salary, and leave balance
- **Timetable Management** - Add and manage class schedules
- **Leave Requests** - Apply for leave with automatic replacement faculty checking
- **Salary Updates** - Update salary from your profile

## Tech Stack
- Backend: Express, mysql2, express-session, body-parser, cors, dotenv, bcrypt
- Frontend: HTML, CSS (no framework), vanilla JS
- Database: MySQL

## File Structure
```
├── server.js              # Express backend
├── package.json           # Dependencies
├── login-signup.html      # Welcome page
├── login-page.html        # Login
├── signup-page.html       # Registration
├── profile.html           # Dashboard
├── timetable.html         # Class schedule
├── styles/                # CSS files
├── .env                   # Configuration (not in repo)
└── .gitignore
```

## Environment Variables
Create a `.env` file in the project root:
```
HOST=localhost
USER=your_mysql_user
PASSWORD=your_mysql_password
DATABASE=faculty_leave
PORT=5201
```

## Database Setup
Create these tables in MySQL:

```sql
-- Users
CREATE TABLE signup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  department ENUM('AIML','DS','IT','CSE','MECHANICAL') NOT NULL,
  password VARCHAR(255) NOT NULL,
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

**Auth**
- `POST /signup` - Register a new account
- `POST /login` - Login with username/email and password
- `POST /logout` - Logout

**Profile** (login required)
- `GET /profile` - Get user info
- `POST /update-salary` - Update salary

**Timetable** (login required)
- `GET /timetable` - View schedule
- `POST /timetable/add` - Add a class
- `DELETE /timetable/delete/:scheduleId` - Remove a class

**Leave** (login required)
- `POST /apply-leave` - Request leave (checks for replacements)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your database credentials

3. Create the database and tables (see schema above)

4. Run the server:
```bash
node server.js
```

5. Open http://localhost:5201 in your browser

## Notes
- Uses in-memory sessions (for development only)
- Keep `.env` private—don't commit it
