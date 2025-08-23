const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  inviter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
invitationSchema.index({ project: 1, invitee: 1, status: 1 });
invitationSchema.index({ invitee: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if invitation is expired
invitationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to accept invitation
invitationSchema.methods.accept = function() {
  this.status = 'accepted';
  return this.save();
};

// Method to reject invitation
invitationSchema.methods.reject = function() {
  this.status = 'rejected';
  return this.save();
};

module.exports = mongoose.model('Invitation', invitationSchema);
