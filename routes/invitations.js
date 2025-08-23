const express = require('express');
const auth = require('../middleware/auth');
const {
  sendInvitation,
  getInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation
} = require('../controllers/invitationController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Invitation routes
router.post('/projects/:projectId/invitations', sendInvitation);
router.get('/invitations', getInvitations);
router.put('/invitations/:invitationId/accept', acceptInvitation);
router.put('/invitations/:invitationId/reject', rejectInvitation);
router.delete('/invitations/:invitationId', cancelInvitation);

module.exports = router;
