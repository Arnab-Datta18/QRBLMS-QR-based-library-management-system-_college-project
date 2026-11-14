# QRBLMS Mobile Application - Complete Architectural Audit & State Report

**Document Date:** November 15, 2026  
**Audited Target:** `mobile_app/` (React Native / Expo Client)  
**Parent System:** QRBLMS (QR-Based Library Management System)  
**Audit Scope:** Full codebase scan, environment inspection, dependency audit, navigation graph mapping, API integration review, security evaluation, and gap analysis.

---

## Executive Summary

The QRBLMS mobile application is a student-facing companion app built with **React Native (0.88.0)** and **Expo SDK 58**. It is designed exclusively for enrolled students of Techno College of Engineering Agartala (TCEA) to interface with the centralized TCEA Library Management System. 

The application operates as a **client consumer** to a Python/Flask REST API hosted on PythonAnywhere (`https://qrblms.pythonanywhere.com/api`). In contrast to common assumptions, **the mobile app does not include an in-app camera barcode/QR scanner**. Instead, it acts as a **dynamic QR emission terminal**: it renders high-contrast QR gatepasses and book return tokens for the Librarian to scan using the web portal's webcam scanner.

---

## 1. Tech Stack & Environment

### 1.1 Core Runtime & Frameworks
| Layer | Specification / Version | Description |
| :--- | :--- | :--- |
| **Framework** | Expo SDK `^58.0.0` / React Native `0.88.0` | Managed Expo workflow with custom EAS native profiles |
| **Language** | TypeScript `~6.0.3` | Strict mode enabled (`tsconfig.json` extends `expo/tsconfig.base`) |
| **UI Library** | React `19.3.0` | React core with standard functional components and hooks |
| **Bundle Tool** | Metro Bundler | Configured via Expo CLI |
| **App Entry Point** | `mobile_app/index.ts` | Calls `registerRootComponent(App)` |

### 1.2 Package Dependencies Breakdown (`package.json`)
| Package Name | Version | Category | Role in Mobile Application |
| :--- | :--- | :--- | :--- |
| `@react-navigation/native` | `^7.4.1` | Navigation | Core navigation container and theme management |
| `@react-navigation/native-stack` | `^7.19.2` | Navigation | Native stack navigation for authentication boundary (`Login` -> `MainTabs`) |
| `@react-navigation/bottom-tabs` | `^7.19.2` | Navigation | Bottom tab bar coordinator hosting Home, Borrowed, Academics, Profile, Notifications |
| `react-native-screens` | `~4.30.0` | Navigation | Native screen primitives for memory efficiency |
| `react-native-safe-area-context` | `~5.10.1` | UI Layout | Notch, status bar, and home indicator inset handling |
| `axios` | `^1.20.0` | Networking | HTTP client configured with centralized timeout, base URL, and headers |
| `expo-secure-store` | `~58.0.2` | Security/Storage | AES-256 encrypted hardware keystore access for refresh tokens and IDs |
| `expo-local-authentication` | `~58.0.2` | Security/Biometrics | Native fingerprint / Face ID hardware sensor checks and authentication prompt |
| `react-native-qrcode-svg` | `^6.3.26` | Graphics/QR | SVG-based vector QR code renderer for gatepass and return tokens |
| `react-native-svg` | `15.16.0` | Graphics | Vector rendering engine supporting QR generation and custom icons |
| `expo-linear-gradient` | `~58.0.3` | UI/Styling | Multi-stop color gradients for hero banners, pass frames, and action buttons |
| `expo-font` | `~58.0.10` | Typography | Dynamic asynchronous font asset loader |
| `@expo-google-fonts/plus-jakarta-sans` | `^0.4.2` | Typography | Brand typography: Medium (500), Bold (700), ExtraBold (800) |
| `@expo-google-fonts/jetbrains-mono` | `^0.4.1` | Typography | Monospace typography used for paper codes and student roll numbers |
| `@expo/vector-icons` | `^15.0.2` | Icons | Ionicons icon pack utilized across tabs, chips, and modals |
| `expo-image-picker` | `~58.0.10` | Media | Gallery picker for avatar upload with 1:1 square crop aspect ratio |
| `expo-file-system` | `~58.0.11` | Media/Storage | Downloads PYQ question papers into device document/cache directory |
| `expo-sharing` | `~58.0.20` | Native Bridge | System share sheet trigger for saving or sharing downloaded PDFs |
| `expo-intent-launcher` | `~58.0.3` | Native Bridge (Android) | Triggers Android `android.intent.action.VIEW` for native PDF viewing |
| `expo-clipboard` | `~58.0.4` | System Utility | One-tap clipboard copying of Student ID from the digital gatepass |
| `expo-notifications` | `~58.1.6` | Utilities | Push/local notification primitives (currently filtered in `LogBox`) |

