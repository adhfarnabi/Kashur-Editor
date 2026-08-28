# Kashur Word Editor — Frontend Documentation

> Complete guide to every frontend file, component, prop, screen flow, and setup step.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Quick Start](#3-quick-start)
4. [Screen Flow Map](#4-screen-flow-map)
5. [File-by-File Reference](#5-file-by-file-reference)
   - [App.jsx](#appjsx--the-router)
   - [LandingPage.jsx](#landingpagejsx--home-page)
   - [auth-frontend/AuthContext.jsx](#auth-frontendasuthcontextjsx--global-auth-state)
   - [auth-frontend/AuthPages.jsx](#auth-frontendauthpagesjsx--all-auth-screens)
   - [auth-frontend/useApi.js](#auth-frontenduseapijs--authenticated-fetch-hook)
   - [Dashboard.jsx](#dashboardjsx--document-list)
   - [KashurEditor.jsx](#Kashureditorjsx--word-editor)
   - [PublicView.jsx](#publicviewjsx--shared-document-viewer)
6. [Component Props Reference](#6-component-props-reference)
7. [Authentication Flow](#7-authentication-flow)
8. [State Management](#8-state-management)
9. [API Calls — Where Each Is Made](#9-api-calls--where-each-is-made)
10. [Styling System](#10-styling-system)
11. [Environment Configuration](#11-environment-configuration)
12. [Common Errors & Fixes](#12-common-errors--fixes)
13. [Adding New Features](#13-adding-new-features)

---

## 1. Project Overview

The Kashur Word Editor frontend is a **React single-page application** with no routing library.
Navigation between screens is done with a single `screen` state variable in `App.jsx`.

**Tech stack:**
- React 18 (hooks only — no class components)
- Pure inline styles (no CSS files, no Tailwind, no CSS modules)
- Native `fetch` API for all HTTP calls
- `localStorage` for JWT token persistence
- No Redux, no React Query, no external UI library

**What the app does:**
- Landing page (home, features, contact form)
- User registration with email OTP verification
- Login with JWT authentication
- Document dashboard (list, create, delete, share)
- Full Kashur word processor (A4 pages, rich formatting, auto-save)
- Public document sharing (no login required to view shared links)
- PDF export via browser print, DOCX via backend, TXT client-side

---

## 2. Folder Structure

```
src/
│
├── App.jsx                          ← ROOT: routing, auth guard, screen switcher
├── LandingPage.jsx                  ← Home page (navbar, hero, features, contact, footer)
├── Dashboard.jsx                    ← Document list with share/export/delete
├── KashurEditor.jsx                   ← Full word editor (A4 pages, ribbon, formatting)
├── PublicView.jsx                   ← Read-only shared document viewer (no login)
│
└── auth-frontend/
    ├── AuthContext.jsx              ← Global user/token state (React Context)
    ├── AuthPages.jsx                ← Login, Signup, OTP, ForgotPassword, ResetPassword
    └── useApi.js                    ← Authenticated fetch wrapper hook
```

**Every file is self-contained** — styles are inline, no external CSS dependencies.

---

## 3. Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend running on `http://localhost:3001` (see backend README)

### Install and run

```bash
# Create a new Vite React project
npm create vite@latest Kashur-editor-frontend -- --template react
cd Kashur-editor-frontend
npm install

# Copy these files into src/
# App.jsx, LandingPage.jsx, Dashboard.jsx, KashurEditor.jsx, PublicView.jsx
# auth-frontend/AuthContext.jsx
# auth-frontend/AuthPages.jsx
# auth-frontend/useApi.js

# Replace src/App.jsx and src/main.jsx
npm run dev
```

### main.jsx — no changes needed

```jsx
import React    from "react"
import ReactDOM from "react-dom/client"
import App      from "./App"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### index.html — add Kashur font (recommended)

```html
<head>
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Kashur&display=swap"
    rel="stylesheet"
  />
</head>
```

---

## 4. Screen Flow Map

```
Browser opens app
        │
        ▼
 Is URL /view/:token?
   YES → PublicView (no login, anyone can view)
   NO  ▼
        │
 AuthContext checks localStorage for token
   Token found → calls GET /api/auth/me
     Valid    → user set → go to Dashboard
     Invalid  → clear token → go to "home"
   No token   → go to "home"
        │
        ▼
   screen = "home"
   LandingPage
     [Log In]   → screen = "login"
     [Sign Up]  → screen = "signup"
        │
   screen = "login"
   LoginPage
     Success              → user set by AuthContext → Dashboard
     No account found     → screen = "signup"
     Email not verified   → screen = "verify"
     Forgot password link → screen = "forgot"
        │
   screen = "signup"
   SignupPage
     Success (OTP sent)   → screen = "verify"
     Already have account → screen = "login"
        │
   screen = "verify"
   OTPVerifyPage
     OTP correct          → user set by AuthContext → Dashboard
     Back to login        → screen = "login"
        │
   screen = "forgot"
   ForgotPasswordPage
     Email found, OTP sent → screen = "reset"
     Back to login         → screen = "login"
        │
   screen = "reset"
   ResetPasswordPage
     Password reset, logged in → user set → Dashboard
     Back to login             → screen = "login"
        │
   user is set → Dashboard
     Open document → screen = "editor" (with docId)
     New document  → screen = "editor" (docId = null)
     Logout        → user cleared → screen = "home"
        │
   screen = "editor"
   KashurEditor
     ← Dashboard → screen = "dashboard"
```

---

## 5. File-by-File Reference

---

### App.jsx — The Router

**What it does:**
- The single routing hub for the entire app
- Holds `screen` state — one string that controls what the user sees
- Wraps everything in `<AuthProvider>` so all children can access user/token
- Checks the URL for `/view/:token` before anything else
- If user is already logged in (token in localStorage), skips auth screens entirely

**Key state:**
```js
const [screen,      setScreen]      = useState("home")   // current screen
const [verifyState, setVerifyState] = useState(null)      // { email, purpose } for OTP
const [resetEmail,  setResetEmail]  = useState("")        // email for password reset
const [editDocId,   setEditDocId]   = useState(null)      // which doc to open in editor
```

**Screen values and what renders:**
| screen value | Component rendered |
|---|---|
| `"home"` | `LandingPage` |
| `"login"` | `LoginPage` |
| `"signup"` | `SignupPage` |
| `"verify"` | `OTPVerifyPage` |
| `"forgot"` | `ForgotPasswordPage` |
| `"reset"` | `ResetPasswordPage` |
| `"dashboard"` or user set | `Dashboard` |
| `"editor"` and user set | `KashurEditor` |

**When user logs in:** AuthContext sets `user` → React re-renders InnerApp → `if (user)` branch runs → Dashboard shows automatically. No manual screen change needed.

---

### LandingPage.jsx — Home Page

**What it does:**
A full marketing landing page with 7 sections. Completely self-contained — no auth, no API calls except the contact form.

**Sections:**

| Section | Component | Description |
|---|---|---|
| Navigation | `Navbar` | Fixed top bar. Transparent over hero, white when scrolled. Logo, nav links, Login + Sign Up buttons. Hamburger menu on mobile |
| Hero | `Hero` | Full-viewport gradient background. Headline in English + Kashur. Two CTA buttons. Animated editor mockup (fake UI, no real functionality) |
| Features | `Features` | 6 feature cards: A4 pages, rich formatting, auto-save, export, share links, security |
| How It Works | `HowItWorks` | 3-step visual guide: Create account → Write → Export & Share |
| Download/Try | `Download` | Two buttons: "Use in Browser" (→ signup) and "Desktop App Coming Soon" (disabled). Stats row |
| Contact | `Contact` | Split layout: left explains contact types, right is a form with name/email/type/message. Validates client-side. Posts to `/api/contact` (add this route to backend, or it just console.logs) |
| Footer | `Footer` | 4-column grid: brand + social, product links, account links, support links. Copyright bar |

**Smooth scroll:** Every nav link and footer link calls `scrollTo(sectionId)` which uses `element.scrollIntoView({ behavior: "smooth" })`.

**Back to top button:** Appears after scrolling 400px down. Fixed bottom-right corner.

**Props:**
```jsx
<LandingPage
  onLogin={()  => setScreen("login")}
  onSignup={() => setScreen("signup")}
/>
```

---

### auth-frontend/AuthContext.jsx — Global Auth State

**What it does:**
React Context that stores the logged-in user and JWT token. Wraps the whole app via `<AuthProvider>`. Any component can call `useAuth()` to access user, token, login, logout.

**What it provides:**
```js
const { user, token, isLoading, login, logout, updateUser, authHeader } = useAuth()
```

| Value | Type | Description |
|---|---|---|
| `user` | Object or null | `{ id, name, email, phone, emailVerified, createdAt }` |
| `token` | String or null | The JWT string |
| `isLoading` | Boolean | true while checking localStorage on startup |
| `login(user, token)` | Function | Saves token to localStorage, sets user + token state |
| `logout()` | Function | Clears localStorage, sets user + token to null, calls `/api/auth/logout` |
| `updateUser(partial)` | Function | Merge-updates the user object (for profile edits) |
| `authHeader` | Object | `{ Authorization: "Bearer <token>" }` or `{}` — ready to spread into fetch headers |

**On startup (useEffect):**
1. Reads `Kashur_editor_token` from `localStorage`
2. Calls `GET /api/auth/me` with that token
3. If response is 200 → sets user and token
4. If response is 401 → clears token from storage
5. Sets `isLoading = false` either way

App.jsx shows a loading spinner while `isLoading === true`.

**Token storage key:** `"Kashur_editor_token"` (defined as constant at top of file — change it here if needed)

---

### auth-frontend/AuthPages.jsx — All Auth Screens

Five exported components, all in one file.

---

#### `SignupPage`

**Props:** `onGoToLogin()`, `onNeedVerify({ email, purpose })`

**What it does:**
- Form: Name, Email, Phone (optional), Password, Confirm Password
- Client-side validation before any API call:
  - Name ≥ 2 chars
  - Valid email format
  - Password ≥ 8 chars, must have uppercase, must have number
  - Passwords match
- Password strength bar (5-level: Weak → Very Strong)
- Calls `POST /api/auth/signup`
- On success → calls `onNeedVerify({ email, purpose: "verify" })` → App shows OTP screen

**Password strength scoring:**
```
+1 → length ≥ 8
+1 → length ≥ 12
+1 → has uppercase letter
+1 → has number
+1 → has special character
```
Score 0=none, 1=Weak (red), 2=Fair (orange), 3=Good (yellow), 4=Strong (green), 5=Very Strong (dark green)

---

#### `LoginPage`

**Props:** `onGoToSignup()`, `onForgotPassword()`, `onNeedVerify(state)`, `onSuccess()`

**What it does:**
- Form: Email, Password
- Calls `POST /api/auth/login`
- Handles 4 server responses:
  - `NOT_FOUND` → shows info alert, calls `onGoToSignup()`
  - `EMAIL_NOT_VERIFIED` → calls `onNeedVerify({ email, purpose:"verify" })`
  - `WRONG_CREDENTIALS` → shows inline error message
  - 200 success → calls `login(user, token)` in AuthContext → App re-renders to Dashboard

---

#### `OTPVerifyPage`

**Props:** `email`, `purpose`, `onSuccess()`, `onGoToLogin()`

**What it does:**
- 6 individual input boxes, one per digit
- Auto-focuses next box when a digit is entered
- Backspace goes to previous box
- Paste support (paste a 6-digit code and all boxes fill)
- 60-second countdown before "Resend OTP" button activates
- Calls `POST /api/auth/verify-otp` with `{ email, otp }`
- On success → calls `login(user, token)` → AuthContext updates → Dashboard shows
- Handles `OTP_WRONG` (shows attempts left), `OTP_EXPIRED`, `OTP_LOCKED`
- "Resend OTP" button calls `POST /api/auth/resend-otp`

**`purpose` prop values:**
- `"verify"` → for email verification after signup
- `"reset"` → not used directly (ResetPasswordPage handles its own OTP field)

---

#### `ForgotPasswordPage`

**Props:** `onGoToLogin()`, `onOtpSent({ email })`

**What it does:**
- Single email input
- Calls `POST /api/auth/forgot-password`
- On success → calls `onOtpSent({ email })` → App shows ResetPasswordPage
- Handles `NOT_FOUND` with info alert suggesting signup

---

#### `ResetPasswordPage`

**Props:** `email`, `onSuccess()`, `onGoToLogin()`

**What it does:**
- Three fields: OTP code, New Password, Confirm New Password
- Password strength bar (same as signup)
- Calls `POST /api/auth/reset-password` with `{ email, otp, newPassword, confirmPassword }`
- On success → calls `login(user, token)` → Dashboard shows (user is immediately logged in)
- Resend OTP button (60s countdown, calls `/api/auth/resend-otp` with purpose:`"reset"`)

---

#### Shared UI components inside AuthPages.jsx

These are internal helpers used by all auth pages:

| Component | What it renders |
|---|---|
| `AuthCard` | White card with blue header (logo + title + subtitle) |
| `Field` | Labeled input with error display and password show/hide toggle |
| `SubmitBtn` | Full-width submit button with loading state |
| `Alert` | Colored alert box (error/success/info) |
| `Divider` | Horizontal rule with center text |
| `LinkBtn` | Unstyled text button for navigation links |

---

### auth-frontend/useApi.js — Authenticated Fetch Hook

**What it does:**
A custom hook that returns an API object (`get`, `post`, `put`, `patch`, `delete`). Every call automatically includes the JWT token from AuthContext in the Authorization header. If the server returns 401 with `TOKEN_EXPIRED` or `TOKEN_INVALID`, it auto-calls `logout()`.

**Usage:**
```js
const api = useApi()

// GET
const docs = await api.get("/documents")

// POST
const doc = await api.post("/documents", { title: "My Doc", html: "" })

// PUT
await api.put(`/documents/${id}`, { title: "New Title" })

// PATCH
await api.patch(`/documents/${id}/share`, { isPublic: true })

// DELETE
await api.delete(`/documents/${id}`)
```

**Note:** Dashboard.jsx uses its own `apiFetch` helper instead of this hook (both work the same way — token from `useAuth()`). KashurEditor.jsx uses its own `authFetch` function defined inside the component. `useApi.js` is available if you want a cleaner pattern for new components.

---

### Dashboard.jsx — Document List

**What it does:**
Shows all documents belonging to the logged-in user. Documents from other users are never returned by the backend (filtered by `userId`).

**Key features:**
- Grid view and list view toggle
- Search by title (client-side filter)
- Sort by date / title / word count
- Create new document (saves to backend first, then opens editor)
- Open & Edit (opens KashurEditor with that docId)
- Delete with confirmation modal (soft delete)
- Export DOCX / TXT (authenticated fetch → blob → download)
- Export PDF (Blob URL → new tab → print)
- Share modal (toggle public/private, copy link, WhatsApp/Telegram/Email)
- `🌐 Public` badge on shared documents

**Props:**
```jsx
<Dashboard
  onOpenEditor={id => { setEditDocId(id); setScreen("editor") }}
  onNewDocument={() => { setEditDocId(null); setScreen("editor") }}
  onLogout={() => { logout(); setScreen("home") }}
/>
```

**Internal components:**
| Component | Purpose |
|---|---|
| `ExportMenu` | Dropdown: PDF / DOCX / TXT. Uses `position:fixed` with `getBoundingClientRect()` so it never clips |
| `ShareModal` | Visibility toggle (Public/Private), link display, copy + social share buttons |
| `DocCard` | Grid view card for one document |
| `DocRow` | List view row for one document |
| `AppModal` | Custom modal replacing alert/confirm/prompt |
| `Toast` | Bottom-right notification (auto-hides after 3s) |
| `Spinner` | Centered loading indicator |

**Auth:** Reads `token` from `useAuth()`. Every API call sends `Authorization: Bearer <token>`.

---

### KashurEditor.jsx — Word Editor

**What it does:**
A full MS Word-like editor built with `contentEditable` divs and `document.execCommand`. No external editor libraries.

**Props:**
```jsx
<KashurEditor
  docId="65a1b2c3..."   // MongoDB _id to load. null = new blank document
  onBackToDashboard={() => { setEditDocId(null); setScreen("dashboard") }}
/>
```

**Architecture:**
- Multiple `contentEditable` divs — one per A4 page
- Spill engine (`spillCheck`) runs on every keystroke — moves overflow content to next page, pulls content back when deleting
- `pagesRef` array holds refs to all page divs
- `activePgRef` tracks which page is currently focused
- All refs (`docIdRef`, `docTitleRef`) keep latest values without stale closures in autosave

**Ribbon tabs:**
| Tab | Tools |
|---|---|
| Home | Undo/Redo, Cut/Copy, Font family (6 Kashur fonts), Font size (8–72), Bold/Italic/Underline/Strike/Sub/Super, Text color, Highlight, Alignment (Right/Center/Left/Justify), Lists (9 types), Indent, Paragraph style, Find & Replace, Page Break |
| Insert | Table, Image (URL or file), Link, Date (Kashur locale), Horizontal rule, Kashur symbols |
| Layout | Orientation (portrait/landscape), Line spacing, Margins, RTL/LTR direction |
| Review | Word count, Undo/Redo, Select All, Clear All, Document title, Save button |
| View | Zoom +/−/reset, presets 50–200% |

**Key internal functions:**

| Function | What it does |
|---|---|
| `saveNow(silent?)` | POST (new) or PUT (existing) to backend. Uses `docIdRef` not `docId` state (avoids stale closure creating duplicate docs) |
| `exportDoc(format)` | `"pdf"` → Blob URL; `"txt"` → client blob; `"docx"` → authenticated fetch → blob download |
| `handleRename()` | Shows custom modal, checks title uniqueness against backend, saves |
| `handleBackToDashboard()` | Prompts to save if dirty, then calls `onBackToDashboard()` |
| `doPrintPopup()` | Builds HTML string → Blob URL → opens in new tab with Print/PDF bar |
| `spillCheck()` | Debounced 100ms — moves overflow nodes between page divs |
| `insertLink()` | Custom modal prompt (not `window.prompt`) |

**List types dropdown:** Uses React `createPortal` to render at `document.body` level — avoids clipping by ribbon overflow. Uses `getBoundingClientRect()` for position.

**Auto-save:** `setInterval` every 30 seconds. Only fires if `dirtyRef.current === true` (document has unsaved changes).

**Font system:** Font values stored without extra quotes (e.g. `"Noto Nastaliq Kashur, serif"`) and applied directly as `style={{ fontFamily: fontFamily }}`.

---

### PublicView.jsx — Shared Document Viewer

**What it does:**
Read-only viewer for publicly shared documents. Accessible via URL `/view/:shareToken`. No login required.

**Props:**
```jsx
<PublicView token="a3f8b2c1d4e5..." />  // 64-char hex shareToken
```

**How it works:**
1. Fetches `GET /api/share/:token` — public endpoint, no JWT needed
2. If document is public → renders it
3. If token invalid or document made private → shows error screen

**Sections:**
- **Top bar** — sticky, shows title, "View Only" badge, Print/Save PDF button
- **Share bar** — copy link, WhatsApp, Telegram, Email buttons
- **A4 document card** — renders HTML with RTL direction and Kashur font
- **Bottom share bar** — repeated for convenience
- **Footer** — "Shared via اردو ورڈ ایڈیٹر"

**Loading state:** Animated skeleton placeholders while fetching.

**Error state:** Lock icon + "Document Not Available" message when token is invalid or revoked.

---

## 6. Component Props Reference

Quick lookup for every component's props:

```
App.jsx
  └─ InnerApp                    (no props — reads from AuthContext)

LandingPage
  ├─ onLogin:  () => void
  └─ onSignup: () => void

Dashboard
  ├─ onOpenEditor:  (docId: string) => void
  ├─ onNewDocument: () => void
  └─ onLogout:      () => void

KashurEditor
  ├─ docId:              string | null
  └─ onBackToDashboard:  () => void

PublicView
  └─ token: string  (64-char hex shareToken)

SignupPage
  ├─ onGoToLogin:  () => void
  └─ onNeedVerify: ({ email, purpose }) => void

LoginPage
  ├─ onGoToSignup:     () => void
  ├─ onForgotPassword: () => void
  ├─ onNeedVerify:     ({ email, purpose }) => void
  └─ onSuccess:        () => void  (optional — AuthContext handles re-render)

OTPVerifyPage
  ├─ email:       string
  ├─ purpose:     "verify" | "reset"
  ├─ onSuccess:   () => void
  └─ onGoToLogin: () => void

ForgotPasswordPage
  ├─ onGoToLogin: () => void
  └─ onOtpSent:   ({ email }) => void

ResetPasswordPage
  ├─ email:       string
  ├─ onSuccess:   () => void
  └─ onGoToLogin: () => void
```

---

## 7. Authentication Flow

### How login works (step by step)

```
1. User submits LoginPage form
2. POST /api/auth/login → { email, password }
3. Server returns { token, user }
4. LoginPage calls login(user, token) from useAuth()
5. AuthContext:
     localStorage.setItem("Kashur_editor_token", token)
     setToken(token)
     setUser(user)
6. React re-renders App.jsx → InnerApp
7. `if (user)` branch → Dashboard renders
```

### How token persists across page refresh

```
1. Page loads → AuthProvider mounts
2. useEffect reads localStorage.getItem("Kashur_editor_token")
3. If found → calls GET /api/auth/me with that token
4. Server verifies JWT → returns { user }
5. setUser(user), setToken(stored)
6. isLoading = false → App renders Dashboard
```

### How protected API calls work

```
Every fetch in Dashboard and KashurEditor:
  headers: { Authorization: "Bearer <token from useAuth()>" }

Server middleware (protect):
  1. Read Authorization header
  2. jwt.verify(token, JWT_SECRET)
  3. User.findById(decoded.id)
  4. Attach to req.user
  5. next()

Every document query:
  { userId: req.user._id, deletedAt: null }
  → user only sees their own documents
```

### How logout works

```
1. User clicks Logout in Dashboard
2. Dashboard calls onLogout() prop
3. App.jsx calls logout() from useAuth(), then setScreen("home")
4. AuthContext:
     POST /api/auth/logout (fire-and-forget)
     localStorage.removeItem("Kashur_editor_token")
     setToken(null)
     setUser(null)
5. React re-renders → user is null → LandingPage shows
```

---

## 8. State Management

There is **no global state library**. State is managed with:

### AuthContext (global — available everywhere)
```js
user, token, isLoading, login(), logout(), updateUser(), authHeader
```

### App.jsx (semi-global — passed as props)
```js
screen      // which screen is visible
verifyState // email + purpose for OTP screen
resetEmail  // email for reset password screen
editDocId   // which document to open in editor
```

### Local component state
Each page manages its own form values, loading states, errors, and modals with `useState`.

### Refs (for avoiding stale closures)
KashurEditor uses refs alongside state for values needed in callbacks:
```js
docIdRef.current    // always has latest docId
docTitleRef.current // always has latest title
dirtyRef.current    // true if unsaved changes exist
```

---

## 9. API Calls — Where Each Is Made

| Endpoint | File | When |
|---|---|---|
| `GET /api/auth/me` | AuthContext.jsx | App startup — validate stored token |
| `POST /api/auth/logout` | AuthContext.jsx | On logout() call |
| `POST /api/auth/signup` | AuthPages.jsx (SignupPage) | Signup form submit |
| `POST /api/auth/verify-otp` | AuthPages.jsx (OTPVerifyPage) | OTP form submit |
| `POST /api/auth/resend-otp` | AuthPages.jsx (OTPVerifyPage, ResetPasswordPage) | Resend OTP button |
| `POST /api/auth/login` | AuthPages.jsx (LoginPage) | Login form submit |
| `POST /api/auth/forgot-password` | AuthPages.jsx (ForgotPasswordPage) | Forgot form submit |
| `POST /api/auth/reset-password` | AuthPages.jsx (ResetPasswordPage) | Reset form submit |
| `GET /api/documents` | Dashboard.jsx | On mount, on refresh |
| `POST /api/documents` | Dashboard.jsx | "New Document" button |
| `DELETE /api/documents/:id` | Dashboard.jsx | Delete button → confirm |
| `GET /api/documents/:id` | Dashboard.jsx, KashurEditor.jsx | PDF export, open doc |
| `PATCH /api/documents/:id/share` | Dashboard.jsx (ShareModal) | Toggle Public/Private |
| `GET /api/documents/:id/export/docx` | Dashboard.jsx, KashurEditor.jsx | Export DOCX button |
| `GET /api/documents/:id/export/txt` | Dashboard.jsx, KashurEditor.jsx | Export TXT button |
| `GET /api/documents` | KashurEditor.jsx (OpenDialog) | File → Open |
| `GET /api/documents/:id` | KashurEditor.jsx | Load doc on mount, File → Open |
| `POST /api/documents` | KashurEditor.jsx (saveNow) | First save of new doc |
| `PUT /api/documents/:id` | KashurEditor.jsx (saveNow) | Ctrl+S, auto-save |
| `GET /api/share/:token` | PublicView.jsx | On mount — load shared doc |
| `POST /api/contact` | LandingPage.jsx (Contact) | Contact form submit |

---

## 10. Styling System

All styles are **inline React style objects**. No CSS files, no Tailwind, no CSS modules.

### Color palette (each file defines its own constants)

```js
// Common across all files:
const BLUE      = "#2b579a"   // primary brand color (Word blue)
const BLUE_DARK = "#1e3f6f"   // darker blue for gradients
const BLUE_LIGHT= "#e8f0fa"   // light blue backgrounds
const WHITE     = "#ffffff"
const GRAY_800  = "#1f2937"   // headings / dark text
const GRAY_600  = "#4b5563"   // body text
const GRAY_400  = "#9ca3af"   // placeholder / secondary
const BORDER    = "#e2e8f0"   // borders and dividers
const GREEN     = "#1a7f4e"   // success states
const RED       = "#c0392b"   // errors / danger
```

### Responsive design

Responsive breakpoints are handled with inline `<style>` tags inside components:
```jsx
<style>{`
  @media (max-width: 768px) {
    .desktop-nav { display: none !important; }
    .hamburger   { display: block !important; }
  }
`}</style>
```

### Hover effects

Hover states are managed with local `useState`:
```jsx
const [hov, setHov] = useState(false)
<button
  onMouseEnter={() => setHov(true)}
  onMouseLeave={() => setHov(false)}
  style={{ background: hov ? BLUE_DARK : BLUE }}
/>
```

---

## 11. Environment Configuration

### Only one value to change: `API_BASE`

Every file that makes API calls has this constant at the top:
```js
const API_BASE = "http://localhost:3001/api"
```

**For production**, change this in every file to your deployed backend URL:
```js
const API_BASE = "https://api.yourdomain.com/api"
```

Files that contain `API_BASE`:
- `auth-frontend/AuthContext.jsx`
- `auth-frontend/AuthPages.jsx`
- `auth-frontend/useApi.js`
- `Dashboard.jsx`
- `KashurEditor.jsx`
- `PublicView.jsx`
- `LandingPage.jsx` (for contact form)

**Tip for production:** Create a single `src/config.js` file:
```js
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"
```
Then import it everywhere instead of hardcoding.

### Vite environment variables

Create `.env.local` in the project root:
```
VITE_API_BASE=http://localhost:3001/api
```

---

## 12. Common Errors & Fixes

### ❌ "useAuth must be used inside AuthProvider"
**Cause:** Component using `useAuth()` is not wrapped in `<AuthProvider>`.
**Fix:** Make sure `<AuthProvider>` wraps everything in `App.jsx`. It's the outermost wrapper.

### ❌ Dashboard shows blank / 401 error on every request
**Cause:** Token missing or expired.
**Fix:** Log out and log back in. Check `localStorage.getItem("Kashur_editor_token")` in browser DevTools → Application → Local Storage.

### ❌ OTP screen auto-focus not working
**Cause:** Browser security — auto-focus only works when triggered by a user gesture.
**Fix:** Click anywhere on the OTP page first. The first box will focus.

### ❌ "Document not found" in editor when opening a document
**Cause:** The docId passed to KashurEditor doesn't belong to the logged-in user (userId mismatch).
**Fix:** Make sure `onOpenEditor(doc.id)` is called with the correct ID from the dashboard list.

### ❌ Print popup / PDF export opens blank page
**Cause:** Browser blocking popup or Blob URL.
**Fix:** Allow popups for localhost in browser settings. The Blob URL approach should work even with popups blocked — make sure you're on the latest version of `KashurEditor.jsx`.

### ❌ DOCX download shows error or 501
**Cause:** The `docx` npm package not installed on the backend.
**Fix:**
```bash
cd Kashur-editor-backend
npm install docx
node server.js   # restart required
```

### ❌ Share link shows "Document Not Available"
**Cause:** Document was made private (token revoked) OR the token in the URL is wrong.
**Fix:** Go to Dashboard → click 🔗 Share → toggle back to Public → copy the new link (the token changes every time you toggle).

### ❌ Contact form always shows error
**Cause:** Backend has no `/api/contact` endpoint (it's not implemented).
**Fix:** This is expected — the form falls back to `console.log`. Add a `POST /api/contact` route to the backend to actually receive submissions (use nodemailer to email yourself).

### ❌ Kashur font not loading
**Cause:** Google Fonts CDN link missing from `index.html`.
**Fix:** Add to `<head>` in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Kashur&display=swap" rel="stylesheet">
```

---

## 13. Adding New Features

### Add a new screen (e.g. Profile page)

1. Create `ProfilePage.jsx` in `src/`
2. In `App.jsx` → add `"profile"` to the screen switch:
   ```jsx
   if (screen === "profile") {
     return <ProfilePage onBack={() => setScreen("dashboard")} />
   }
   ```
3. In `Dashboard.jsx` → add a Profile button that calls `onOpenProfile()` prop
4. Pass `onOpenProfile={() => setScreen("profile")}` from App.jsx to Dashboard

### Add a new API call in a component

```js
// Inside a component that needs auth:
const { token } = useAuth()

async function myApiCall() {
  const res = await fetch(`${API_BASE}/my-endpoint`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify({ myData: "value" }),
  })
  const data = await res.json()
  // use data
}
```

Or use the `useApi` hook for cleaner code:
```js
const api  = useApi()
const data = await api.post("/my-endpoint", { myData: "value" })
```

### Add a new section to LandingPage

1. Create a new component function inside `LandingPage.jsx` (e.g. `Pricing`)
2. Give the wrapping `<section>` an `id` attribute: `<section id="pricing" ...>`
3. Add it to the `MAIN COMPONENT` return between existing sections
4. Add `{ label: "Pricing", id: "pricing" }` to the `navLinks` array in `Navbar`
5. Add a footer link in the `Footer` component's product links column