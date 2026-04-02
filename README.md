# 🛣️ NHMS - National Highway Management System

Welcome to the **National Highway Management System (NHMS)**! This project provides a robust, real-time web application to assist highway travelers and streamline highway administrative tasks. It's built with modern web development practices to ensure a fast, secure, and beautiful user experience.

---

## 🚀 Overview

NHMS is designed to enhance safety and convenience on national highways. Whether you are a traveler looking for the best route, or an administrator monitoring highway systems, NHMS has you covered. The project features a beautifully designed UI, interactive maps, and a complete secure backend architecture.

---

## ✨ Key Features

- **🗺️ Smart Route Planner**: Interactively select your source and destination, and preview routes on a map. Powered by `leaflet`.
- **⏱️ Speed Monitor**: Track and maintain optimal driving speeds.
- **🚨 Emergency Services**: Quick access to SOS reporting and immediate emergency assistance dispatch.
- **📱 Traveler Dashboard**: A personalized space for users to manage profiles, vehicles, and history.
- **🛡️ Admin Panel**: Comprehensive oversight dashboard for system administrators.
- **🔐 Secure Authentication**: JWT-based login and registration with Bcrypt password hashing and OTP-based email verification.

---

## 🛠️ Technology Stack

**Frontend** 🎨
- **Framework:** [React 18](https://react.dev/) powered by [Vite](https://vitejs.dev/)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) & Radix UI primitives
- **Icons:** Lucide React
- **Maps:** Leaflet & React-Leaflet
- **State Management & Data Fetching:** TanStack React Query

**Backend** ⚙️
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (with Mongoose ORM)
- **Security:** JSON Web Tokens (JWT), Bcrypt

---

## 📂 Project Structure

```text
NHMS/
├── backend/                # Node.js + Express backend server
│   ├── models/             # Mongoose schemas (User, Report, etc.)
│   ├── routes/             # API route definitions
│   ├── server.ts           # Main server entrypoint
│   └── package.json        # Backend dependencies
├── src/                    # React frontend application
│   ├── components/         # Reusable UI components (shadcn/ui)
│   ├── contexts/           # React Context (AuthContext)
│   ├── pages/              # Application pages (Dashboard, Admin, RoutePlanner, etc.)
│   ├── App.tsx             # Main React component and Router setup
│   └── index.css           # Global styles and Tailwind directives
├── public/                 # Static assets
└── package.json            # Frontend dependencies and scripts
```

---

## 💻 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB**: A running MongoDB instance (Local or MongoDB Atlas)

### 1. Clone the repository
```bash
git clone <repository-url>
cd NHMS
```

### 2. Setup the Backend
Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory with the following variables:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
EMAIL_USER=your_smtp_email
EMAIL_PASS=your_smtp_password
```
Start the backend server:
```bash
npm start
# The backend will run on http://localhost:3000
```

### 3. Setup the Frontend
Open a new terminal window and navigate to the root directory:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
# The frontend will run on http://localhost:8080
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](#) if you want to contribute.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License
This project is licensed under the MIT License.
