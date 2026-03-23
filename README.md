# YachtAssist MVP

**Professional marketplace connecting yacht owners with certified marine technicians in Italy**

🚀 **Live Demo**: https://yacht-assist-demo.preview.emergentagent.com

---

## 🎯 Overview

YachtAssist is an investor-ready MVP that streamlines yacht maintenance compliance by connecting owners with qualified marine technicians. Built for the Italian maritime market with full D.M. 133/2024 regulation compliance tracking.

### Key Features
- ✅ D.M. 133/2024 compliance checklist with real-time scoring
- ✅ Automated ticket generation for non-compliant items
- ✅ Smart technician matching (location, specialization, ratings)
- ✅ Detailed quote breakdowns with line items
- ✅ Commission-based business model (15%)
- ✅ Complete workflow: ticket creation → assignment → completion → closure
- ✅ Dual dashboards: Owner & Technician views
- ✅ Italian language interface

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 with React Router
- Tailwind CSS + Shadcn/UI components
- Axios for API calls
- Lucide React icons

**Backend:**
- FastAPI (Python)
- MongoDB with Motor (async driver)
- Pydantic for data validation

**Deployment:**
- Emergent platform
- Docker containers
- Supervisor for process management

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB instance
- Yarn package manager

### Installation

**1. Clone repository:**
```bash
git clone https://github.com/chrystiangibaldi-cmd/yachtassist-mvp.git
cd yachtassist-mvp
```

**2. Backend setup:**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure your MongoDB URL
python server.py
```

**3. Frontend setup:**
```bash
cd frontend
yarn install
yarn start
```

**4. Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001

---

## 📊 Demo Data

The app includes pre-seeded demo data for investor presentations:

**Owner Account:**
- Name: Chrystian Gibaldi
- Yacht: Sanlorenzo 50 "Suerte"
- Location: Marina di Pisa

**Technician Account:**
- Name: Enrico Gibaldi
- Specialization: Dotazioni sicurezza
- Rating: 4.9★ (Eco Certified)

**Demo Ticket:**
- ID: YA-2025-0847
- Items: Zattera di salvataggio + Razzi paracadute
- Total: €280 (€180 + €60 + €40 manodopera)

---

## 🔑 Environment Variables

**Backend (`/backend/.env`):**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=yachtassist
CORS_ORIGINS=http://localhost:3000
```

**Frontend (`/frontend/.env`):**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📱 User Flows

### Owner Flow
1. Login → Dashboard (compliance score 67%)
2. Open Pre-Season Checklist (6 items)
3. Generate Ticket for non-compliant items
4. Review 3 available technicians
5. Assign to Enrico Gibaldi
6. View detailed quote breakdown
7. Close ticket after completion (compliance → 100%)

### Technician Flow
1. Login → Dashboard (assigned tickets, earnings)
2. View ticket details
3. Complete work items
4. Upload documents
5. Close intervention
6. Receive payment (€238 after 15% commission)

---

## 🎨 Design System

**Colors:**
- Primary: Navy #0A2342
- Secondary: Teal #1D9E75
- Background: #F8FAFC

**Typography:**
- Headings: Manrope (400-800)
- Body: Inter (400-600)

**Components:**
- Shadcn/UI library (55+ components)
- Custom maritime-themed layouts
- Responsive mobile-first design

---

## 🔄 Reset Demo Data

The app includes a reset endpoint for investor demos:

**Via URL:**
```
/reset-demo
```

**Via API:**
```bash
curl -X POST http://localhost:8001/api/reset-demo
```

This resets all data to initial state:
- Compliance score: 67%
- Ticket status: "Aperto"
- No technician assigned

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - Demo login (owner/technician)

### Dashboards
- `GET /api/dashboard/owner?user_id={id}` - Owner dashboard data
- `GET /api/dashboard/technician?user_id={id}` - Technician dashboard

### Tickets
- `GET /api/tickets/{id}` - Get ticket details
- `POST /api/tickets/{id}/assign` - Assign technician
- `POST /api/tickets/{id}/close` - Close ticket

### Data
- `GET /api/checklist/{yacht_id}` - Compliance checklist
- `GET /api/technicians/available` - Available technicians
- `POST /api/reset-demo` - Reset to initial state

---

## 🐛 Known Issues / Limitations

- Demo uses simplified authentication (no passwords)
- MongoDB uses pre-configured demo data
- Commission rates are fixed at 15%
- Single yacht per owner in demo
- Italian language only

---

## 🚢 Production Roadmap

### Phase 1 (Completed)
- ✅ MVP with full demo flow
- ✅ Compliance tracking
- ✅ Ticket management
- ✅ Quote breakdowns

### Phase 2 (Future)
- [ ] Real authentication with JWT
- [ ] Multi-yacht support
- [ ] Payment gateway integration (Stripe)
- [ ] Document storage (S3)
- [ ] Email notifications
- [ ] Multi-language support

### Phase 3 (Future)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Seasonal demand forecasting
- [ ] Technician certification verification
- [ ] Insurance integration

---

## 📄 License

Proprietary - All rights reserved

---

## 👥 Contact

**Project Owner:** Chrystian Gibaldi  
**Repository:** https://github.com/chrystiangibaldi-cmd/yachtassist-mvp

---

Built with ❤️ for the Italian maritime industry
