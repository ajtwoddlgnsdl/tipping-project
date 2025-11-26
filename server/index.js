const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/wishlist', wishlistRoutes);

app.get('/', (req, res) => {
  res.send('🚀 Tipping Server (Latest) is Running!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});