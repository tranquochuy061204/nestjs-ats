# JobFinder Pro Max - NestJS Applicant Tracking System (ATS)

[![Demo](https://img.shields.io/badge/Live_Demo-jobfinder--pro--max.vercel.app-blue?style=for-the-badge)](https://jobfinder-pro-max.vercel.app/)
[![API Docs](https://img.shields.io/badge/API_Docs-Swagger-green?style=for-the-badge)](https://nexthire-f8n4.onrender.com/api/docs)

A comprehensive, RESTful backend for an Applicant Tracking System (ATS) built with modern web technologies. This system connects candidates and employers, leveraging AI to streamline the recruitment process.

## 🚀 Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT (JSON Web Tokens) & Passport
- **Real-time**: WebSockets (Socket.IO)
- **AI Integration**: Google Gemini AI (for resume parsing and scoring)
- **Storage**: Supabase
- **Payments**: VNPay Integration
- **Containerization**: Docker & Docker Compose
- **Documentation**: Swagger OpenAPI

## ✨ Core Features

- **AI-Powered Resume Parsing**: Automatically extracts data from uploaded resumes into structured user profiles using Google Gemini AI.
- **Smart Candidate Matching**: Calculates compatibility scores between CVs and job descriptions, ranking applicants based on skill overlap, experience, and salary expectations.
- **Role-Based Access Control (RBAC)**: Distinct portals and permissions for Candidates, Employers, and Admins.
- **Real-time Notifications**: Instant updates on application status and system events via WebSockets.
- **Monetization System**: Built-in subscription plans, credit tracking, and integrated VNPay payment gateways for employers.
- **Robust Application Management**: Complete lifecycle tracking of job applications.

## 🏗️ Project Modules

The application is structured into domain-specific modules:

- **Auth**: Authentication and authorization logic.
- **Users**: Core user management.
- **Candidates & Employers**: Specialized logic and profile management for different user roles.
- **Companies**: Company profile and branding management.
- **Jobs**: Job posting creation, updating, and search functionality.
- **Applications**: Candidate application submission and tracking.
- **Screening**: AI-driven CV parsing and job compatibility scoring.
- **Subscriptions & Credits**: Subscription packages, quotas, and credit consumption tracking.
- **Payments**: VNPay integration and transaction handling.
- **Notifications**: Real-time Socket.IO event broadcasting.
- **Storage**: File uploads (CVs, avatars) via Supabase.
- **Mail**: Email notifications and templating.

## 🗄️ Main Entities

The database schema revolves around these primary entities:

- **User**: The base entity representing Candidates, Employers, and Admins.
- **Candidate Profile / Employer Profile**: Specialized data representing the user roles.
- **Company**: Represents an organization posting jobs.
- **Job / Job Posting**: Contains requirements, descriptions, and metadata for a vacancy.
- **Application**: The relational link between a Candidate and a Job, including status tracking.
- **Subscription Package**: Available plans for employers (e.g., Free, Basic, Premium).
- **Payment Transaction**: Records of financial transactions.

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Docker (optional, but recommended)

### Local Development Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory based on the provided `.env.example` and configure your Database, JWT secrets, Gemini API key, Supabase, and VNPay keys accordingly.

4. **Database Setup:**
   If using Docker, you can spin up the required database services:

   ```bash
   docker-compose up -d
   ```

   Run database migrations to set up the schema:

   ```bash
   npm run migration:run
   ```

5. **Start the application:**

   ```bash
   npm run start:dev
   ```

6. **Access Swagger Documentation:**
   Open your browser and navigate to `http://localhost:3000/api/docs` (or your configured port).
