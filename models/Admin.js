const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    name: {
        type:String,
        required:true
    },
    avatar:{
        type: String,
        default:"adminAvatar.png"
    },
    email:{
        type:String,
        required:true
    },
    phone:{
        type: String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
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
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


module.exports = mongoose.model('Admin', adminSchema);