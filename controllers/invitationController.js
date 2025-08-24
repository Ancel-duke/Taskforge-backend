const Invitation = require('../models/Invitation');
const Project = require('../models/Project');
const User = require('../models/User');

// Send invitation
const sendInvitation = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { inviteeId, message } = req.body;

    // Check if project exists and user has permission
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isOwner(req.user._id)) {
      return res.status(403).json({ message: 'Only project owner can send invitations' });
    }

    // Check if invitee exists
    const invitee = await User.findById(inviteeId);
    if (!invitee) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member
    if (project.isMember(inviteeId)) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    // Check if invitation already exists
    const existingInvitation = await Invitation.findOne({
      project: projectId,
      invitee: inviteeId,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this user' });
    }

    // Create invitation
    const invitation = new Invitation({
      project: projectId,
      inviter: req.user._id,
      invitee: inviteeId,
      message: message || `You've been invited to join ${project.name}`
    });

    await invitation.save();

    // Populate references
    await invitation.populate('project', 'name description');
    await invitation.populate('inviter', 'username name avatar');
    await invitation.populate('invitee', 'username name avatar');

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's invitations
const getInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({
      invitee: req.user._id,
      status: 'pending'
    })
    .populate('project', 'name description')
    .populate('inviter', 'username name avatar')
    .sort({ createdAt: -1 });

    res.json(invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get project invitations (for project owners)
const getProjectInvitations = async (req, res) => {
  try {
    const { id: projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.isOwner(req.user._id)) {
      return res.status(403).json({ message: 'Only project owner can view project invitations' });
    }

    const invitations = await Invitation.find({
      project: projectId,
      status: 'pending'
    })
    .populate('inviter', 'username name avatar')
    .populate('invitee', 'username name avatar')
    .sort({ createdAt: -1 });

    res.json(invitations);
  } catch (error) {
    console.error('Get project invitations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept invitation
const acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (!invitation.invitee.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only accept invitations sent to you' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation has already been processed' });
    }

    if (invitation.isExpired()) {
      return res.status(400).json({ message: 'Invitation has expired' });
    }

    // Accept invitation
    await invitation.accept();
    console.log('Invitation accepted for user:', req.user._id);

    // Add user to project
    const project = await Project.findById(invitation.project);
    console.log('Adding user to project:', req.user._id, 'Project members before:', project.members.map(m => m.toString()));
    
    await project.addMember(req.user._id);
    
    // Refresh project data to get updated members
    await project.populate('members', 'username name avatar');
    console.log('Project members after adding:', project.members.map(m => m._id));

    // Populate references
    await invitation.populate('project', 'name description');
    await invitation.populate('inviter', 'username name avatar');

    res.json({
      message: 'Invitation accepted successfully',
      invitation
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject invitation
const rejectInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (!invitation.invitee.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only reject invitations sent to you' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation has already been processed' });
    }

    // Reject invitation
    await invitation.reject();

    res.json({
      message: 'Invitation rejected successfully',
      invitation
    });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel invitation (by inviter)
const cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (!invitation.inviter.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only cancel invitations you sent' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation has already been processed' });
    }

    await Invitation.findByIdAndDelete(invitationId);

    res.json({
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendInvitation,
  getInvitations,
  getProjectInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation
};