### 1.3 Build & Project Configuration
- **Application Configuration (`mobile_app/app.json`)**:
  - `name`: `"mobile_app"`, `slug`: `"mobile_app"`, `version`: `"1.0.0"`
  - `orientation`: `"portrait"`
  - `package`: `"com.tcea.library"` (Android Application ID)
  - `userInterfaceStyle`: `"light"`
  - `adaptiveIcon`: Background `#E6F4FE` with layered foreground, background, and monochrome assets in `mobile_app/assets/`
  - `plugins`: Registered plugins include `expo-secure-store`, `expo-font`, and `expo-sharing`
  - `extra.eas.projectId`: `"32fea263-0d01-4719-a298-bd2a56aaa71e"`
- **EAS Build Configuration (`mobile_app/eas.json`)**:
  - `cli.version`: `">= 24.7.0"`
  - `build.development`: Dev client enabled for internal distribution
  - `build.preview`: Builds standalone APK directly (`android.buildType: "apk"`)
  - `build.production`: Remote versioning with `autoIncrement: true`
- **TypeScript Configuration (`mobile_app/tsconfig.json`)**:
  - Extends `expo/tsconfig.base` with `strict: true`.

---

## 2. Screen Index & Navigation Architecture

### 2.1 Navigation Graph & Routing Flow

```
[ Root NavigationContainer ]
       │
       ▼
[ Stack.Navigator (initialRouteName="Login") ]
       ├── Screen: "Login"  ────────── (Successful Auth) ──────────┐
       │                                                          │
       └── Screen: "MainTabs" ◄───────────────────────────────────┘
              │
              ├── [ Custom Floating Tab Bar Pill ]
              │      ├── Tab: "Home" (Dashboard & Gatepass)
              │      ├── Tab: "Borrowed" (Loans & History)
              │      └── Tab: "Academics" (PYQ Digital Archives)
              │
              └── [ Hidden Tabs (Routed via Header Buttons) ]
                     ├── Tab: "Profile" (User Demographics & Password)
                     └── Tab: "Notifications" (Alert Feed & Detail Modals)
```

### 2.2 Floating Custom Tab Bar (`CustomTabBar` in `App.tsx`)
- The tab bar is rendered as a floating, rounded pill (`borderRadius: 999`, bottom `24px`, shadow elevation 8).
- It selectively renders only **Home**, **Borrowed**, and **Academics** in the pill.
- If the user navigates into **Profile** or **Notifications**, the pill remains inactive/hidden without breaking the tab navigation stack.
- Switching between tabs uses `navigation.navigate(route.name)` with active highlight state (Red `#C81E27` pill background with white text).

### 2.3 Comprehensive Screen Index

