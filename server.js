require('dotenv').config()
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5201;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.use(session({
    secret: '###',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    }
}));

const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

db.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL database");
});

const authenticateUser = (req, res, next) => {
    if (req.session && req.session.userEmail) {
        next();
    } else {
        res.status(401).json({ message: 'Authentication required' });
    }
};

const getUserIdFromEmail = (email, callback) => {
    const sql = 'SELECT id FROM signup WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) {
            callback(err, null);
        } else if (results.length === 0) {
            callback(new Error('User not found'), null);
        } else {
            callback(null, results[0].id);
        }
    });
};

const getScheduleByUserId = (userId, callback) => {
    const sql = 'SELECT schedule_id, day_of_week, start_time, end_time, subject, room_number FROM faculty_schedule WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results);
        }
    });
};

const getAvailableReplacements = (day, startTime, endTime, callback) => {
    const sql = `
        SELECT u.username
        FROM faculty_schedule fs
        JOIN signup u ON fs.user_id = u.id
        WHERE fs.day_of_week = ?
        AND fs.start_time <= ?
        AND fs.end_time >= ?
    `;
    db.query(sql, [day, startTime, endTime], (err, results) => {
        if (err) {
            callback(err, []);
        } else {
            callback(null, results);
        }
    });
};

function getDayOfWeek(dateString) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const date = new Date(dateString);
    const dayIndex = date.getDay();
    return days[dayIndex];
}

app.post('/signup', async (req, res) => {
    const { username, email, department, password, confirmPassword, role, salary } = req.body; 

    if (password !== confirmPassword) {
        return res.status(400).send({ message: 'Passwords do not match' });
    }

    const allowedDepartments = ['AIML', 'DS', 'IT', 'CSE', 'MECHANICAL'];
    if (!allowedDepartments.includes(department)) {
        return res.status(400).send({ message: 'Invalid department selected' });
    }

     const allowedRoles = ['faculty', 'admin'];  
    if (!allowedRoles.includes(role)) {
        return res.status(400).send({ message: 'Invalid role selected' });
    }

    const checkUserSql = 'SELECT * FROM signup WHERE username = ? OR email = ?';
    db.query(checkUserSql, [username, email], (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Database error', error: err });
        }

        if (results.length > 0) {
            return res.status(409).send({ message: 'Username or email already exists' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).send({ message: 'Error hashing password', error: err });
            }

            const sql = 'INSERT INTO signup (username, email, department, password, role, salary, max_leaves, total_leaves) VALUES (?, ?, ?, ?, ?, ?, 10, 0)';  // Added role
            db.query(sql, [username, email, department, hashedPassword, role, salary], (err, result) => {  // Added role
                if (err) {
                    return res.status(500).send({ message: 'Database error', error: err });
                }
                res.redirect('/login-page.html');
            });
        });
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM signup WHERE username = ? OR email = ?';
    db.query(sql, [username, username], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send({ message: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(401).send({ message: 'Invalid username or password' });
        }

        const user = results[0];
        try {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).send({ message: 'Invalid username or password' });
            }
        } catch (error) {
            console.error("Error comparing passwords:", error);
            return res.status(500).send({ message: 'Internal server error' });
        }

        req.session.userEmail = user.email;
        req.session.userRole = user.role; 
        req.session.userDepartment = user.department;
        res.status(200).json({ email: user.email, role: user.role, department: user.department }); 
    });
});


app.get('/profile', authenticateUser, (req, res) => {
    const email = req.session.userEmail;

    const sql = 'SELECT username, email, department, role, max_leaves, total_leaves, salary FROM signup WHERE email = ?'; // Added role
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });

        res.status(200).json(results[0]);
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).json({ message: 'Error logging out' });
        } else {
            res.status(200).json({ message: 'Logout successful' });
        }
    });
});

app.get('/timetable', authenticateUser, (req, res) => {
    const email = req.session.userEmail;

    getUserIdFromEmail(email, (err, userId) => {
        if (err) {
            if (err.message === 'User not found') {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.status(500).json({ message: 'Database error', error: err });
        }

        const sql = 'SELECT schedule_id, day_of_week, start_time, end_time, subject, room_number FROM faculty_schedule WHERE user_id = ?';
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error('Error fetching timetable:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.status(200).json(results);
        });
    });
});

