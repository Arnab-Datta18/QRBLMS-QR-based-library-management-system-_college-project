# Product Requirements Document (PRD)
**Project Name:** TCEA LIBRARY (Student Mobile Application)
**Target Platform:** Android (APK via React Native / Expo)
**Phase:** Major Project - 1 (5th Semester)

## 1. Project Overview & Core Logic
This project is a native mobile application exclusively for students to interact with the existing TCEA Library Management System. 
*   **Single Source of Truth:** The mobile app connects to the exact same SQLite database as the web portal via new Flask REST APIs. 
*   **Strictly No Registration:** There is no "Sign Up" screen in the app. Accounts are created exclusively by the Librarian on the web portal. Students can only log in using those pre-registered credentials.
*   **Contextual Filtering:** All data (books, PYQs, fines) must be automatically filtered on the backend to match the specific Course, Department, and Semester of the logged-in student.

## 2. Technology Stack
*   **Frontend Mobile:** React Native with Expo (TypeScript).
*   **Key Expo Libraries:** `expo-local-authentication` (biometrics), `expo-secure-store` (token vault), `expo-notifications`.
*   **UI/Design:** Clean, intuitive, modern layout. Primary accent color: Red. Keep filenames simple (e.g., `Home.tsx`, `Login.tsx`).
*   **Backend API:** Flask (Python) returning JSON responses via a new `api_routes.py` Blueprint.

## 3. Authentication Architecture (Two-Token System)
*   **Manual Login (Initial):** Uses the student's `Student ID` (e.g., CSE1) as the username and their assigned password.
*   **Token Generation:** Upon successful login, the Flask API returns a short-lived `access_token` and a long-lived `refresh_token`.
*   **Secure Storage:** The mobile app saves the `refresh_token` inside the device's encrypted `SecureStore`.
*   **Biometric Login:** On subsequent app opens, the user is prompted with native Fingerprint/FaceID. If successful, the app silently exchanges the `refresh_token` for a new `access_token` to bypass typing passwords.

## 4. Global Navigation & Architecture
*   **Bottom Tab Navigator:** 
    1. **Home Tab:** The central dashboard and digital ID.
    2. **Catalog Tab:** The live library inventory search.
    3. **Academics Tab:** The PYQ download hub.
*   **Stack Navigator:** Used for modals, Profile Screen, and Notifications Screen.
*   **Global Header:** Shows College Logo, "TCEA", Course, and Semester. On the right side, it contains two icons: a **Notification Bell** and a **User Profile Icon**.

## 5. Screen-by-Screen Feature Requirements

### Screen 1: Login Screen 
*   **UI:** Standard login form (Student ID + Password) AND a Biometric Login button. No registration links.

### Screen 2: Home Tab (Dashboard)
*   **Digital QR ID:** A large, central QR code. This must be an exact programmatic match to the web portal's QR logic (e.g., `STUDENT:<ID>`) so the librarian's physical webcam scanner reads it perfectly.
*   **Fine Tracker Banner:** A conditional alert banner showing pending fines (Red if > 0, Green if 0).
*   **Active Issues List:** A scrollable list of currently borrowed books showing Title and Due Date. 

### Screen 3: Catalog Tab (Live Inventory)
*   **Filtered View:** Automatically only displays books relevant to the student's registered department and semester.
*   **Search Bar:** Filter by Book Name, Author, or Book ID.
*   **Results List:** Displays matching books with real-time "In Stock" / "Out of Stock" badges. 

### Screen 4: Academics Tab (PYQ Hub)
*   **Filtered View:** Automatically only shows PDFs matching the student's department and semester. 
*   **Results:** List of available PDF files. Tapping opens/downloads the PDF.

### Screen 5: Notifications Screen (Triggered via Header Bell Icon)
*   **UI:** A list view of alerts specific to the student (e.g., "Book XYZ is due tomorrow", "You have a ₹15 fine").

### Screen 6: Profile Screen (Triggered via Header Profile Icon)
*   **User Details:** Displays Name, Student ID, Email, Department.
*   **Change Password:** Secure form allowing the student to update their password.
*   **Reading Vault:** Historical list of previously borrowed and returned books.

## 6. Required Backend API Endpoints (To be built in Flask)
*   `POST /api/login` - Returns tokens and basic user profile data.
*   `POST /api/refresh` - Validates `refresh_token`, returns new `access_token`.
*   `POST /api/student/change_password` - Updates user password securely.
*   `GET /api/student/dashboard/<student_id>` - Returns active issues, fines, and exact Student QR payload.
*   `GET /api/notifications/<student_id>` - Returns personalized alerts and due-date warnings.
*   `GET /api/books/catalog/<student_id>` - Returns inventory automatically filtered by the student's demographics.
*   `GET /api/student/history/<student_id>` - Returns vault of returned books.
*   `GET /api/pyq/<student_id>` - Returns academic papers automatically filtered by student demographics.
*