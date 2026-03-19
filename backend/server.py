from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    role: Literal["owner", "technician"]
    avatar_url: Optional[str] = None

class Yacht(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    model: str
    owner_id: str
    marina: str
    category: str
    distance: str
    compliance_score: int

class ChecklistItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    status: Literal["conforme", "mancante", "scaduto"]
    is_new_2025: bool = False

class TechnicianProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    specialization: str
    location: str
    distance: str
    rating: float
    eco_certified: bool = False
    avatar_url: Optional[str] = None

class QuoteItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    voce: str
    descrizione: str
    importo: int

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    yacht_id: str
    owner_id: str
    technician_id: Optional[str] = None
    status: Literal["aperto", "assegnato", "accettato", "eseguito", "chiuso"]
    urgency: Literal["alta", "media", "bassa"]
    work_items: List[str]
    price_min: int
    price_max: int
    final_price: Optional[int] = None
    commission: Optional[int] = None
    technician_payment: Optional[int] = None
    marina: str
    appointment: Optional[str] = None
    documents: List[str] = []
    quote_items: Optional[List[QuoteItem]] = None
    created_at: str

class LoginRequest(BaseModel):
    role: Literal["owner", "technician"]

class LoginResponse(BaseModel):
    user: User
    token: str

class OwnerDashboard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user: User
    yacht: Yacht
    open_tickets: int
    active_interventions: int
    season: str
    recent_tickets: List[Ticket]

class TechnicianDashboard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user: User
    assigned_tickets: List[Ticket]
    total_earnings: int
    pending_earnings: int

class AssignTechnicianRequest(BaseModel):
    technician_id: str

class CloseTicketRequest(BaseModel):
    documents: List[str]

# Seed demo data
async def seed_data(force_reset=False):
    # Only reset if forced or if database is empty
    if not force_reset:
        existing_users = await db.users.count_documents({})
        if existing_users > 0:
            return
    
    # Clear all collections if force reset
    if force_reset:
        await db.users.delete_many({})
        await db.yachts.delete_many({})
        await db.checklist_items.delete_many({})
        await db.technician_profiles.delete_many({})
        await db.tickets.delete_many({})
    
    users = [
        {
            "id": "owner-1",
            "name": "Chrystian Gibaldi",
            "email": "chrystian@yachtassist.it",
            "role": "owner",
            "avatar_url": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop"
        },
        {
            "id": "tech-1",
            "name": "Enrico Gibaldi",
            "email": "enrico@yachtassist.it",
            "role": "technician",
            "avatar_url": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=200&h=200&fit=crop"
        },
        {
            "id": "tech-2",
            "name": "Gianni Ferretti",
            "email": "gianni@yachtassist.it",
            "role": "technician"
        },
        {
            "id": "tech-3",
            "name": "Simone Russo",
            "email": "simone@yachtassist.it",
            "role": "technician"
        }
    ]
    await db.users.insert_many(users)
    
    yachts = [{
        "id": "yacht-1",
        "name": "Suerte",
        "model": "Sanlorenzo 50",
        "owner_id": "owner-1",
        "marina": "Marina di Pisa",
        "category": "Motore",
        "distance": "12 miglia",
        "compliance_score": 67
    }]
    await db.yachts.insert_many(yachts)
    
    checklist_items = [
        {"id": "item-1", "yacht_id": "yacht-1", "name": "Giubbotti 150N con luce automatica", "status": "conforme", "is_new_2025": True},
        {"id": "item-2", "yacht_id": "yacht-1", "name": "Salvagente anulare con boetta", "status": "conforme", "is_new_2025": False},
        {"id": "item-3", "yacht_id": "yacht-1", "name": "Zattera di salvataggio", "status": "mancante", "is_new_2025": True},
        {"id": "item-4", "yacht_id": "yacht-1", "name": "Razzi a paracadute × 2", "status": "scaduto", "is_new_2025": False},
        {"id": "item-5", "yacht_id": "yacht-1", "name": "Radio VHF", "status": "conforme", "is_new_2025": False},
        {"id": "item-6", "yacht_id": "yacht-1", "name": "Iscrizione ATCN", "status": "conforme", "is_new_2025": True}
    ]
    await db.checklist_items.insert_many(checklist_items)
    
    technician_profiles = [
        {
            "id": "tech-1",
            "name": "Enrico Gibaldi",
            "specialization": "Dotazioni sicurezza",
            "location": "Livorno",
            "distance": "8km",
            "rating": 4.9,
            "eco_certified": True,
            "avatar_url": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=200&h=200&fit=crop"
        },
        {
            "id": "tech-2",
            "name": "Gianni Ferretti",
            "specialization": "Multidisciplinare",
            "location": "Pisa",
            "distance": "12km",
            "rating": 4.7,
            "eco_certified": False,
            "avatar_url": "https://images.pexels.com/photos/279949/pexels-photo-279949.jpeg?w=200&h=200&fit=crop"
        },
        {
            "id": "tech-3",
            "name": "Simone Russo",
            "specialization": "Dotazioni sicurezza",
            "location": "Marina di Pisa",
            "distance": "2km",
            "rating": 4.6,
            "eco_certified": False,
            "avatar_url": "https://images.pexels.com/photos/6720529/pexels-photo-6720529.jpeg?w=200&h=200&fit=crop"
        }
    ]
    await db.technician_profiles.insert_many(technician_profiles)
    
    tickets = [{
        "id": "YA-2025-0847",
        "yacht_id": "yacht-1",
        "owner_id": "owner-1",
        "technician_id": None,
        "status": "aperto",
        "urgency": "alta",
        "work_items": ["Fornitura zattera ISO 9650-1", "Sostituzione razzi paracadute × 2"],
        "price_min": 180,
        "price_max": 380,
        "final_price": 280,
        "commission": 42,
        "technician_payment": 238,
        "marina": "Marina di Pisa",
        "appointment": None,
        "documents": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }]
    await db.tickets.insert_many(tickets)

@app.on_event("startup")
async def startup_event():
    await seed_data()
    logger.info("Demo data seeded successfully")

# Routes
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    if request.role == "owner":
        user = await db.users.find_one({"id": "owner-1"}, {"_id": 0})
    else:
        user = await db.users.find_one({"id": "tech-1"}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return LoginResponse(user=User(**user), token=f"demo-token-{user['id']}")

@api_router.get("/dashboard/owner", response_model=OwnerDashboard)
async def get_owner_dashboard(user_id: str = "owner-1"):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    yacht = await db.yachts.find_one({"owner_id": user_id}, {"_id": 0})
    tickets = await db.tickets.find({"owner_id": user_id}, {"_id": 0}).to_list(10)
    
    open_tickets = len([t for t in tickets if t["status"] in ["aperto", "assegnato"]])
    active_interventions = len([t for t in tickets if t["status"] == "accettato"])
    
    return OwnerDashboard(
        user=User(**user),
        yacht=Yacht(**yacht),
        open_tickets=open_tickets,
        active_interventions=active_interventions,
        season="Stagione 2025",
        recent_tickets=[Ticket(**t) for t in tickets[:2]]
    )

@api_router.get("/dashboard/technician", response_model=TechnicianDashboard)
async def get_technician_dashboard(user_id: str = "tech-1"):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    tickets = await db.tickets.find({"technician_id": user_id}, {"_id": 0}).to_list(10)
    
    total_earnings = sum([t.get("technician_payment", 0) for t in tickets if t["status"] == "chiuso"])
    pending_earnings = sum([t.get("technician_payment", 0) for t in tickets if t["status"] in ["assegnato", "accettato", "eseguito"]])
    
    return TechnicianDashboard(
        user=User(**user),
        assigned_tickets=[Ticket(**t) for t in tickets],
        total_earnings=total_earnings,
        pending_earnings=pending_earnings
    )

@api_router.get("/checklist/{yacht_id}", response_model=List[ChecklistItem])
async def get_checklist(yacht_id: str):
    items = await db.checklist_items.find({"yacht_id": yacht_id}, {"_id": 0}).to_list(100)
    return [ChecklistItem(**item) for item in items]

@api_router.get("/technicians/available", response_model=List[TechnicianProfile])
async def get_available_technicians():
    profiles = await db.technician_profiles.find({}, {"_id": 0}).to_list(100)
    return [TechnicianProfile(**p) for p in profiles]

@api_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return Ticket(**ticket)

@api_router.post("/tickets/{ticket_id}/assign")
async def assign_technician(ticket_id: str, request: AssignTechnicianRequest):
    # Check if ticket exists first
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Define quote items when technician is assigned
    quote_items = [
        {
            "voce": "Fornitura zattera ISO 9650-1",
            "descrizione": "Zattera costiera omologata",
            "importo": 180
        },
        {
            "voce": "Sostituzione razzi paracadute × 2",
            "descrizione": "Razzi Comet 60m, scad. 2028",
            "importo": 60
        },
        {
            "voce": "Manodopera",
            "descrizione": "Installazione e verifica",
            "importo": 40
        }
    ]
    
    # Update ticket - always succeeds if ticket exists
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "technician_id": request.technician_id,
            "status": "assegnato",
            "appointment": "Sab 5 apr · 09:30 · Marina di Pisa pontile B",
            "quote_items": quote_items
        }}
    )
    return {"success": True}

@api_router.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, request: CloseTicketRequest):
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "chiuso",
            "documents": request.documents
        }}
    )
    
    if result.modified_count > 0:
        ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
        await db.yachts.update_one(
            {"id": ticket["yacht_id"]},
            {"$set": {"compliance_score": 100}}
        )
    
    return {"success": True}

@api_router.post("/reset-demo")
async def reset_demo():
    """Reset demo data to initial state - hidden endpoint for demo purposes"""
    await seed_data(force_reset=True)
    logger.info("Demo data reset to initial state")
    return {"success": True, "message": "Demo data reset successfully"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
