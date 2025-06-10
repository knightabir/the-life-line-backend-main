const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const requirementRequestSchema = new Schema({
  userId: { 
        type: Types.ObjectId,
        ref: 'User', 
        required: true 
    },
  bloodgroup: { 
        type: Types.ObjectId, 
        ref: 'BloodGroup', 
        required: true 
    },
  patientName: { 
        type: String, 
        required: true  
    },
  reason: { 
        type: String 
    },
  phone: { 
        type: String, 
        required: true 
    },
  unitsRequired: { 
        type: Number, 
        required: true  
    },
  requiredDate: { 
        type: Date, 
        required: true  
    },
  status: { 
        type: String,
        enum: ['Pending', 'Fulfilled', 'Cancelled'], 
        default: 'Pending' 
    },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RequirementRequest', requirementRequestSchema);