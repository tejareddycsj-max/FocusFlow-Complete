const express = require('express');
const attachUser = require('../middleware/userContext');
const { getDashboardData } = require('../controllers/dashboardController');
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { logSession, getSessionStats } = require('../controllers/sessionController');
const { getProfileAndSettings, updateProfile, updateSettings } = require('../controllers/profileController');
const { chatWithAssistant, getChatHistory } = require('../controllers/aiController');

const router = express.Router();

// Attach active student profile to all routes
router.use(attachUser);

// Dashboard & Analytics
router.get('/dashboard', getDashboardData);

// Tasks CRUD & Self-Assessment Rating
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

// Focus Timer Sessions
router.get('/sessions', getSessionStats);
router.post('/sessions', logSession);

// Student Profile & Timer Settings
router.get('/profile', getProfileAndSettings);
router.put('/profile', updateProfile);
router.put('/settings', updateSettings);

// AI Study Assistant
router.get('/ai/history', getChatHistory);
router.post('/ai/chat', chatWithAssistant);

module.exports = router;
