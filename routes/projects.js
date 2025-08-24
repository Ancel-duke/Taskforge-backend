const express = require('express');
const auth = require('../middleware/auth');
const {
  createProject,
  getProjects,
  getProject,
  addMember,
  createTask,
  updateTask,
  deleteTask,
  getTasks,
  getAnalytics
} = require('../controllers/projectController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Project routes
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/:id/members', addMember);
router.get('/:id/analytics', getAnalytics);

// Task routes
router.get('/:id/tasks', getTasks);
router.post('/:id/tasks', createTask);
router.put('/:id/tasks/:taskId', updateTask);
router.delete('/:id/tasks/:taskId', deleteTask);

module.exports = router;