#### 1. Login Screen (`mobile_app/screens/Login.tsx`)
- **Route Name**: `'Login'`
- **Access / Triggers**: Initial app load; also target of logout navigation reset.
- **Visual Structure**:
  - Dark Navy to Slate gradient header (`LinearGradient colors={[C.navyDeep, C.navy, '#1B4A7A']}`).
  - Floating circular TCEA crest emblem logo.
  - Overlapping elevated white card containing:
    - Roll Number / Registration ID input (autocapitalize characters, focus states).
    - Password input with toggleable show/hide eye icon (`Ionicons eye-outline` / `eye-off-outline`).
    - "Remember ID" custom checkbox (persists Roll Number in `SecureStore`).
    - Gradient "SIGN IN" button with activity indicator on submit.
    - Divider and Biometric Authentication button ("Sign in with Face ID / Fingerprint").
  - Footer with AICTE accreditation and institutional attribution.
- **Key Interactivity**:
  - `checkBiometrics()`: Queries `LocalAuthentication.hasHardwareAsync()` and `isEnrolledAsync()`. Only displays biometric button if hardware is present, enrolled, and a valid refresh token exists in `SecureStore`.
  - `handleLogin()`: Submits credentials to `loginWithCredentials()`. On success, executes `navigation.replace('MainTabs')`.
  - `handleBiometricLogin()`: Triggers device biometric dialog with 30-second timeout fallback. Upon verification, silently calls `POST /api/refresh` to renew tokens and enters the app.

#### 2. Home Screen (`mobile_app/screens/Home.tsx`)
- **Route Name**: `'Home'` (First tab of `MainTabs`)
- **Visual Structure**:
  - Header: Institutional title, Notifications button (with unread badge indicator), Profile button.
  - Personalized Greeting: "Hello, {Student Name}!" with automatic font shrinking.
  - Demographic Chip Carousel: Horizontal tags showing Course, Department, and Semester.
  - Digital Library Pass Card:
    - High-density vector QR code rendered via `react-native-qrcode-svg`.
    - Centered Student Roll Number pill with one-tap copy button (`expo-clipboard`).
    - Subtext: "Verified institutional gatepass - Tap to expand or scan at library terminal".
  - Dynamic Stats Grid:
    - Active Loans counter: `{active_issues.length} / 4` loans.
    - Due Date Chip: Computes closest due date ("Today", "Tomorrow", "X Days", "Overdue", or "No Dues").
  - Available Books Section:
    - Horizontal/vertical listing of books relevant to the student's department/semester.
    - Colorful book spine accent borders.
    - Availability status badge ("Available" / "Unavailable").
    - "Reserve" action button.
- **Data Lifecycle**: Uses `useFocusEffect` to call `getDashboard()` and `getCatalog()` on screen focus. Supports pull-to-refresh (`RefreshControl`).

#### 3. Borrowed Books Screen (`mobile_app/screens/Borrowed.tsx`)
- **Route Name**: `'Borrowed'` (Second tab of `MainTabs`)
- **Visual Structure**:
  - Header: "Borrowed Books" with stat counters for "Active", "Overdue", and "Returned".
  - Currently Borrowed Cards:
    - Active books with green indicator spine.
    - Progress indicator track showing percentage of 14-day loan duration elapsed.
    - Issue Date and Due Date labels.
    - "Renew Loan" button and QR Return button.
  - Overdue Loans Banner & Fine Card:
    - Crimson border and warning banner displaying "OVERDUE BY X DAYS".
    - Accumulated fine counter calculated dynamically at ₹5 per day.
    - "Clear Fine & Return Book" action button.
  - Past Loans History ("Reading Vault"):
    - Historical list of returned books showing check-in and return dates with "Returned" badge.
  - Book Return QR Modal:
    - Modal popup presenting an enlarged QR code encoding `item.qr_code_string` for desk checkout.
- **Data Lifecycle**: Fetches `getDashboard()` and `getHistory()` concurrently on focus.

