const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

// Create new project
const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    const project = new Project({
      name,
      description,
      owner: req.user._id,
      members: [req.user._id] // Explicitly add owner as member
    });

    await project.save();

    // Populate owner and members
    await project.populate('owner', 'username name avatar');
    await project.populate('members', 'username name avatar');

    console.log('Project created:', project.name);
    console.log('Project owner:', project.owner._id);
    console.log('Project members:', project.members.map(m => m._id));

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's projects
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      members: req.user._id
    })
    .populate('owner', 'username name avatar')
    .populate('members', 'username name avatar')
    .populate('tasks')
    .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single project
const getProject = async (req, res) => {
  try {
    console.log('Getting project:', req.params.id, 'for user:', req.user._id);
    
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username name avatar')
      .populate('members', 'username name avatar')
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignedTo', select: 'username name avatar' },
          { path: 'createdBy', select: 'username name avatar' }
        ]
      });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log('Project found:', project.name);
    console.log('Project members (raw):', project.members);
    console.log('Project members (IDs):', project.members.map(m => m._id || m.toString()));
    console.log('Current user:', req.user._id);
    console.log('Current user type:', typeof req.user._id);
    console.log('Current user string:', req.user._id.toString());
    console.log('Is member check:', project.isMember(req.user._id));
    
    // Additional debugging for each member
    project.members.forEach((member, index) => {
      const memberId = member._id ? member._id.toString() : member.toString();
      console.log(`Member ${index}:`, memberId, 'Type:', typeof member);
      console.log(`Member ${index} comparison:`, memberId === req.user._id.toString());
    });

    // Check if user is owner or member
    const isOwner = project.owner._id.equals(req.user._id);
    const isMember = project.isMember(req.user._id);
    
    if (!isOwner && !isMember) {
      return res.status(403).json({ 
        message: 'Access denied - You are not a member of this project',
        projectId: req.params.id,
        userId: req.user._id,
        projectOwner: project.owner._id,
        projectMembers: project.members.map(m => m._id),
        isOwner,
        isMember
      });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add member to project
const addMember = async (req, res) => {
  try {
    const { username } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isOwner(req.user._id)) {
      return res.status(403).json({ message: 'Only project owner can add members' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (project.isMember(user._id)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    await project.addMember(user._id);
    await project.populate('members', 'username name avatar');

    res.json({
      message: 'Member added successfully',
      project
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create task
const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, assignedTo } = req.body;
    const projectId = req.params.id;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isMember(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate assignedTo if provided
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ message: 'Assigned user not found' });
      }
      if (!project.isMember(assignedTo)) {
        return res.status(400).json({ message: 'Assigned user is not a project member' });
      }
    }

    const task = new Task({
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority || 'Medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedTo,
      project: projectId,
      createdBy: req.user._id
    });

    await task.save();

    // Add task to project
    project.tasks.push(task._id);
    await project.save();

    // Populate task with user data
    await task.populate('assignedTo', 'username name avatar');
    await task.populate('createdBy', 'username name avatar');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${projectId}`).emit('taskCreated', task);
    }

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedTo } = req.body;
    const { id: projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isMember(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!task.project.equals(projectId)) {
      return res.status(400).json({ message: 'Task does not belong to this project' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('assignedTo', 'username name avatar')
    .populate('createdBy', 'username name avatar');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${projectId}`).emit('taskUpdated', updatedTask);
    }

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id: projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isMember(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!task.project.equals(projectId)) {
      return res.status(400).json({ message: 'Task does not belong to this project' });
    }

    await Task.findByIdAndDelete(taskId);

    // Remove task from project
    project.tasks = project.tasks.filter(t => !t.equals(taskId));
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${projectId}`).emit('taskDeleted', { taskId, projectId });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get project analytics
const getAnalytics = async (req, res) => {
  try {
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isMember(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = await Task.find({ project: projectId });

    // Task completion rate
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'Done').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Tasks by priority
    const tasksByPriority = {
      Low: tasks.filter(task => task.priority === 'Low').length,
      Medium: tasks.filter(task => task.priority === 'Medium').length,
      High: tasks.filter(task => task.priority === 'High').length,
      Urgent: tasks.filter(task => task.priority === 'Urgent').length
    };

    // Tasks by status
    const tasksByStatus = {
      'To Do': tasks.filter(task => task.status === 'To Do').length,
      'In Progress': tasks.filter(task => task.status === 'In Progress').length,
      'Done': tasks.filter(task => task.status === 'Done').length
    };

    // Overdue tasks
    const overdueTasks = tasks.filter(task => task.isOverdue).length;

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTasks = tasks.filter(task => 
      task.createdAt >= thirtyDaysAgo
    ).length;

    res.json({
      completionRate: Math.round(completionRate * 100) / 100,
      tasksByPriority,
      tasksByStatus,
      overdueTasks,
      recentTasks,
      totalTasks
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get tasks for a project
const getTasks = async (req, res) => {
  try {
    console.log('Getting tasks for project:', req.params.id);
    console.log('User ID:', req.user._id);
    
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      console.log('Project not found:', projectId);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log('Project found:', project.name);
    console.log('Project members:', project.members);
    console.log('Is member check:', project.isMember(req.user._id));

    if (!project.isMember(req.user._id)) {
      console.log('Access denied - user not member');
      return res.status(403).json({ message: 'Access denied' });
    }

    console.log('Fetching tasks for project:', projectId);
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'username name avatar')
      .sort({ createdAt: -1 });

    console.log('Tasks found:', tasks.length);
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single task
const getTask = async (req, res) => {
  try {
    const { id: projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isMember(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const task = await Task.findById(taskId)
      .populate('assignedTo', 'username name avatar')
      .populate('createdBy', 'username name avatar');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!task.project.equals(projectId)) {
      return res.status(400).json({ message: 'Task does not belong to this project' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  addMember,
  createTask,
  updateTask,
  deleteTask,
  getTasks,
  getTask,
  getAnalytics
};
