const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const donationRequestSchema = new Schema({
  userId: { 
    type: Types.ObjectId,
    ref: 'User', 
    required: true 
  },
  bloodgroup: { 
    type: Types.ObjectId, 
    ref: 'BloodGroup', 
    required: false,
    default: null 
  },
  phone: { 
    type: String, 
    required: true 
  },
  donationDate: { 
    type: Date, 
    required: false  
  },
  status: { 
    type: String,
    enum: ['Pending', 'Completed', 'Cancelled'], 
    default: 'Pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Validate before saving a new or modified document
donationRequestSchema.pre('save', function (next) {
  if (this.status === 'Completed' && !this.donationDate) {
    return next(new Error('Donation date is required when status is Completed.'));
  }
  next();
});

// Validate when using findOneAndUpdate (e.g., findByIdAndUpdate)
donationRequestSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();

  // Handle nested update objects (e.g., $set)
  const newStatus = update.status || (update.$set && update.$set.status);
  const newDate = update.donationDate || (update.$set && update.$set.donationDate);

  if (newStatus === 'Fulfilled' && !newDate) {
    return next(new Error('Donation date is required when status is Fulfilled.'));
  }

  next();
});

const DonationRequest = mongoose.model('DonationRequest', donationRequestSchema);

module.exports = DonationRequest;
