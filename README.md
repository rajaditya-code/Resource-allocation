# Cult Open - Smart Asset Management Platform

## Project Overview

Welcome to the Smart Asset Management Platform! This project is designed to make tracking, booking, and maintaining physical resources as smooth as possible. Whether you are managing cameras, laptops, or specialized equipment, this platform handles the complete lifecycle of your assets.

We've built this application with two main components: a powerful **Backend API** and a sleek **Frontend Dashboard**. The goal is to provide administrators with full control over their inventory while offering users a frictionless experience to browse, book, and return items.

---

## Technology Stack

### Backend
* **Framework:** FastAPI (Python)
* **Database:** PostgreSQL (hosted on Supabase)
* **ORM & Migrations:** SQLAlchemy + Alembic
* **Storage:** Supabase Storage (for images and QR codes)
* **Authentication:** JWT Tokens + Argon2 Hashing
* **Data Validation:** Pydantic V2

### Frontend
* **Framework:** Next.js & React
* **Styling:** CSS & Component Libraries
* **HTTP Client:** Axios

---

## Feature List

### ⭐ Star Features

These are the standout capabilities that go beyond the baseline requirements:

| Feature | Description |
|---|---|
| ⭐ **Conflict Engine** | A date-range-aware booking engine that mathematically guarantees zero double-bookings — no simple quantity counter. |
| ⭐ **Fair Waitlist Queue** | Isolated reservation windows (4 hours) given to the next user in line on return, preventing race conditions and queue abuse. |
| ⭐ **Reliability Scoring** | Gamified accountability system — every user starts at 100. Late returns and damages incur automatic deductions; scores below 50 block high-value bookings. |
| ⭐ **QR Code Asset Tracking** | Every physical unit gets a unique QR code. Scanning it instantly reveals its current holder, condition, and maintenance history — no admin login needed. |
| ⭐ **Asset Model vs. Unit Separation** | Users book by type ("a camera"), but admins track individual physical units (Camera #12, #14) — enabling precise lifecycle and damage accountability. |
| ⭐ **Demand Forecasting (ML)** | Historical ride data is analyzed to predict high-demand periods and usage hotspots using machine learning techniques. |

---

### Core Features

#### The Backend (The Brain)
- **Smart Booking Engine:** Prevents double-bookings. If you request 5 cameras on Tuesday, it ensures we actually have 5 cameras available on Tuesday.
- **Fair Waitlist Queue:** If an asset is out of stock, users can join a waitlist. When the item is returned, the next person in line gets an exclusive 4-hour window to book it.
- **Reliability Scoring:** Users are held accountable. Everyone starts with a reliability score of 100. Late returns, damages, or missing a queue window will drop their score. Returning items on time bumps it back up.
- **QR Codes:** Every physical unit gets a unique QR code. Scanning it instantly reveals its condition, who has it, and its maintenance history.
- **Data & Analytics:** Generates insights on peak usage, most popular assets, and even predicts future demand using machine learning.

#### The Frontend (The Face)
- **Admin Dashboard:** Admins can approve bookings, assign specific physical units to users, review return photos for damage, and manage the waitlist.
- **Asset Catalog:** Users can browse the inventory visually, check availability calendars, and request bookings.
- **Built-in QR Scanner:** A built-in QR scanner lets anyone scan an asset using their phone camera to instantly pull up its details without needing third-party apps.

---

## Demo Credentials

Want to jump in and see how it works? You can use these test accounts:

**Admin Account**
- **Email:** `admin@test.in`
- **Password:** `Admin@1234`
*(Use this to approve bookings, add inventory, and manage users)*

**User Account**
- **Email:** `user@test.in`
- **Password:** `User@1234`
*(Use this to browse the catalog, request bookings, and join waitlists)*

---

## Setup Instructions

If you want to run this project on your own machine, follow these steps:

### 1. Backend Setup
Navigate to the backend directory (`Cult Open`) and set up your Python environment:
```bash
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create a `.env` file based on `.env.example` and fill in your Supabase and Mail credentials. Then run the database migrations to set up your tables:
```bash
alembic upgrade head
```

### 2. Frontend Setup
Open a new terminal, navigate to the frontend directory (`Cult Open Front/app`), and install the dependencies:
```bash
npm install
```

---

## Running the Application

### 1. Start the Backend
From the backend directory with your virtual environment activated, start the API server:
```bash
uvicorn app.main:app --reload
```
You can view the interactive API documentation at `http://localhost:8000/docs`.

### 2. Start the Frontend
From the frontend directory, start the development server:
```bash
npm run dev
```
The application will be running at `http://localhost:3000`. Open this in your browser to start using the platform!