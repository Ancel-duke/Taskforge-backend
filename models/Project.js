const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }]
}, {
  timestamps: true
});

// Ensure owner is always in members array
projectSchema.pre('save', function(next) {
  if (!this.members.includes(this.owner)) {
    this.members.push(this.owner);
  }
  next();
});

// Virtual for member count
projectSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for task count
projectSchema.virtual('taskCount').get(function() {
  return this.tasks.length;
});

// Method to check if user is member
projectSchema.methods.isMember = function(userId) {
  // Convert userId to string for comparison
  const userIdStr = userId.toString();
  return this.members.some(member => {
    // Handle both ObjectId and populated user object cases
    const memberId = member._id ? member._id.toString() : member.toString();
    return memberId === userIdStr;
  });
};

// Method to check if user is owner
projectSchema.methods.isOwner = function(userId) {
  return this.owner.equals(userId);
};

// Method to add member
projectSchema.methods.addMember = function(userId) {
  // Convert userId to string for comparison
  const userIdStr = userId.toString();
  const isAlreadyMember = this.members.some(member => {
    // Handle both ObjectId and populated user object cases
    const memberId = member._id ? member._id.toString() : member.toString();
    return memberId === userIdStr;
  });
  
  if (!isAlreadyMember) {
    this.members.push(userId);
  }
  return this.save();
};

// Method to remove member
projectSchema.methods.removeMember = function(userId) {
  if (!this.owner.equals(userId)) {
    const userIdStr = userId.toString();
    this.members = this.members.filter(member => {
      // Handle both ObjectId and populated user object cases
      const memberId = member._id ? member._id.toString() : member.toString();
      return memberId !== userIdStr;
    });
  }
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);
