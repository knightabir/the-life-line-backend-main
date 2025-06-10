const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const messageSchema = new Schema({
   userId: { 
    type: Types.ObjectId,
    ref: 'User', 
    required: true 
  },
  message: {
    type: String,
    required: true
  },
  status: { 
    type: String,
    enum: ['Unread', 'Readed'], 
    default: 'Unread' 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);