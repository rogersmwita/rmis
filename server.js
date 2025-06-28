const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

// === Config ===
const EMAIL_USER = 'rogersmwita@gmail.com';
const EMAIL_PASS = 'utuf mwuv wuxs ugvv';
const MONGODB_URI = 'mongodb+srv://rmis:1234567890@cluster0.yk3cexd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

cloudinary.config({
  cloud_name: 'duibblawh',
  api_key: '752783997762885',
  api_secret: 'M2r7u1lHCpILtZ24ClZXn5i_Umo'
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Road Damage Report API',
      version: '1.0.0',
      description: 'API documentation for Road Damage Report System',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// === Middleware ===
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// === Socket.IO Trackers ===
let onlineUsers = {};
io.on('connection', socket => {
  socket.on('registerEmail', email => {
    onlineUsers[email] = socket.id;
  });
  socket.on('disconnect', () => {
    for (let email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
        break;
      }
    }
  });
});

// === Email Setup ===
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// === Schemas ===
const User = mongoose.model('User', new mongoose.Schema({
  userId: String,
  fullname: String,
  email: String,
  role: String,
  passwordHash: String
}));

const PendingUser = mongoose.model('PendingUser', new mongoose.Schema({
  fullname: String,
  email: String,
  role: String,
  status: { type: String, default: 'pending' },
  // Contractor-specific fields
  companyName: String,
  tin: String,
  registerDate: Date,
  registerId: String
}));

const Role = mongoose.model('Role', new mongoose.Schema({
  name: String
}));

const Road = mongoose.model('Road', new mongoose.Schema({
  roadName: String,
  assignedSurveyor: String, // surveyor email
  assignedByOfficer: String, // officer email
  status: { type: String, default: 'assigned' }, // assigned, approved, in_progress, completed
  assignedDate: { type: Date, default: Date.now },
  approvedDate: Date,
  description: String,
  location: Object,
  estimatedBudget: Number
}));

const Contractor = mongoose.model('Contractor', new mongoose.Schema({
  company_name: String,
  tin: String,
  company_register_date: Date,
  active: { type: Boolean, default: true },
  first_register_date: { type: Date, default: Date.now },
  last_register_date: { type: Date, default: Date.now },
  register_id: String,
  email: String
}));

const DamageClass = mongoose.model('DamageClass', new mongoose.Schema({
  damageClass: String,
  description: String,
  repairCost: Number,
  userId: String,
  registerDate: { type: Date, default: Date.now }
}));

const Photo = mongoose.model('Photo', new mongoose.Schema({
  userId: String,
  fullname: String,
  email: String,
  roadName: String,
  damageClass: String,
  comment: String,
  localTime: String,
  photoUrl: String,
  imageId: String,
  location: Object,
  approvalStatus: { type: String, default: 'pending' },
  officerComment: String,
  contractor: String,
  validatedByOfficerId: String,
  validationDate: Date,
  budget: Number,
  dateCreated: { type: Date, default: Date.now },
  surveyStartDate: Date,
  surveyEndDate: Date,
  surveyStatus: { type: String, default: 'pending_approval' },
  repairDate: Date,
  stage: { type: String, default: 'assigned' },
  roadBudget: Number,
  originalRoadName: String,
  originalDamageClass: String,
  editReason: String,
  editedBy: String,
  editDate: Date
}));

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 */
app.get('/roles', async (_, res) => {
  const roles = await Role.find();
  res.json(roles);
});

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role created successfully
 */
app.post('/roles', async (req, res) => {
  await new Role({ name: req.body.name }).save();
  res.json({ message: 'Role added' });
});

/**
 * @swagger
 * /check-email:
 *   get:
 *     summary: Check if email exists
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Email existence status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 */
app.get('/check-email', async (req, res) => {
  const exists = await User.findOne({ email: req.query.email }) || await PendingUser.findOne({ email: req.query.email });
  res.json({ exists: !!exists });
});

/**
 * @swagger
 * /request-registration:
 *   post:
 *     summary: Request user registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               companyName:
 *                 type: string
 *               tin:
 *                 type: string
 *               registerDate:
 *                 type: string
 *                 format: date
 *               registerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration request submitted
 */
app.post('/request-registration', async (req, res) => {
  const { fullname, email, role, companyName, tin, registerDate, registerId } = req.body;
  
  const pendingUserData = { fullname, email, role };
  
  // Add contractor fields if contractor role is selected
  if (role === 'Contractor') {
    pendingUserData.companyName = companyName;
    pendingUserData.tin = tin;
    pendingUserData.registerDate = registerDate ? new Date(registerDate) : null;
    pendingUserData.registerId = registerId;
  }
  
  await new PendingUser(pendingUserData).save();
  res.json({ message: 'Registration request submitted.' });
});

/**
 * @swagger
 * /pending-users:
 *   get:
 *     summary: Get all pending users
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of pending users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fullname:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 */
app.get('/pending-users', async (_, res) => {
  const pending = await PendingUser.find({ status: 'pending' });
  res.json(pending);
});

/**
 * @swagger
 * /approve-user/{id}:
 *   patch:
 *     summary: Approve a pending user
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User approved successfully
 *       404:
 *         description: User not found
 */
app.patch('/approve-user/:id', async (req, res) => {
  const pending = await PendingUser.findById(req.params.id);
  if (!pending) return res.status(404).json({ message: 'User not found' });

  const password = '123456';
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = 'U' + Date.now();

  const user = new User({
    userId,
    fullname: pending.fullname,
    email: pending.email,
    role: pending.role,
    passwordHash
  });
  await user.save();

  // If contractor, also create contractor record
  if (pending.role === 'Contractor' && pending.companyName) {
    const contractor = new Contractor({
      company_name: pending.companyName,
      tin: pending.tin,
      company_register_date: pending.registerDate,
      email: pending.email,
      register_id: pending.registerId
    });
    await contractor.save();
  }

  await transporter.sendMail({
    from: EMAIL_USER,
    to: pending.email,
    subject: '🎉 Approved',
    html: `<p>Hello <strong>${pending.fullname}</strong>,<br>Your account as <b>${pending.role}</b> has been approved.<br>Your default password is <b>${password}</b>.</p>`
  });

  if (onlineUsers[pending.email]) {
    io.to(onlineUsers[pending.email]).emit('registrationStatus', {
      status: 'approved',
      message: '✅ Your account has been approved. You can now login.'
    });
  }

  await PendingUser.findByIdAndDelete(req.params.id);
  res.json({ message: 'User approved and removed from pending.' });
});

/**
 * @swagger
 * /reject-user/{id}:
 *   patch:
 *     summary: Reject a pending user
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User rejected successfully
 *       404:
 *         description: User not found
 */
app.patch('/reject-user/:id', async (req, res) => {
  const pending = await PendingUser.findById(req.params.id);
  if (!pending) return res.status(404).json({ message: 'User not found' });

  if (onlineUsers[pending.email]) {
    io.to(onlineUsers[pending.email]).emit('registrationStatus', {
      status: 'rejected',
      message: '❌ Your registration was rejected. Please contact admin.'
    });
  }

  await PendingUser.findByIdAndDelete(req.params.id);
  res.json({ message: 'User rejected and removed.' });
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       404:
 *         description: Email not found
 *       400:
 *         description: Invalid password
 */
app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ message: 'Email not found' });

  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) return res.status(400).json({ message: 'Invalid password' });

  res.json({
    userId: user.userId,
    fullname: user.fullname,
    email: user.email,
    role: user.role
  });
});