#### 4. Academics / Digital Archives Screen (`mobile_app/screens/Academics.tsx`)
- **Route Name**: `'Academics'` (Third tab of `MainTabs`)
- **Visual Structure**:
  - Navy gradient header with "Digital Archives" title and subtext "Previous-year question papers".
  - Search Input Bar: Real-time filter searching subject name or paper code, with decorative mic icon.
  - Result Counter: Pill showing number of listed question papers.
  - Document Cards:
    - Red gradient PDF badge displaying file size (e.g., "1.4 MB").
    - Subject code pill in JetBrains Mono font.
    - Examination type indicator dot (Mid-term vs End-semester).
    - Dual Action Buttons:
      - "View" button: Opens native device document viewer.
      - "Download" button: Downloads PDF to local storage and invokes the system share sheet.
- **Data Lifecycle**: Fetches `getPyqs(studentId)` on focus and performs client-side memoized search filtering (`useMemo`).

#### 5. Profile Screen (`mobile_app/screens/Profile.tsx`)
- **Route Name**: `'Profile'` (Accessed via header profile button on Home, Borrowed, or Academics)
- **Visual Structure**:
  - Large avatar circle displaying either the uploaded profile photo or student initials.
  - Camera overlay button invoking gallery image selection (`expo-image-picker`).
  - Student Name and institutional verification badge.
  - Demographic Details Card: Locked read-only fields for Roll Number, Course, Department, Semester, and Email.
  - Academic Metric Tiles: Active loans count and total accumulated dues.
  - Change Password Card: Form containing Current Password, New Password, and Confirm Password with mask toggles and submit button.
  - Logout Action: Red outlined button triggering a native confirmation dialog.
- **Data Lifecycle**: Fetches `getDashboard()` on focus; executes `uploadAvatar()` on image pick; calls `changePassword()` on form submit.

#### 6. Notifications Screen (`mobile_app/screens/Notifications.tsx`)
- **Route Name**: `'Notifications'` (Accessed via header bell icon)
- **Visual Structure**:
  - Header: Back arrow navigation, "Notifications" brand title, and "Mark all as read" button.
  - Unread Count Pill and Tab Filter: Toggle between "All" and "Unread".
  - Grouped Section List: Chronological grouping by "Today", "Yesterday", and "Earlier".
  - Notification Rows: Unread highlight bar, category-specific colored icon, timestamp, and summary.
  - Centered Modal: Tapping any row opens `NotificationCategoryCard` displaying full alert details.
- **Data Lifecycle**: Fetches `getNotifications()`, optimistic local mark-as-read updates, and syncs via `markNotificationRead()` / `markAllNotificationsRead()`.

#### 7. Notification Category Card (`mobile_app/components/NotificationCategoryCard.tsx`)
- **Type**: Reusable Presentation Component (Modal Card)
- **Visual Themes**:
  1. *Theme 1 (Red Gradient)*: Overdue warnings and upcoming due reminders.
  2. *Theme 2 (White + Red Accent)*: Fine additions and security/password alerts.
  3. *Theme 3 (White + Green Accent + Dashed Strip)*: Transaction receipts (book issued, returned, renewed, or held).
  4. *Theme 4 (Navy Gradient + Coral Accent)*: Academic syllabus and new department book arrivals.
  5. *Theme 5 (Amber/Cream Gradient)*: College-wide administrative broadcasts.

---

## 3. Core Mechanics & API Integration

### 3.1 Network Architecture (`mobile_app/api/client.ts`)
- **Base URL Resolution**:
  ```typescript
  export const BACKEND_URL = 'https://qrblms.pythonanywhere.com'.replace(/\/+$/, '');
  export const baseURL = `${BACKEND_URL}/api`;
  ```
- All mobile API requests communicate over HTTPS with `https://qrblms.pythonanywhere.com/api`.
- Media assets and uploaded avatars are resolved via `getFullImageUrl()`, which strips `/api` to target static storage at `https://qrblms.pythonanywhere.com/<path>`.

### 3.2 Authentication & Biometric Mechanics (`mobile_app/api/auth.ts`)
1. **Initial Login**:
   - `POST /api/login` with `{ student_id, password }`.
   - The backend validates credentials using `werkzeug.security` (or legacy plaintext fallback) and returns `{ access_token, refresh_token, student }`.
   - `storeAuthData()` securely stores `refresh_token`, `student_id`, and `saved_biometric_student_id` in hardware-encrypted `expo-secure-store`.
