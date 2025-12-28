const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Snippet = require('./models/Snippet');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to DB (Replace with your URI)
mongoose.connect('mongodb://localhost:27017/vscode-snippets', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const SECRET = 'secret_key_123'; // Move to .env in production

// --- AUTH MIDDLEWARE ---
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("Access Denied");
  try {
    const verified = jwt.verify(token, SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send("Invalid Token");
  }
};

// --- ROUTES ---

// 1. Register
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  try {
    const user = new User({ username, password: hashedPassword, role });
    await user.save();
    res.send({ message: "User created" });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// 2. Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).send("User not found");
  
  const validPass = await bcrypt.compare(password, user.password);
  if (!validPass) return res.status(400).send("Invalid password");

  const token = jwt.sign({ _id: user._id, role: user.role, username: user.username }, SECRET);
  res.header('auth-token', token).send({ token, role: user.role, username: user.username });
});

// 3. Create Snippet (Goes to Holding Area)
app.post('/api/snippets', auth, async (req, res) => {
  const snippet = new Snippet({
    ...req.body,
    author: req.user.username,
    status: 'pending' // Default to pending
  });
  try {
    await snippet.save();
    res.send(snippet);
  } catch (err) {
    res.status(400).send(err);
  }
});

// 4. Get Snippets (Search & Filter)
app.get('/api/snippets', async (req, res) => {
  const { search, status } = req.query;
  let query = {};
  
  if (status) query.status = status;
  
  // Search logic for "How to use"
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { language: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    ];
  }

  const snippets = await Snippet.find(query).sort({ _id: -1 });
  res.send(snippets);
});

// 5. Approve/Reject Snippet (Admin/Collab only)
app.put('/api/snippets/:id/status', auth, async (req, res) => {
  if (req.user.role === 'user') return res.status(403).send("Unauthorized");
  
  try {
    const snippet = await Snippet.findByIdAndUpdate(
      req.params.id, 
      { status: req.body.status }, 
      { new: true }
    );
    res.send(snippet);
  } catch (err) {
    res.status(400).send(err);
  }
});

// 6. Add Comment (Review)
app.post('/api/snippets/:id/comment', auth, async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id);
    snippet.comments.push({ user: req.user.username, text: req.body.text });
    await snippet.save();
    res.send(snippet);
  } catch (err) {
    res.status(400).send(err);
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));