/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: New password sent to email
 *       404:
 *         description: Email not found
 */
app.post('/forgot-password', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ message: 'Email not found' });

  const newPass = Math.random().toString(36).slice(-6);
  user.passwordHash = await bcrypt.hash(newPass, 10);
  await user.save();

  await transporter.sendMail({
    from: EMAIL_USER,
    to: user.email,
    subject: '🔐 New Password',
    html: `<p>Your new password is <b>${newPass}</b></p>`
  });

  res.json({ message: 'New password sent to email.' });
});

/**
 * @swagger
 * /upload-photo:
 *   post:
 *     summary: Upload a road damage photo
 *     tags: [Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageData:
 *                 type: string
 *               userId:
 *                 type: string
 *               fullname:
 *                 type: string
 *               email:
 *                 type: string
 *               roadName:
 *                 type: string
 *               damageClass:
 *                 type: string
 *               comment:
 *                 type: string
 *               localTime:
 *                 type: string
 *               location:
 *                 type: object
 *               surveyStartDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *       403:
 *         description: Road not approved for survey
 *       404:
 *         description: Road not assigned to surveyor
 */
app.post('/upload-photo', async (req, res) => {
  const { imageData, ...rest } = req.body;
  
  // Check if road is assigned to this surveyor and approved
  const road = await Road.findOne({ 
    roadName: rest.roadName, 
    assignedSurveyor: rest.email 
  });
  
  if (!road) {
    return res.status(404).json({ message: 'Road not assigned to you' });
  }
  
  if (road.status !== 'approved') {
    return res.status(403).json({ message: 'Road not approved for survey yet' });
  }
  
  const upload = await cloudinary.uploader.upload(imageData, { folder: 'road_damage' });
  
  // Calculate road budget based on damage class
  const damageClassInfo = await DamageClass.findOne({ damageClass: rest.damageClass });
  const roadBudget = damageClassInfo ? damageClassInfo.repairCost : 0;
  
  // Ensure location data is in the correct format
  let locationData = rest.location;
  if (locationData && typeof locationData === 'object') {
    // Convert old format to new format if needed
    if (locationData.lat && locationData.lng) {
      locationData = {
        street: locationData.street || rest.roadName,
        city: locationData.city || 'Dar es-Salaam',
        region: locationData.region || '',
        country: locationData.country || 'Tanzania',
        latitude: locationData.lat,
        longitude: locationData.lng
      };
    }
  }
  
  const photo = new Photo({ 
    ...rest, 
    location: locationData,
    photoUrl: upload.secure_url, 
    imageId: upload.public_id,
    roadBudget,
    surveyStartDate: rest.surveyStartDate ? new Date(rest.surveyStartDate) : new Date(),
    surveyStatus: 'in_progress'
  });
  await photo.save();
  
  // Update road status to in_progress if this is the first photo
  const photoCount = await Photo.countDocuments({ roadName: rest.roadName });
  if (photoCount === 1) {
    road.status = 'in_progress';
    await road.save();
  }
  
  res.json({ message: 'Photo uploaded' });
});

