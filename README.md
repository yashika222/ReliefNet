# Disaster Relief Resource System

A comprehensive full-stack Node.js + Express + MongoDB + EJS + Socket.io application for coordinating disaster relief efforts with authentication-first approach.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (version 18 or higher)
- **MongoDB** (local installation or MongoDB Atlas)

### Setup Instructions

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Setup**
Create a `.env` file in your project root:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/disaster_relief
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=development
```

3. **Start MongoDB**
- **Local**: Make sure MongoDB is running on your system
- **Atlas**: Use your cloud connection string in the `.env` file

4. **Run the Application**
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

5. **Access the Application**
Open your browser and go to: **http://localhost:3000**

### 🔐 Authentication-First Approach
- **All routes require authentication** - users must login/signup first
- **Role-based access** - Different user types (Admin, Donor, NGO, Volunteer, Victim)
- **Secure sessions** - JWT tokens with HTTP-only cookies

## Features Delivered (Phase 1)
- Navigation: Home, About, Resources, Request Help, Donate, Login, Signup
- EJS Frontend with TailwindCSS CDN
- REST APIs (Auth, Resources - basic)
- MongoDB with Mongoose
- WebSocket channel for urgent alerts
- Logging to files (Winston)

## Project Structure
```
/ (root)
  server.js
  src/
    app.js
    config/
      db.js, logger.js, socket.js
    models/
      User.js, Resource.js, Request.js, Donation.js, VolunteerTask.js
    routes/
      index.js, auth.js, resources.js
    views/
      layout.ejs
      partials/navbar.ejs, partials/footer.ejs
      pages/*.ejs
  public/
  logs/
```

## Syllabus Mapping (Highlights)
- Node.js Fundamentals: documented and used (modules, npm, scripts)
- Async & FS: async/await in DB/API; logging to files
- APIs & Express: REST routes, middleware, validation
- EJS templating: pages & layout
- WebSocket: urgent alerts via socket.io
- MongoDB: Mongoose models and CRUD
- Web Security: helmet, rate-limit, JWT scaffolding in auth
- Testing: Jest setup (tests to be added)
- Deployment: To be added (AWS, PM2)

## Scripts
- `npm run dev` - start with nodemon
- `npm start` - start server
- `npm test` - run Jest tests

## Next Steps
- Implement full CRUD for donations, requests, volunteers, admin dashboard
- Role-based auth middleware and protected routes
- EJS reports and admin pages
- Upload receipts to S3
- Tests (unit, functional, integration)
- Deployment guide
