# Kashur Editor

## A Digital Text Editor for the Kashmiri Language

Kashur Editor is a browser-based digital text editor designed specifically for writing, editing, and formatting content in the **Kashmiri language**, particularly using the **Perso-Arabic Nastaliq script**.

The project aims to provide a modern, user-friendly, Word-like editing environment that makes Kashmiri digital writing easier and more accessible. It supports right-to-left text editing and provides various document-processing and formatting features within a web-based application.

---

## 👥 Project Team

This project was developed as a **group project** by:

1. **Mudasir Saleem Ganie**
2. **Aaqidah Majeed**
3. **Adhfar Nabi**

All three members contributed to the development, testing, documentation, and implementation of the Kashur Editor project.

---

## 🎯 Project Objective

The main objective of Kashur Editor is to develop a dedicated digital writing environment for the Kashmiri language.

The application aims to:

- Provide a dedicated Kashmiri writing and editing platform.
- Support **Right-to-Left (RTL)** text editing.
- Support Kashmiri **Perso-Arabic/Nastaliq** script.
- Provide a familiar word-processor-style interface.
- Make Kashmiri digital content creation easier.
- Provide useful document formatting and management features.
- Improve accessibility of digital tools for Kashmiri-language users.

---

## ✨ Key Features

### 📝 Rich Text Editing

Kashur Editor provides a rich text editing environment with features such as:

- Bold, Italic and Underline
- Text alignment
- Font formatting
- Font size control
- Font and text color
- Text highlighting
- Bullets and numbering
- Paragraph formatting
- Indentation
- Undo and Redo

### 🔤 Kashmiri Language Support

The editor is designed with Kashmiri language requirements in mind and provides:

- Right-to-left text direction
- Kashmiri Nastaliq/Perso-Arabic script support
- Kashmiri-specific input methods
- Phonetic keyboard support
- Kashmiri font support
- Kashmiri character and vowel support

### 📄 Document Management

Users can create and manage documents through features such as:

- Create new documents
- Save documents
- Rename documents
- Open documents
- Delete documents
- Document history/version-related functionality
- Word and page counting

### 📑 Page Layout

The editor provides document layout functionality including:

- A4 page layout
- Page margins
- Page color
- Watermark
- Headers and footers
- Page numbering
- Print preview

### 📊 Insert Features

Users can insert different types of content, including:

- Tables
- Images
- Shapes
- Symbols
- Mathematical equations
- Charts
- Headers and footers
- Footnotes

### 📚 Kashmiri–English Dictionary

Kashur Editor includes a searchable **Kashmiri–English dictionary** containing thousands of words to assist users while writing and understanding Kashmiri content.

### 🔐 Authentication and Security

The application includes user authentication functionality such as:

- User registration
- Email verification
- OTP verification
- Login
- Password reset
- JWT-based authentication
- Protected document access

### 👨‍💻 Admin Panel

An administrative interface is included for managing and monitoring application-related information.

It provides functionality such as:

- User management
- Document monitoring
- Application statistics
- Dashboard analytics
- Reports

---

## 🏗️ Technology Stack

### Frontend

- React.js
- Vite
- JavaScript
- HTML5
- CSS
- content editable model 

### Backend

- Node.js
- Express.js
- JavaScript
- REST APIs
- JWT Authentication

### Database

- MongoDB
- Mongoose

### Development Tools

- Git
- GitHub
- Visual Studio Code
- Postman

---

## 🏛️ System Architecture

The application follows a client-server architecture.

```text
                ┌─────────────────────┐
                │       User          │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  React.js Frontend  │
                │      + Vite         │
                └──────────┬──────────┘
                           │
                     REST API Requests
                           │
                           ▼
                ┌─────────────────────┐
                │   Node.js +         │
                │   Express.js        │
                │      Backend        │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │      MongoDB        │
                │      Database       │
                └─────────────────────┘