/**
 * @swagger
 * /edit-photo/{id}:
 *   patch:
 *     summary: Edit photo details based on manager feedback (Surveyor only)
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roadName:
 *                 type: string
 *               damageClass:
 *                 type: string
 *               comment:
 *                 type: string
 *               editReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Photo updated successfully
 *       404:
 *         description: Photo not found
 */
app.patch('/edit-photo/:id', async (req, res) => {
  const { roadName, damageClass, comment, editReason } = req.body;
  const photo = await Photo.findById(req.params.id);
  
  if (!photo) {
    return res.status(404).json({ message: 'Photo not found' });
  }
  
  // Store original values if not already stored
  if (!photo.originalRoadName) {
    photo.originalRoadName = photo.roadName;
    photo.originalDamageClass = photo.damageClass;
  }
  
  // Update photo details
  if (roadName) photo.roadName = roadName;
  if (damageClass) {
    photo.damageClass = damageClass;
    // Recalculate budget based on new damage class
    const damageClassInfo = await DamageClass.findOne({ damageClass });
    if (damageClassInfo) {
      photo.roadBudget = damageClassInfo.repairCost;
    }
  }
  if (comment) photo.comment = comment;
  
  photo.editReason = editReason;
  photo.editedBy = req.body.email; // This should come from authenticated user
  photo.editDate = new Date();
  photo.approvalStatus = 'pending'; // Reset approval status
  
  await photo.save();
  
  res.json({ message: 'Photo updated successfully' });
});

