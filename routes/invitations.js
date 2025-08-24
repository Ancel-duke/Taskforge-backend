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
router.get('/', getInvitations);
router.put('/:invitationId/accept', acceptInvitation);
router.put('/:invitationId/reject', rejectInvitation);
router.delete('/:invitationId', cancelInvitation);

module.exports = router;
