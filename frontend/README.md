# Cult Open Front - Asset Management Dashboard

A modern, responsive, and robust Asset Management System frontend built with **Next.js (App Router)** and **React**. This dashboard provides a comprehensive suite of tools to track, manage, and maintain physical assets, handle waitlists, and generate or scan QR codes seamlessly.

## ✨ Features

* **Secure Authentication & RBAC**: Full JWT-based authentication flow including login, registration, email verification, password resets, and Role-Based Access Control (Admin, Staff, User).
* **Asset & Unit Management**: Add, edit, bulk-import, and track asset models and their individual units.
* **QR Code Ecosystem**: 
  * Generate single or bulk QR codes for asset tracking.
  * Built-in QR scanner supporting both live camera feeds and image uploads.
  * Resilient QR parsing that handles full URLs, raw UUIDs, and encoded payloads.
* **Queue & Waitlists**: Allow users to join queues for assets currently in use.
* **Maintenance Tracking**: Log maintenance requests, track maintenance status, and manage repairs for specific asset units.
* **Bookings**: End-to-end booking management for tracking when assets are checked out and returned.
* **Analytics**: Detailed reports and heatmaps for asset utilization and system activity.

## 🚀 Tech Stack

* **Framework**: [Next.js](https://nextjs.org/) (App Router)
* **Styling**: Vanilla CSS with comprehensive CSS Variables for theming
* **Icons**: [Lucide React](https://lucide.dev/)
* **HTTP Client**: [Axios](https://axios-http.com/) (with JWT interceptors)
* **QR Code Scanning**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)
* **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

## ⚙️ Getting Started

### Prerequisites
Make sure you have Node.js (v18 or higher) installed. You will also need the backend FastAPI server running.

### Installation

1. Clone the repository and navigate to the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```

### Running the Development Server

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔗 Backend Integration
This frontend is designed to interface with a FastAPI backend. By default, API requests are proxied or directed to `http://localhost:8000/api/v1`. Ensure the backend server is running and configured with the correct CORS origins (`http://localhost:3000`) to permit requests from the frontend.