/**
 * @swagger
 * /rejected-photos/{email}:
 *   get:
 *     summary: Get rejected photos for a surveyor to edit
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of rejected photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 */
app.get('/rejected-photos/:email', async (req, res) => {
  const photos = await Photo.find({ 
    email: req.params.email,
    approvalStatus: 'rejected'
  }).sort({ dateCreated: -1 });
  
  res.json({ photos });
});

/**
 * @swagger
 * /get-all-photos:
 *   get:
 *     summary: Get all photos
 *     tags: [Photos]
 *     responses:
 *       200:
 *         description: List of all photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 */
app.get('/get-all-photos', async (_, res) => {
  const photos = await Photo.find().sort({ dateCreated: -1 });
  res.json({ photos });
});

/**
 * @swagger
 * /delete-photo/{id}:
 *   delete:
 *     summary: Delete a photo
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 */
app.delete('/delete-photo/:id', async (req, res) => {
  const photo = await Photo.findById(req.params.id);
  if (photo) await cloudinary.uploader.destroy(photo.imageId);
  await Photo.findByIdAndDelete(req.params.id);
  res.json({ message: 'Photo deleted' });
});

/**
 * @swagger
 * /officer-review/{id}:
 *   patch:
 *     summary: Update officer review
 *     tags: [Officer]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalStatus:
 *                 type: string
 *               officerComment:
 *                 type: string
 *               validatedByOfficerId:
 *                 type: string
 *               roadName:
 *                 type: string
 *               damageClass:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 */
app.patch('/officer-review/:id', async (req, res) => {
  const { approvalStatus, officerComment, validatedByOfficerId, roadName, damageClass } = req.body;
  
  let updateData = {
    approvalStatus,
    officerComment,
    validatedByOfficerId,
    validationDate: new Date()
  };
  
  // If rejected, allow updating road name and damage class
  if (approvalStatus === 'rejected' && (roadName || damageClass)) {
    if (roadName) updateData.roadName = roadName;
    if (damageClass) {
      updateData.damageClass = damageClass;
      // Recalculate budget based on new damage class
      const damageClassInfo = await DamageClass.findOne({ damageClass });
      if (damageClassInfo) {
        updateData.roadBudget = damageClassInfo.repairCost;
      }
    }
  }
  
  await Photo.findByIdAndUpdate(req.params.id, updateData);
  res.json({ message: 'Review updated' });
});

/**
 * @swagger
 * /damage-class:
 *   post:
 *     summary: Create a new damage class
 *     tags: [Damage Classes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               damageClass:
 *                 type: string
 *               description:
 *                 type: string
 *               repairCost:
 *                 type: number
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Damage class created successfully
 */
app.post('/damage-class', async (req, res) => {
  const { damageClass, description, repairCost, userId } = req.body;
  await new DamageClass({ damageClass, description, repairCost, userId }).save();
  res.json({ message: 'Damage class saved' });
});

/**
 * @swagger
 * /damage-class:
 *   get:
 *     summary: Get all damage classes
 *     tags: [Damage Classes]
 *     responses:
 *       200:
 *         description: List of damage classes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/damage-class', async (_, res) => {
  const list = await DamageClass.find().sort({ registerDate: -1 });
  res.json(list);
});

/**
 * @swagger
 * /all-users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/all-users', async (_, res) => {
  const users = await User.find().sort({ fullname: 1 });
  res.json(users);
});

/**
 * @swagger
 * /delete-user/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
app.delete('/delete-user/:id', async (req, res) => {
    const userId = req.params.id;
  const user = await User.findById(userId);
  const pending = await PendingUser.findById(userId);

  if (user) {
    const photos = await Photo.find({ userId: user.userId });
    for (let p of photos) {
      if (p.imageId) await cloudinary.uploader.destroy(p.imageId);
    }
    await Photo.deleteMany({ userId: user.userId });
    await User.findByIdAndDelete(userId);
    return res.json({ message: 'Approved user and photos deleted.' });
  }

  if (pending) {
    await PendingUser.findByIdAndDelete(userId);
    return res.json({ message: 'Pending user deleted.' });
  }

  res.status(404).json({ message: 'User not found.' });
});

/**
 * @swagger
 * /contractors:
 *   get:
 *     summary: Get all contractors
 *     tags: [Contractors]
 *     responses:
 *       200:
 *         description: List of contractors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   company_name:
 *                     type: string
 *                   tin:
 *                     type: string
 *                   email:
 *                     type: string
 *                   active:
 *                     type: boolean
 */
