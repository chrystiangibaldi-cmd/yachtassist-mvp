# YachtAssist MVP - Product Requirements Document

## Overview
YachtAssist is a maritime assistance platform connecting yacht owners with technicians for maintenance and compliance services.

## Problem Statement
Continuing work on YachtAssist MVP from GitHub repo. 
- Fix 2 bugs related to ticket display
- Add Phase 3: Email notifications via Resend

## User Personas
1. **Yacht Owner (Armatore)**: Manages yacht compliance and requests interventions
2. **Technician (Tecnico)**: Receives and completes work assignments

## Core Requirements (Static)
- Demo login for investor presentations
- Real authentication (JWT-based)
- Owner dashboard with compliance score
- Checklist management
- Ticket creation and management
- Technician assignment workflow
- Email notifications for key events

## What's Been Implemented

### Session: Jan 2026

#### Bug Fixes
1. **Bug #1 - Yacht Display Fixed**
   - Problem: Generic tickets showed "Nessuna imbarcazione ()" instead of yacht name
   - Solution: Added `/api/yachts/{yacht_id}` endpoint and updated TicketDetail.jsx to fetch yacht directly by ID
   - Result: Now correctly shows "Suerte (Sanlorenzo 50)" for demo user

2. **Bug #2 - Quote Placeholder Fixed**
   - Problem: Generic tickets showed wrong quote breakdown
   - Solution: Added conditional rendering in TicketDetail.jsx
   - Result: Shows "In attesa del preventivo del tecnico" when no quote_items exist

#### Phase 3: Email Notifications (Resend)
- **Welcome Email**: Sent on user registration
- **Ticket Created Email**: Sent to owner when new ticket is created
- **Technician Assigned Email**: Sent to both owner and technician when assignment occurs
- Configuration: Using `onboarding@resend.dev` as sender (test mode)

## Tech Stack
- **Frontend**: React + TailwindCSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Email**: Resend API

## API Endpoints
- `POST /api/auth/register` - User registration (with welcome email)
- `POST /api/auth/login` - Real authentication
- `POST /api/auth/demo-login` - Demo login
- `GET /api/dashboard/owner` - Owner dashboard
- `GET /api/dashboard/technician` - Technician dashboard
- `GET /api/yachts/{yacht_id}` - Get yacht by ID (NEW)
- `GET /api/tickets/{ticket_id}` - Get ticket details
- `POST /api/tickets/create` - Create ticket (with email notification)
- `POST /api/tickets/{ticket_id}/assign` - Assign technician (with email notifications)
- `POST /api/tickets/{ticket_id}/close` - Close ticket
- `GET /api/checklist/{yacht_id}` - Get checklist items
- `GET /api/technicians/available` - List available technicians

## Prioritized Backlog

### P0 (Done)
- [x] Bug fix: Yacht name display
- [x] Bug fix: Quote placeholder
- [x] Email notifications (registration, ticket, assignment)

### P1 (Next)
- [ ] Custom email domain setup (replace onboarding@resend.dev)
- [ ] Email notification for ticket closure
- [ ] Real-time status updates (websockets)

### P2 (Future)
- [ ] Push notifications (mobile)
- [ ] Payment integration (Stripe)
- [ ] Document upload/management
- [ ] Rating system for technicians
- [ ] Multi-language support

## Environment Variables
```
# Backend (.env)
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
RESEND_API_KEY=re_xxxxx
SENDER_EMAIL=onboarding@resend.dev
```

## Next Tasks
1. Verify email delivery in Resend dashboard
2. Set up custom sending domain
3. Add email notification for ticket status changes
