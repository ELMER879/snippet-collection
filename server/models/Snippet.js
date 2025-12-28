const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: String,
  text: String,
  date: { type: Date, default: Date.now }
});

const SnippetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  language: { type: String, required: true }, // e.g., 'javascript', 'python'
  code: { type: String, required: true },
  description: { type: String, required: true }, // "How to use it"
  author: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  comments: [CommentSchema]
});

// Create a text index for search functionality
SnippetSchema.index({ title: 'text', description: 'text', language: 'text' });

module.exports = mongoose.model('Snippet', SnippetSchema);