app.get('/contractors', async (_, res) => {
  const contractors = await Contractor.find().sort({ company_name: 1 });
  res.json(contractors);
});

/**
 * @swagger
 * /contractors:
 *   post:
 *     summary: Create a new contractor
 *     tags: [Contractors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name:
 *                 type: string
 *               tin:
 *                 type: string
 *               company_register_date:
 *                 type: string
 *                 format: date
 *               email:
 *                 type: string
 *               register_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contractor created successfully
 */
app.post('/contractors', async (req, res) => {
  const { company_name, tin, company_register_date, email, register_id } = req.body;
  const contractor = new Contractor({
    company_name,
    tin,
    company_register_date: new Date(company_register_date),
    email,
    register_id
  });
  await contractor.save();
  res.json({ message: 'Contractor added successfully' });
});

/**
 * @swagger
 * /contractors/{id}:
 *   patch:
 *     summary: Update contractor status
 *     tags: [Contractors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contractor updated successfully
 */
app.patch('/contractors/:id', async (req, res) => {
  const { active } = req.body;
  await Contractor.findByIdAndUpdate(req.params.id, { 
    active,
    last_register_date: new Date()
  });
  res.json({ message: 'Contractor updated successfully' });
});

/**
 * @swagger
 * /contractors/{id}:
 *   delete:
 *     summary: Delete a contractor
 *     tags: [Contractors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contractor deleted successfully
 */
app.delete('/contractors/:id', async (req, res) => {
  await Contractor.findByIdAndDelete(req.params.id);
  res.json({ message: 'Contractor deleted successfully' });
});

/**
 * @swagger
 * /roads:
 *   get:
 *     summary: Get all roads
 *     tags: [Roads]
 *     responses:
 *       200:
 *         description: List of roads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/roads', async (_, res) => {
  const roads = await Road.find().sort({ assignedDate: -1 });
  res.json(roads);
});

/**
 * @swagger
 * /roads:
 *   post:
 *     summary: Assign a road to a surveyor (Officer only)
 *     tags: [Roads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roadName:
 *                 type: string
 *               assignedSurveyor:
 *                 type: string
 *               assignedByOfficer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Road assigned successfully
 */
app.post('/roads', async (req, res) => {
  const { roadName, assignedSurveyor, assignedByOfficer } = req.body;
  
  // Check if surveyor exists
  const surveyor = await User.findOne({ email: assignedSurveyor, role: 'Surveyor' });
  if (!surveyor) {
    return res.status(404).json({ message: 'Surveyor not found' });
  }
  
  const road = new Road({
    roadName,
    assignedSurveyor,
    assignedByOfficer
  });
  await road.save();
  
  // Send email notification to surveyor
  await transporter.sendMail({
    from: EMAIL_USER,
    to: assignedSurveyor,
    subject: '🛣️ New Road Assignment',
    html: `<p>Hello <strong>${surveyor.fullname}</strong>,<br>You have been assigned to survey <b>${roadName}</b>.<br>Please wait for approval to start the survey.</p>`
  });
  
  res.json({ message: 'Road assigned successfully' });
});

/**
 * @swagger
 * /roads/{id}/approve:
 *   patch:
 *     summary: Approve survey start for a road (Officer only)
 *     tags: [Roads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Survey approved successfully
 */
