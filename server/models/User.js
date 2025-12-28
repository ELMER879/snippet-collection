const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'contributor', 'admin'], 
    default: 'contributor' 
  }
});

module.exports = mongoose.model('User', UserSchema);