2. **Biometric Authentication**:
   - The app verifies local hardware via `LocalAuthentication.hasHardwareAsync()` and enrolled prints/faces via `isEnrolledAsync()`.
   - When triggered, `LocalAuthentication.authenticateAsync()` opens the native biometric prompt.
   - Upon success, the app retrieves the stored `refresh_token` and calls `POST /api/refresh` with `{ refresh_token }`.
   - The backend validates the JWT refresh token, issues a fresh token pair, and logs the student in without requiring password entry.
3. **Session Cleardown**:
   - `clearTokens()` deletes `qrblms_refresh_token`, `qrblms_student_id`, and `qrblms_biometric_student_id` from `SecureStore`.

### 3.3 QR Code Implementation: Mobile Emitting vs. Web Scanning

| Attribute | Mobile Application Implementation | Web Portal Implementation (`website/`) |
| :--- | :--- | :--- |
| **Primary Role** | **QR Generator / Emitter** | **QR Scanner & Decoder** |
| **Hardware Used** | Mobile Screen Display (OLED/LCD) | USB / Laptop Webcam (`cv2.VideoCapture`) |
| **Software Library** | `react-native-qrcode-svg` | OpenCV + Flask MJPEG stream (`scanning.html`) |
| **Payload 1: Gatepass** | `STUDENT:<ID>` (e.g., `STUDENT:24305141004`) | Parsed via regex `STUDENT:(.*)` |
| **Payload 2: Book Return** | `BOOK:<ID>` / Issue transaction token | Parsed via regex `BOOK:(.*)` |
| **Scanning Capability** | **None** (No camera scanning modules installed) | Real-time dual QR decoding for issue/return |

### 3.4 API Route Mapping Table

| Client Function (`api/client.ts`) | Backend Flask Route (`website/routes/api_routes.py`) | Method | Payload / Parameters | Response Status |
| :--- | :--- | :---: | :--- | :---: |
| `login()` | `/api/login` | `POST` | `{ student_id, password }` | `200 OK` / `401 Unauthorized` |
| Silent Auth | `/api/refresh` | `POST` | `{ refresh_token }` | `200 OK` / `401 Unauthorized` |
| `getDashboard()` | `/api/student/dashboard/<student_id>` | `GET` | URL param `student_id` | `200 OK` / `404 Not Found` |
| `getCatalog()` | `/api/books/catalog/<student_id>` | `GET` | URL param `student_id` (filtered by Dept/Sem) | `200 OK` |
| `getPyqs()` | `/api/pyq/<student_id>` | `GET` | URL param `student_id` (filtered by Dept/Sem) | `200 OK` |
| `getNotifications()` | `/api/student/notifications/<student_id>` | `GET` | URL param `student_id` | `200 OK` |
| `markNotificationRead()` | `/api/student/notifications/mark-read` | `POST` | `{ student_id, notification_id }` | `200 OK` |
| `markAllNotificationsRead()`| `/api/student/notifications/mark-all-read` | `POST` | `{ student_id }` | `200 OK` |
| `getHistory()` | `/api/student/history/<student_id>` | `GET` | URL param `student_id` | `200 OK` |
| `changePassword()` | `/api/change-password` | `POST` | `{ student_id, current_password, new_password }` | `200 OK` / `401` / `400` |
| `uploadAvatar()` | `/api/student/upload-avatar` | `POST` | `multipart/form-data` (`student_id`, `avatar`) | `200 OK` / `400 Bad Request` |