app.patch('/roads/:id/approve', async (req, res) => {
  const road = await Road.findById(req.params.id);
  if (!road) {
    return res.status(404).json({ message: 'Road not found' });
  }
  
  road.status = 'approved';
  road.approvedDate = new Date();
  await road.save();
  
  // Send email notification to surveyor
  await transporter.sendMail({
    from: EMAIL_USER,
    to: road.assignedSurveyor,
    subject: '✅ Survey Approved',
    html: `<p>Your survey for <b>${road.roadName}</b> has been approved.<br>You can now start the survey.</p>`
  });
  
  res.json({ message: 'Survey approved successfully' });
});

/**
 * @swagger
 * /roads/surveyor/{email}:
 *   get:
 *     summary: Get roads assigned to a specific surveyor
 *     tags: [Roads]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned roads
 */
app.get('/roads/surveyor/:email', async (req, res) => {
  const roads = await Road.find({ assignedSurveyor: req.params.email }).sort({ assignedDate: -1 });
  res.json(roads);
});

/**
 * @swagger
 * /roads/{id}:
 *   delete:
 *     summary: Delete a road assignment
 *     tags: [Roads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Road deleted successfully
 */
app.delete('/roads/:id', async (req, res) => {
  await Road.findByIdAndDelete(req.params.id);
  res.json({ message: 'Road deleted successfully' });
});

/**
 * @swagger
 * /complete-survey/{roadName}:
 *   patch:
 *     summary: Mark survey as completed for a specific road
 *     tags: [Survey]
 *     parameters:
 *       - in: path
 *         name: roadName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               surveyEndDate:
 *                 type: string
 *                 format: date
 *               surveyorEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Survey completed successfully
 *       403:
 *         description: Road not assigned to surveyor
 */
app.patch('/complete-survey/:roadName', async (req, res) => {
  const { surveyEndDate, surveyorEmail } = req.body;
  const roadName = req.params.roadName;
  
  // Check if road is assigned to this surveyor
  const road = await Road.findOne({ 
    roadName, 
    assignedSurveyor: surveyorEmail 
  });
  
  if (!road) {
    return res.status(403).json({ message: 'Road not assigned to you' });
  }
  
  // Update all photos for this road
  await Photo.updateMany(
    { roadName },
    { 
      surveyEndDate: new Date(surveyEndDate),
      surveyStatus: 'completed',
      stage: 'approved'
    }
  );
  
  // Update road status
  road.status = 'completed';
  await road.save();
  
  res.json({ message: 'Survey completed for road: ' + roadName });
});

/**
 * @swagger
 * /manager-approve/:roadName:
 *   patch:
 *     summary: Manager approves road repair with contractor and repair date
 *     tags: [Manager]
 *     parameters:
 *       - in: path
 *         name: roadName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractor:
 *                 type: string
 *               repairDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Road approved for repair
 */
