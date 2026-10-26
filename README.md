# QRBLMS: QR-Based Library Management System

A full-stack, secure Library Management System featuring a Flask-powered web portal and an Expo / React Native mobile application for students, built for college libraries.

---

## Architecture Overview

```
QRBLMS/
├── website/              # Flask Backend, Web Portal & REST APIs
│   ├── routes/           # Auth, Web & Mobile API Blueprints
│   ├── services/         # QR Code Generation & Scanning Services
│   ├── static/           # Static assets, logos, and UI styles
│   ├── templates/        # Jinja2 HTML templates for the librarian portal
│   ├── App.py            # Flask Application Entry Point
│   ├── models.py         # SQLAlchemy Database Models (Librarian, Student, Book, Issue, etc.)
│   ├── requirements.txt  # Python Dependencies
│   └── .env.example      # Environment Configuration Template
│
├── mobile_app/           # React Native / Expo Student Mobile Application
│   ├── api/              # Axios API client & token auth handlers
│   ├── assets/           # App icons, splash screens, images
│   ├── components/       # Reusable UI components
│   ├── screens/          # Home (QR ID), Catalog, Academics (PYQ), Notifications, Profile
│   ├── App.tsx           # App Root & Navigation Configuration
│   ├── package.json      # Node.js Dependencies & Expo Scripts
│   └── tsconfig.json     # TypeScript Configuration
│
├── prd.md                # Product Requirements Document
├── master_project_log.txt# Project Development Log
└── .gitignore            # Master Repository Exclusion Rules
```

---

## Features

### Web Portal (Librarian / Admin)
- **Role-Based Access**: Secure login and dashboard for librarians.
- **Student & Book Management**: Add, update, and manage inventory and student records.
- **Physical QR Scanning**: Webcam-integrated QR scanner for instantaneous book issue and return processing.
- **Dynamic Fine Calculator**: Automatic fine computation based on issue duration and return deadlines.
- **PYQ & Academic Resource Management**: Upload and organize previous year question papers by department and semester.
- **Real-time Notifications**: Automated alerts for book issue deadlines and fines.

### Mobile App (Students)
- **Digital QR ID**: Display unique student QR code for physical library desk checkout.
- **Biometric Authentication**: Fingerprint / Face ID login backed by encrypted hardware keystore (`expo-secure-store`).
- **Personalized Catalog**: Real-time book inventory filtered by student department and semester.
- **Academics Hub (PYQs)**: Browse and download department-specific question papers.
- **Fine Tracker & Issue History**: Live tracking of current book loans, due dates, and fine amounts.

---

## Quick Start Guide

### 1. Backend & Web Portal Setup

1. **Navigate to the website directory**:
   ```bash
   cd website
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env and set your custom FLASK_SECRET_KEY
   ```

5. **Start the Flask server**:
   ```bash
   python App.py
   ```
   The web portal will be accessible at `http://127.0.0.1:5000`.

---

### 2. Mobile App Setup

1. **Navigate to the mobile app directory**:
   ```bash
   cd mobile_app
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

4. **Run on Device**:
   - Install **Expo Go** from Google Play Store or Apple App Store.
   - Scan the QR code shown in your terminal / Expo developer tools.
   - Ensure your phone and development computer are connected to the same Wi-Fi network.

---

## Security & Privacy Guidelines

- **No Secrets in Version Control**: `.env`, private keys (`*.key`, `*.pem`), and credentials (`password.txt`) are excluded via `.gitignore`.
- **Database Safety**: Local SQLite database files (`*.db`, `instance/`) are ignored to avoid committing sensitive user records or password hashes.
- **Dependencies Excluded**: Virtual environments (`.venv/`) and Node modules (`node_modules/`) are untracked.

---

## License

This project is developed as part of the 5th Semester Major Project-1.
