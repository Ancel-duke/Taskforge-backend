# TaskForge Backend

A Node.js Express server with MongoDB for the TaskForge project management platform.

## Features

- JWT Authentication with bcrypt password hashing
- User management with avatar uploads
- Project and task management
- Real-time updates with Socket.io
- Analytics and reporting
- File upload handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `env.example`:
```bash
cp env.example .env
```

3. Update environment variables:
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 5000)

4. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/search` - Search users by username

### Projects
- `POST /api/projects` - Create new project
- `GET /api/projects` - Get user's projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects/:id/members` - Add member to project
- `GET /api/projects/:id/analytics` - Get project analytics

### Tasks
- `POST /api/projects/:id/tasks` - Create new task
- `PUT /api/projects/:id/tasks/:taskId` - Update task
- `DELETE /api/projects/:id/tasks/:taskId` - Delete task

## Socket.io Events

- `joinProject` - Join project room for real-time updates
- `leaveProject` - Leave project room
- `taskCreated` - Emitted when task is created
- `taskUpdated` - Emitted when task is updated
- `taskDeleted` - Emitted when task is deleted

## File Structure

```
backend/
├── controllers/     # Business logic
├── middleware/      # Auth and upload middleware
├── models/         # Mongoose models
├── routes/         # Express routes
├── uploads/        # File uploads
├── server.js       # Entry point
└── package.json
```
