require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const cors = require('cors');

// mongodb connection 
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((err) => console.error('MongoDB Atlas connection error:', err));

const app = express();

app.use(cors({ origin: '*' }));
app.set('trust proxy', 'loopback');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.json({
    message: 'The Life Line API service',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userAuthRoutes = require('./routes/userAuthRoutes');
const userRoutes = require('./routes/userRoutes');

// Admin Routes 
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/', adminRoutes);

// User Routes 
app.use('/api/user/auth', userAuthRoutes);
app.use('/api/user/', userRoutes);


// Server 
const port = process.env.SERVER_PORT | 3000;
app.listen(port, function(){
    console.log('Server Listen on Port '+ port);
})
