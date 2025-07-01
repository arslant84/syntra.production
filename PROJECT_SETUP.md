# Syntra - Synchronized Travel Management System

A comprehensive travel management portal built with Next.js, TypeScript, and PostgreSQL for managing travel requests, expense claims, visa applications, and accommodation bookings.

## 🚀 Features

- **Travel Request Management (TRF)**
  - Domestic, Overseas, Home Leave, and External Party travel requests
  - Multi-step approval workflow
  - Itinerary management
  - Meal provisions and accommodation details

- **Expense Claims System**
  - Staff expense claim forms
  - Medical claim support
  - Foreign exchange rate tracking
  - Financial summary and calculations

- **Visa Application Management**
  - Visa application tracking
  - Document management
  - Status updates

- **Accommodation Booking System**
  - Room and location management
  - Booking calendar
  - Assignment and blocking functionality

- **User Management & Permissions**
  - Role-based access control
  - Department-based permissions
  - User status management

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **PostgreSQL** (v12 or higher)
- **Git**

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd syntra
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/syntra"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 4. Database Setup

#### Create PostgreSQL Database

```sql
CREATE DATABASE syntra;
```

#### Run Database Schema

The project includes database setup scripts in the `scripts/` directory. Run them using:

```bash
# Run all setup scripts
node scripts/run-all.js

# Or run individual scripts
node scripts/setup-database.js
```

### 5. Start the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Project Structure

```
syntra/
├── src/
│   ├── app/                    # Next.js 13+ app directory
│   │   ├── api/               # API routes
│   │   ├── claims/            # Expense claims pages
│   │   ├── trf/               # Travel request pages
│   │   ├── visa/              # Visa application pages
│   │   ├── admin/             # Admin dashboard pages
│   │   └── accommodation/     # Accommodation pages
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Base UI components (shadcn/ui)
│   │   ├── claims/           # Claim-specific components
│   │   ├── trf/              # TRF-specific components
│   │   └── layout/           # Layout components
│   ├── lib/                  # Utility functions and configurations
│   ├── hooks/                # Custom React hooks
│   └── types/                # TypeScript type definitions
├── scripts/                  # Database setup and utility scripts
├── public/                   # Static assets
└── docs/                     # Documentation
```

## 🚀 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking

# Database
npm run setup:db     # Run all database setup scripts
npm run db:reset     # Reset database (development only)
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | NextAuth.js base URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Yes |

## 👥 User Roles and Permissions

The system implements a role-based access control (RBAC) system:

### Default Roles

1. **System Administrator** - Full system access
2. **Requestor** - Can submit TRFs, claims, and visa applications
3. **Department Focal** - Verifies initial requests
4. **Line Manager** - Approves direct reports' requests
5. **HOD** - Approves high-cost/international requests
6. **Ticketing Admin** - Manages flight bookings
7. **Accommodation Admin** - Manages accommodation bookings
8. **Visa Clerk** - Processes visa applications
9. **Finance Clerk** - Processes expense claims

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check `DATABASE_URL` in `.env.local`
   - Ensure database exists and is accessible

2. **Authentication Issues**
   - Verify `NEXTAUTH_SECRET` is set
   - Check `NEXTAUTH_URL` matches your development URL

3. **Build Errors**
   - Clear `.next` directory: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run type-check`

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm run test`
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the troubleshooting section above
2. Review the documentation in the `docs/` directory
3. Open an issue on GitHub
4. Contact the development team

---

**Note**: This is a development version. For production deployment, ensure proper security configurations, environment variables, and database backups are in place. 