app.patch('/manager-approve/:roadName', async (req, res) => {
  const { contractor, repairDate } = req.body;
  const roadName = req.params.roadName;
  
  // Get contractor details
  const contractorInfo = await Contractor.findById(contractor);
  if (!contractorInfo) {
    return res.status(404).json({ message: 'Contractor not found' });
  }
  
  // Update all photos for this road
  await Photo.updateMany(
    { roadName },
    { 
      contractor: contractorInfo.company_name,
      repairDate: new Date(repairDate),
      stage: 'in_repair'
    }
  );
  
  // Send email notifications
  const photos = await Photo.find({ roadName });
  const surveyors = [...new Set(photos.map(p => p.email))];
  
  try {
    // Email to contractor
    await transporter.sendMail({
      from: EMAIL_USER,
      to: contractorInfo.email,
      subject: '🏗️ Road Repair Assignment',
      html: `
        <h2>Road Repair Assignment</h2>
        <p>Hello <strong>${contractorInfo.company_name}</strong>,</p>
        <p>You have been assigned to repair <b>${roadName}</b>.</p>
        <p><strong>Repair Date:</strong> ${new Date(repairDate).toLocaleDateString()}</p>
        <p><strong>Total Photos:</strong> ${photos.length}</p>
        <p><strong>Total Budget:</strong> ${photos.reduce((sum, p) => sum + (p.roadBudget || 0), 0).toLocaleString()} Tsh</p>
        <p>Please review the damage photos and begin repair work on the specified date.</p>
        <p>Best regards,<br>Road Damage Management System</p>
      `
    });
    
    // Email to surveyors
    for (let email of surveyors) {
      await transporter.sendMail({
        from: EMAIL_USER,
        to: email,
        subject: '✅ Road Survey Approved for Repair',
        html: `
          <h2>Road Survey Approved</h2>
          <p>Your survey for <b>${roadName}</b> has been approved for repair.</p>
          <p><strong>Assigned Contractor:</strong> ${contractorInfo.company_name}</p>
          <p><strong>Repair Date:</strong> ${new Date(repairDate).toLocaleDateString()}</p>
          <p><strong>Total Photos:</strong> ${photos.length}</p>
          <p><strong>Total Budget:</strong> ${photos.reduce((sum, p) => sum + (p.roadBudget || 0), 0).toLocaleString()} Tsh</p>
          <p>The contractor will begin repair work on the specified date.</p>
          <p>Best regards,<br>Road Damage Management System</p>
        `
      });
    }
    
    res.json({ message: 'Road approved for repair. Emails sent to contractor and surveyors.' });
  } catch (emailError) {
    console.error('Email error:', emailError);
    // Still return success even if emails fail
    res.json({ message: 'Road approved for repair. Email notifications may have failed.' });
  }
});

/**
 * @swagger
 * /search-roads:
 *   get:
 *     summary: Search roads by criteria (Manager view)
 *     tags: [Manager]
 *     parameters:
 *       - in: query
 *         name: roadName
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roads:
 *                   type: array
 *                   items:
 *                     type: object
 */
app.get('/search-roads', async (req, res) => {
  const { roadName, endDate } = req.query;
  let query = { surveyStatus: 'completed' };
  
  if (roadName) {
    query.roadName = { $regex: roadName, $options: 'i' };
  }
  
  if (endDate) {
    query.surveyEndDate = { $lte: new Date(endDate) };
  }
  
  const roads = await Photo.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$roadName',
        totalBudget: { $sum: '$roadBudget' },
        photoCount: { $sum: 1 },
        surveyEndDate: { $first: '$surveyEndDate' },
        stage: { $first: '$stage' },
        contractor: { $first: '$contractor' },
        repairDate: { $first: '$repairDate' }
      }
    },
    { $sort: { surveyEndDate: -1 } }
  ]);
  
  res.json({ roads });
});

/**
 * @swagger
 * /road-report/{roadName}:
 *   get:
 *     summary: Get detailed report for a specific road
 *     tags: [Manager]
 *     parameters:
 *       - in: path
 *         name: roadName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Road report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/road-report/:roadName', async (req, res) => {
  const roadName = req.params.roadName;
  const photos = await Photo.find({ roadName }).sort({ dateCreated: 1 });
  
  if (photos.length === 0) {
    return res.status(404).json({ message: 'No photos found for this road' });
  }
  
  const report = {
    roadName,
    totalPhotos: photos.length,
    totalBudget: photos.reduce((sum, p) => sum + (p.roadBudget || 0), 0),
    surveyStartDate: photos[0]?.surveyStartDate,
    surveyEndDate: photos[0]?.surveyEndDate,
    stage: photos[0]?.stage,
    contractor: photos[0]?.contractor,
    repairDate: photos[0]?.repairDate,
    photos: photos.map(p => ({
      damageClass: p.damageClass,
      comment: p.comment,
      photoUrl: p.photoUrl,
      roadBudget: p.roadBudget,
      dateCreated: p.dateCreated,
      location: p.location,
      approvalStatus: p.approvalStatus,
      officerComment: p.officerComment
    }))
  };
  
  res.json(report);
});

// === Start Server ===
server.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
