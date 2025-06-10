const mongoose = require('mongoose');
const { Schema, Types } = mongoose;
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type:String,
        required:true
    },
    avatar:{
        type: String,
        default:"userAvatar.png"
    },
    email:{
        type:String,
        unique: true,
        required:true
    },
    employeeId:{
        type:String,
        required:false,
        default: null
    },
    donationPoints: {
        type: Number,
        default: 0
    },
    designation: {
        type: String,
        default: "Others"
    }, 
    shopNo: {
        type: String,
        required:false,
        default: null
    }, 
    phone:{
        type:Number,
        unique: true,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    bloodgroup: { type: Types.ObjectId, ref: 'BloodGroup', default:null },

    refreshedToken:{
        type:String
    },
    resetPasswordToken:{
        type:String
    },
    resetPasswordExpires: {
        type:Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


module.exports = mongoose.model('User', userSchema);