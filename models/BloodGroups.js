const mongoose = require('mongoose');

const bloodGroupSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  }
});

module.exports = mongoose.model('BloodGroup', bloodGroupSchema);