### 3.5 Media & File System Mechanics
- **Avatar Upload**: Multi-tier validation enforces extension whitelist (`.jpg`, `.jpeg`, `.png`, `.webp`), MIME whitelist (`image/jpeg`, `image/png`, `image/webp`), and file size limit (`<= 2MB`). The backend validates binary magic bytes (`\xff\xd8\xff`, `\x89PNG`, `RIFF...WEBP`) using Pillow.
- **PYQ Paper Viewing & Downloading**:
  - View on Android: `FileSystem.downloadAsync` writes PDF to `cacheDirectory`, obtains a content URI via `FileSystem.getContentUriAsync()`, and launches `IntentLauncher.startActivityAsync('android.intent.action.VIEW')`.
  - View on iOS / Download on all: Utilizes `Sharing.shareAsync` after saving into `FileSystem.documentDirectory`.

---

## 4. Data & State Management

### 4.1 On-Device Storage Layer (`expo-secure-store`)
The mobile application uses hardware-backed encrypted storage. No plaintext `AsyncStorage` is used for sensitive authentication tokens.

| Keystore Key | Value Description | Security Level |
| :--- | :--- | :--- |
| `qrblms_refresh_token` | Long-lived JWT token (365 days expiration) | Hardware Encrypted (AES-256) |
| `qrblms_student_id` | Currently authenticated student's unique ID | Hardware Encrypted (AES-256) |
| `qrblms_biometric_student_id`| Saved ID used to pre-fill the login input | Hardware Encrypted (AES-256) |

### 4.2 Application State Management
- **Architecture**: Lightweight React hook-based state management (`useState`, `useCallback`, `useMemo`).
- **Data Freshness (`useFocusEffect`)**: Rather than relying on global caching (e.g. Redux/Zustand), each screen uses `@react-navigation/native`'s `useFocusEffect` to automatically query the backend whenever the tab gains foreground focus.
- **Pull to Refresh**: `RefreshControl` is integrated into `Home.tsx`, `Borrowed.tsx`, and `Notifications.tsx` for immediate manual synchronization.
- **Optimistic Updates**: `Notifications.tsx` implements optimistic local state updates when clearing unread notifications, followed by asynchronous backend synchronization.

---

## 5. Current Gaps, Technical Debt & Unimplemented Features

During this comprehensive audit, several gaps, placeholder stubs, unlinked UI controls, and missing backend endpoints were cataloged:

### 5.1 Explicitly Stubbed Handlers
1. **Book Loan Renewal (`Borrowed.tsx`, Line 84)**:
   ```typescript
   const handleRenew = (bookId: string) => {
     Alert.alert('Renew Loan', `API handler for renewing book ${bookId} not implemented yet.`);
   };
   ```
   *Status*: Unimplemented placeholder. No API call is made.
2. **Fine Settlement / Payment (`Borrowed.tsx`, Line 88)**:
   ```typescript
   const handleClearFine = (bookId: string) => {
     Alert.alert('Clear Fine', `API handler for clearing fine on book ${bookId} not implemented yet.`);
   };
   ```
   *Status*: Unimplemented placeholder. No payment gateway or clearance API call is made.

### 5.2 Unlinked & Non-Functional UI Components
1. **Book Reservation Button (`Home.tsx`, Lines 272–275)**:
   ```tsx
   <GradientButton 
     label="Reserve" 
     disabled={!isAvailable}
   />
   ```
   *Issue*: The `GradientButton` accepts an `onPress` prop, but none is passed in `Home.tsx`. Clicking "Reserve" produces no action.
2. **"View all" History Link (`Borrowed.tsx`, Line 290)**:
   ```tsx
   <Pressable><Text style={s.viewAll}>View all ({history.length})</Text></Pressable>
   ```
   *Issue*: Missing `onPress` callback. Tapping "View all" does nothing.
3. **Voice Search Microphone (`Academics.tsx`, Line 173)**:
   ```tsx
   <View style={s.mic}><Ionicons name="mic-outline" size={18} color="#fff" /></View>
   ```
   *Issue*: Purely cosmetic container; no speech-to-text recognition or click handler is wired up.
