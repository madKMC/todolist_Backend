require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// Import routes
const { router: authRouter } = require('./middleware/auth'); // destructure router
const listsRouter = require('./routes/lists');
const tasksRouter = require('./routes/tasks');
const subtasksRouter = require('./routes/subtasks');
const taskCommentsRouter = require('./routes/task_comments');
const tagsRouter = require('./routes/tags');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS setup to allow cookies and frontend requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/lists', listsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/subtasks', subtasksRouter);
app.use('/api/task-comments', taskCommentsRouter);
app.use('/api/tags', tagsRouter);

// Root endpoint
app.get('/', (req, res) => res.send('To-Do List API is running'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Server Error');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
