// Load environment variables
const envPath = process.env.NODE_ENV === 'production' ? './env.production' : './env.development'
require('dotenv').config({
  path: envPath
})

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
const http = require('http')
const socketIo = require('socket.io')

// Import routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const projectRoutes = require('./routes/projects')
const invitationRoutes = require('./routes/invitations')

const app = express()
const server = http.createServer(app)

// Environment check
const isDev = process.env.NODE_ENV === 'development'

// Socket.io configuration (optimized for dev)
const io = socketIo(server, {
  cors: {
    origin: isDev 
      ? 'http://localhost:3000'
      : [process.env.FRONTEND_URL, 'https://taskforge.netlify.app'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: isDev ? ['websocket'] : ['websocket', 'polling'],
  allowEIO3: true
})

// Security middleware (lighter in dev)
if (!isDev) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))
} else {
  // Minimal security in dev
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }))
}

// CORS configuration
app.use(cors({
  origin: isDev 
    ? 'http://localhost:3000'
    : [
        process.env.FRONTEND_URL, 
        'https://taskforge.netlify.app',
        'https://taskfoge.netlify.app'  // Your actual Netlify domain
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Rate limiting (disabled in dev for faster testing)
if (!isDev) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use(limiter)
}

// Body parsing (optimized for dev)
app.use(express.json({ 
  limit: isDev ? '10mb' : '5mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}))
app.use(express.urlencoded({ 
  extended: true, 
  limit: isDev ? '10mb' : '5mb' 
}))

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  })
})

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  })
})

// Root route handler
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'TaskForge API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      projects: '/api/projects',
      invitations: '/api/invitations'
    }
  })
})

// Static file serving (with security headers in production)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    if (!isDev) {
      res.set('X-Content-Type-Options', 'nosniff')
      res.set('X-Frame-Options', 'DENY')
    }
  }
}))

// Request logging (minimal in dev)
if (!isDev) {
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`)
    })
    next()
  })
} else {
  // Minimal logging in dev - only errors and important routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && req.method !== 'GET') {
      console.log(`${req.method} ${req.path}`)
    }
    next()
  })
}

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/invitations', invitationRoutes)

// Socket.io connection handling (optimized)
io.on('connection', (socket) => {
  if (!isDev) {
    console.log('User connected:', socket.id)
  }
  
  socket.on('disconnect', (reason) => {
    if (!isDev) {
      console.log('User disconnected:', socket.id, 'Reason:', reason)
    }
  })
  
  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  const message = isDev ? err.message : 'Something went wrong!'
  const status = err.status || 500
  res.status(status).json({ 
    message,
    ...(isDev && { stack: err.stack })
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

// MongoDB connection (async, non-blocking)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: isDev ? 5 : 10,
      serverSelectionTimeoutMS: isDev ? 3000 : 5000,
      socketTimeoutMS: isDev ? 30000 : 45000,
    })
    console.log(`MongoDB Connected: ${conn.connection.host}`)
    
    mongoose.connection.on('error', (err) => { 
      console.error('MongoDB connection error:', err) 
    })
    mongoose.connection.on('disconnected', () => { 
      if (!isDev) console.log('MongoDB disconnected') 
    })
  } catch (error) {
    console.error('MongoDB connection failed:', error)
    if (!isDev) process.exit(1)
  }
}

// Start server immediately, connect to DB asynchronously
const startServer = async () => {
  const PORT = process.env.PORT || 5000
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
    console.log(`Health check available at: http://localhost:${PORT}/health`)
    
    // Connect to MongoDB after server starts (non-blocking)
    connectDB()
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

module.exports = { app, server, io };