4. **Gatepass Card Expansion Hint (`Home.tsx`, Line 204)**:
   - Subtext reads *"Tap to expand or scan at library terminal"*, but tapping the card body does not expand or open a modal (only the nested Student ID pill has a copy click handler).

### 5.3 Missing Backend API Endpoints
Review of `website/routes/api_routes.py` reveals that the backend does not implement:
1. `POST /api/student/renew-loan`: No endpoint exists for renewing an active book loan.
2. `POST /api/student/pay-fine`: No endpoint exists for online fine payment (currently, fines can only be collected or waived in person by the Librarian on `scanning.html`).
3. `POST /api/books/reserve`: No endpoint exists to place a hold/reservation on an inventory book.

### 5.4 Hardcoded Fallbacks & Mock Data
1. **Profile Fallback Demographics (`Profile.tsx`, Lines 111–118)**:
   - If the dashboard API payload is missing specific fields, `Profile.tsx` falls back to hardcoded strings:
     - Student ID: `'24305141004'`
     - Full Name: `'Arnab Datta'`
     - Course: `'Diploma in Engineering'`
     - Department: `'Computer Science & Technology (CST)'`
     - Semester: `'5th Semester'`
     - Email: `'student@tcea.edu.in'`
2. **Notification Initial Seed Data (`Notifications.tsx`, Lines 103–213)**:
   - `INITIAL_DATA` contains 11 static mocked notifications (`n1` through `n11`) displayed prior to receiving live records from `GET /api/student/notifications/<student_id>`.

### 5.5 Package Warnings & Deprecations
1. **`expo-notifications` Warning Suppression (`App.tsx`, Line 9)**:
   ```typescript
   LogBox.ignoreLogs(['[expo-notifications]', 'expo-notifications']);
   ```
   *Context*: Suppresses Expo 58 notification architecture warnings. Push token registration is not yet wired to a backend notification worker.
2. **Legacy FileSystem Import (`Academics.tsx`, Line 9)**:
   ```typescript
   import * as FileSystem from 'expo-file-system/legacy';
   ```
   *Context*: Uses Expo's legacy FileSystem path due to API changes in Expo SDK 58.

---

## 6. Architecture Status Matrix & Summary

| Module | Implementation State | Backend Integrated | Critical Gaps / Action Required |
| :--- | :---: | :---: | :--- |
| **Authentication (Manual)** | Complete | Yes (`/api/login`) | Fully functional with password hash detection |
| **Authentication (Biometric)**| Complete | Yes (`/api/refresh`) | Fully functional via `expo-local-authentication` |
| **Digital QR Gatepass** | Complete | Yes (`/api/student/dashboard`) | High-contrast QR emitter for physical scanner |
| **Catalog Browsing** | Complete | Yes (`/api/books/catalog`) | Contextually filtered; "Reserve" button is unlinked |
| **Loan Tracker & Due Dates** | Complete | Yes (`/api/student/dashboard`) | Accurate due calculations; "Renew" button is stubbed |
| **Overdue Fine Tracker** | Complete | Yes (`/api/student/dashboard`) | Dynamically calculates ₹5/day; "Pay" button is stubbed |
| **Book Return QR Modal** | Complete | Yes (`item.qr_code_string`) | Generates return token for librarian scan |
| **Reading Vault (History)** | Complete | Yes (`/api/student/history`) | List renders cleanly; "View all" pressable unlinked |
| **Academic PYQ Archives** | Complete | Yes (`/api/pyq`) | PDF view and download functional; mic icon cosmetic |
| **Profile & Avatar Upload** | Complete | Yes (`/student/upload-avatar`)| Client validation + Pillow magic byte check working |
| **Change Password** | Complete | Yes (`/api/change-password`) | Secure validation requiring current password verification |
| **Notifications Feed** | Complete | Yes (`/api/student/notifications`) | Category card modal functional; uses initial seed fallback |

---

*End of Report. Saved to `APP_STATE.md`.*