app.post('/timetable/add', authenticateUser, (req, res) => {
    const email = req.session.userEmail;
    const { day_of_week, start_time, end_time, subject, room_number } = req.body;

    if (!day_of_week || !start_time || !end_time || !subject || !room_number) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    getUserIdFromEmail(email, (err, userId) => {
        if (err) {
            if (err.message === 'User not found') {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.status(500).json({ message: 'Database error', error: err });
        }
        const sql = 'INSERT INTO faculty_schedule (user_id, day_of_week, start_time, end_time, subject, room_number) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [userId, day_of_week, start_time, end_time, subject, room_number], (err, result) => {
            if (err) {
                console.error('Error adding to timetable:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.status(201).json({ message: 'Class added successfully', scheduleId: result.insertId });
        });
    });
});

app.delete('/timetable/delete/:scheduleId', authenticateUser, (req, res) => {
    const email = req.session.userEmail;
    const scheduleId = req.params.scheduleId;

    getUserIdFromEmail(email, (err, userId) => {
        if (err) {
            if (err.message === 'User not found') {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.status(500).json({ message: 'Database error', error: err });
        }
        const sql = 'DELETE FROM faculty_schedule WHERE schedule_id = ? AND user_id = ?';
        db.query(sql, [scheduleId, userId], (err, result) => {
            if (err) {
                console.error('Error deleting from timetable:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Class not found or does not belong to the user' });
            }
            res.status(200).json({ message: 'Class deleted successfully' });
        });
    });
});

app.post('/update-salary', authenticateUser, (req, res) => {
    const email = req.session.userEmail;
    const { newSalary } = req.body;

    if (typeof newSalary === 'undefined') {
        return res.status(400).json({ message: 'New salary is required' });
    }

    const parsedSalary = parseInt(newSalary);

    if (isNaN(parsedSalary) || parsedSalary < 0) {
        return res.status(400).json({ message: 'Invalid salary value' });
    }

    const sql = 'UPDATE signup SET salary = ? WHERE email = ?';
    db.query(sql, [parsedSalary, email], (err, result) => {
        if (err) {
            console.error("Error updating salary:", err);
            return res.status(500).json({ message: 'Database error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'Salary updated successfully' });
    });
});

app.post('/apply-leave', authenticateUser, async (req, res) => {
    const email = req.session.userEmail;
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const leaveStartDate = new Date(startDate);
    const leaveEndDate = new Date(endDate);

    if (leaveEndDate < leaveStartDate) {
        return res.status(400).json({ message: 'End date cannot be earlier than start date' });
    }

    getUserIdFromEmail(email, async (err, userId) => {
        if (err) {
            if (err.message === 'User not found') {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.status(500).json({ message: 'Database error', error: err });
        }

        getScheduleByUserId(userId, async (scheduleErr, userSchedule) => {
            if (scheduleErr) {
                return res.status(500).json({ message: 'Error fetching user schedule', error: scheduleErr });
            }

            let leaveDays = [];
            let currentDate = leaveStartDate;
            while (currentDate <= leaveEndDate) {
                leaveDays.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }

            let allReplacementsAvailable = true;
            const replacementDetails = [];

            for (const leaveDay of leaveDays) {
                const dayOfWeek = getDayOfWeek(leaveDay.toISOString().split('T')[0]);
                const leaveDaySchedule = userSchedule.filter(schedule => schedule.day_of_week === dayOfWeek);

                if (leaveDaySchedule.length === 0) {
                    replacementDetails.push({ date: leaveDay, day: dayOfWeek, required: false, availableReplacements: [] });
                    continue;
                }

                let dayReplacementsAvailable = true;
                const dayAvailableReplacements = [];
                for (const schedule of leaveDaySchedule) {
                    const availableReplacements = await new Promise(async (resolve, reject) => {
                        getAvailableReplacements(dayOfWeek, schedule.start_time, schedule.end_time, (err, replacements) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(replacements);
                            }
                        });
                    });
                    if (availableReplacements.length === 0) {
                        dayReplacementsAvailable = false;

                    }
                    dayAvailableReplacements.push({
                        startTime: schedule.start_time,
                        endTime: schedule.end_time,
                        replacements: availableReplacements
                    });
                }
                if (!dayReplacementsAvailable) {
                    allReplacementsAvailable = false;
                }
                replacementDetails.push({ date: leaveDay, day: dayOfWeek, required: true, availableReplacements: dayAvailableReplacements });
            }

            if (!allReplacementsAvailable) {
                return res.status(400).json({ message: 'Leave cannot be approved. No replacement faculty available for all days.', replacementDetails });
            }
            const sql = 'INSERT INTO leave_applications (email, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(sql, [email, type, startDate, endDate, reason, 'Approved'], (err, result) => {
                if (err) {
                    console.error('Error applying for leave:', err);
                    return res.status(500).json({ message: 'Database error', error: err });
                }

                const days = leaveDays.length;
                const updateLeavesSql = 'UPDATE signup SET total_leaves = total_leaves + ? WHERE id = ?';
                db.query(updateLeavesSql, [days, userId], (updateErr) => {
                    if (updateErr) {
                        console.error("Error updating total_leaves:", updateErr);
                        return res.status(500).json({ message: "Database error" });
                    }
                    res.status(201).json({ message: 'Leave application submitted and approved.', applicationId: result.insertId, replacementDetails });
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
});