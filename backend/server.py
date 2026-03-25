from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import resend
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid
from .auth import hash_password, verify_password, create_access_token

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'yachtassist')]

# Initialize Resend
resend.api_key = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Health check endpoint (root)
@app.get("/")
async def root():
    return {"status": "ok", "service": "YachtAssist API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Email helper function
async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Send email notification via Resend - non-blocking"""
    if not resend.api_key:
        logging.warning("RESEND_API_KEY not configured, skipping email")
        return None
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Email sent to {to_email}: {result.get('id')}")
        return result
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        return None

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
    urgency: Literal["alta", "media", "bassa", "emergenza"]
    work_items: List[str]
    # Generic ticket fields
    category: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    # Pricing
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

class CreateTicketRequest(BaseModel):
    category: str
    description: str
    urgency: Literal["normale", "urgente", "emergenza"]
    marina: str
    photos: Optional[List[str]] = []

class LoginRequest(BaseModel):
    role: Literal["owner", "technician"]

class RealLoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    nome: str
    cognome: str
    email: EmailStr
    password: str
    role: Literal["owner", "technician"]
    # Technician-specific fields
    specializzazione: Optional[str] = None
    porto_base: Optional[str] = None
    telefono: Optional[str] = None

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
    if force_reset:
        # Only when explicitly resetting via /reset-demo endpoint
        await db.users.delete_many({})
        await db.yachts.delete_many({})
        await db.checklist_items.delete_many({})
        await db.technician_profiles.delete_many({})
        await db.tickets.delete_many({})
        logger.info("Force reset: All collections cleared")
    
    # Use upsert logic - insert only if not exists, never create duplicates
    # This ensures startup never modifies existing data
    
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
    for user in users:
        await db.users.update_one(
            {"id": user["id"]},
            {"$setOnInsert": user},
            upsert=True
        )
    
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
    for yacht in yachts:
        await db.yachts.update_one(
            {"id": yacht["id"]},
            {"$setOnInsert": yacht},
            upsert=True
        )
    
    checklist_items = [
        {"id": "item-1", "yacht_id": "yacht-1", "name": "Giubbotti 150N con luce automatica", "status": "conforme", "is_new_2025": True},
        {"id": "item-2", "yacht_id": "yacht-1", "name": "Salvagente anulare con boetta", "status": "conforme", "is_new_2025": False},
        {"id": "item-3", "yacht_id": "yacht-1", "name": "Zattera di salvataggio", "status": "mancante", "is_new_2025": True},
        {"id": "item-4", "yacht_id": "yacht-1", "name": "Razzi a paracadute × 2", "status": "scaduto", "is_new_2025": False},
        {"id": "item-5", "yacht_id": "yacht-1", "name": "Radio VHF", "status": "conforme", "is_new_2025": False},
        {"id": "item-6", "yacht_id": "yacht-1", "name": "Iscrizione ATCN", "status": "conforme", "is_new_2025": True}
    ]
    for item in checklist_items:
        await db.checklist_items.update_one(
            {"id": item["id"]},
            {"$setOnInsert": item},
            upsert=True
        )
    
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
    for profile in technician_profiles:
        await db.technician_profiles.update_one(
            {"id": profile["id"]},
            {"$setOnInsert": profile},
            upsert=True
        )
    
    # Critical: Check if ticket YA-2025-0847 exists before creating
    existing_ticket = await db.tickets.find_one({"id": "YA-2025-0847"})
    if not existing_ticket:
        ticket = {
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
            "quote_items": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.update_one(
            {"id": ticket["id"]},
            {"$setOnInsert": ticket},
            upsert=True
        )
        logger.info("Demo ticket YA-2025-0847 created")
    else:
        logger.info("Demo ticket YA-2025-0847 already exists, skipping creation")

@app.on_event("startup")
async def startup_event():
    await seed_data()
    logger.info("Demo data seeded successfully")

# Routes
# DEMO LOGIN - Keep existing functionality
@api_router.post("/auth/demo-login", response_model=LoginResponse)
async def demo_login(request: LoginRequest):
    """Demo login for investor presentations - no password required"""
    if request.role == "owner":
        user = await db.users.find_one({"id": "owner-1"}, {"_id": 0})
    else:
        user = await db.users.find_one({"id": "tech-1"}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return LoginResponse(user=User(**user), token=f"demo-token-{user['id']}")

# REAL REGISTRATION
@api_router.post("/auth/register", response_model=LoginResponse)
async def register(request: RegisterRequest):
    """Register a new user with real authentication"""
    # Check if email already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Generate unique user ID
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    
    # Hash password
    hashed_password = hash_password(request.password)
    
    # Create user document
    user_doc = {
        "id": user_id,
        "name": f"{request.nome} {request.cognome}",
        "nome": request.nome,
        "cognome": request.cognome,
        "email": request.email,
        "password": hashed_password,
        "role": request.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add technician-specific fields
    if request.role == "technician":
        user_doc.update({
            "specializzazione": request.specializzazione,
            "porto_base": request.porto_base,
            "telefono": request.telefono
        })
    
    # Insert user
    await db.users.insert_one(user_doc)
    
    # Create JWT token
    token = create_access_token({"user_id": user_id, "email": request.email, "role": request.role})
    
    # Send welcome email (non-blocking)
    welcome_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Benvenuto su YachtAssist!</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
            <p style="color: #0A2342; font-size: 16px; line-height: 1.6;">
                Ciao <strong>{request.nome}</strong>,
            </p>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Il tuo account YachtAssist è stato creato con successo! 
                {"Ora puoi gestire la tua imbarcazione e richiedere interventi tecnici." if request.role == "owner" else "Ora puoi visualizzare e gestire i ticket assegnati."}
            </p>
            <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #1D9E75;">
                <p style="color: #0A2342; margin: 0; font-size: 14px;">
                    <strong>Il tuo ruolo:</strong> {"Armatore" if request.role == "owner" else "Tecnico"}
                </p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                Hai domande? Contattaci su support@yachtassist.it
            </p>
        </div>
    </div>
    """
    asyncio.create_task(send_email_notification(
        request.email,
        "Benvenuto su YachtAssist!",
        welcome_html
    ))
    
    # Return user without password
    user_doc.pop("password", None)
    user_doc.pop("_id", None)
    
    return LoginResponse(user=User(**user_doc), token=token)

# REAL LOGIN
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: RealLoginRequest):
    """Real login with email and password"""
    # Find user by email
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Email o password non validi")
    
    # Check if user has a password (real user vs demo user)
    if "password" not in user:
        raise HTTPException(status_code=401, detail="Utilizza il login demo per questo account")
    
    # Verify password
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email o password non validi")
    
    # Create JWT token
    token = create_access_token({"user_id": user["id"], "email": user["email"], "role": user["role"]})
    
    # Return user without password
    user.pop("password", None)
    
    return LoginResponse(user=User(**user), token=token)

@api_router.get("/dashboard/owner", response_model=OwnerDashboard)
async def get_owner_dashboard(user_id: str = "owner-1"):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    yacht = await db.yachts.find_one({"owner_id": user_id}, {"_id": 0})
    
    # Handle case where user doesn't have a yacht yet (new registered users)
    if not yacht:
        # Return dashboard with placeholder yacht data
        return OwnerDashboard(
            user=User(**user),
            yacht=Yacht(
                id="pending",
                name="Nessuna imbarcazione",
                model="",
                owner_id=user_id,
                marina="",
                category="",
                distance="",
                compliance_score=0
            ),
            open_tickets=0,
            active_interventions=0,
            season="Stagione 2025",
            recent_tickets=[]
        )
    
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

@api_router.get("/yachts/{yacht_id}", response_model=Yacht)
async def get_yacht(yacht_id: str):
    """Get yacht by ID"""
    yacht = await db.yachts.find_one({"id": yacht_id}, {"_id": 0})
    if not yacht:
        raise HTTPException(status_code=404, detail="Yacht not found")
    return Yacht(**yacht)

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
    
    # Only add quote items for the demo compliance ticket (YA-2025-0847)
    # Generic tickets don't get quotes until technician provides them
    quote_items = None
    if ticket_id == "YA-2025-0847":
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
    update_data = {
        "technician_id": request.technician_id,
        "status": "assegnato",
        "appointment": "Sab 5 apr · 09:30 · Marina di Pisa pontile B"
    }
    
    # Only add quote_items if it's the compliance ticket
    if quote_items:
        update_data["quote_items"] = quote_items
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": update_data}
    )
    
    # Send email notifications for technician assignment (non-blocking)
    # Get technician details
    technician = await db.technician_profiles.find_one({"id": request.technician_id}, {"_id": 0})
    tech_user = await db.users.find_one({"id": request.technician_id}, {"_id": 0})
    
    # Get owner details
    owner = await db.users.find_one({"id": ticket["owner_id"]}, {"_id": 0})
    
    # Email to owner about technician assignment
    if owner and owner.get("email"):
        owner_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Tecnico Assegnato!</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
                <p style="color: #0A2342; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>{owner.get("name", "").split()[0]}</strong>,
                </p>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                    Un tecnico è stato assegnato al tuo ticket!
                </p>
                <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="color: #0A2342; margin: 0 0 15px 0; font-size: 16px;">
                        <strong>Ticket #{ticket_id}</strong>
                    </p>
                    <div style="border-left: 4px solid #1D9E75; padding-left: 15px;">
                        <p style="color: #0A2342; margin: 0 0 5px 0; font-size: 14px;">
                            <strong>Tecnico:</strong> {technician.get("name") if technician else "N/A"}
                        </p>
                        <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">
                            <strong>Specializzazione:</strong> {technician.get("specialization") if technician else "N/A"}
                        </p>
                        <p style="color: #64748b; margin: 0; font-size: 14px;">
                            <strong>Valutazione:</strong> {"⭐" * int(technician.get("rating", 0))} ({technician.get("rating", "N/A")})
                        </p>
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                    <p style="color: #166534; margin: 0; font-size: 14px;">
                        📅 <strong>Appuntamento:</strong> Sab 5 apr · 09:30 · Marina di Pisa pontile B
                    </p>
                </div>
            </div>
        </div>
        """
        asyncio.create_task(send_email_notification(
            owner["email"],
            f"Tecnico assegnato - Ticket #{ticket_id}",
            owner_html
        ))
    
    # Email to technician about new assignment
    if tech_user and tech_user.get("email"):
        tech_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Nuovo Lavoro Assegnato!</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
                <p style="color: #0A2342; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>{tech_user.get("name", "").split()[0]}</strong>,
                </p>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                    Ti è stato assegnato un nuovo intervento!
                </p>
                <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="color: #0A2342; margin: 0 0 15px 0; font-size: 16px;">
                        <strong>Ticket #{ticket_id}</strong>
                    </p>
                    <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">
                        <strong>Marina:</strong> {ticket.get("marina", "N/A")}
                    </p>
                    <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">
                        <strong>Urgenza:</strong> {ticket.get("urgency", "N/A").capitalize()}
                    </p>
                    <p style="color: #64748b; margin: 0; font-size: 14px;">
                        <strong>Lavori:</strong>
                    </p>
                    <ul style="color: #64748b; font-size: 14px; margin: 5px 0 0 0; padding-left: 20px;">
                        {"".join([f"<li>{item}</li>" for item in ticket.get("work_items", [])])}
                    </ul>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px; border: 1px solid #fde68a;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;">
                        📅 <strong>Appuntamento:</strong> Sab 5 apr · 09:30 · Marina di Pisa pontile B
                    </p>
                </div>
            </div>
        </div>
        """
        asyncio.create_task(send_email_notification(
            tech_user["email"],
            f"Nuovo intervento assegnato - Ticket #{ticket_id}",
            tech_html
        ))
    
    return {"success": True}

@api_router.post("/tickets/create")
async def create_generic_ticket(request: CreateTicketRequest, user_id: str):
    """Create a new generic ticket from request flow"""
    # Fetch user's yacht if they have one
    yacht = await db.yachts.find_one({"owner_id": user_id}, {"_id": 0})
    yacht_id = yacht["id"] if yacht else "pending"
    
    # Generate unique ticket ID
    import random
    ticket_number = random.randint(1000, 9999)
    ticket_id = f"YA-2025-{ticket_number}"
    
    # Map urgency to work items description
    work_item = f"{request.category}: {request.description[:50]}..."
    
    # Map urgency
    urgency_map = {
        "normale": "media",
        "urgente": "alta",
        "emergenza": "alta"
    }
    
    # Create ticket document
    ticket_doc = {
        "id": ticket_id,
        "yacht_id": yacht_id,
        "owner_id": user_id,
        "technician_id": None,
        "status": "aperto",
        "urgency": urgency_map.get(request.urgency, "media"),
        "work_items": [work_item],
        "category": request.category,
        "description": request.description,
        "photos": request.photos or [],
        "price_min": 100,
        "price_max": 500,
        "final_price": None,
        "commission": None,
        "technician_payment": None,
        "marina": request.marina,
        "appointment": None,
        "documents": [],
        "quote_items": None,  # No quote until technician provides one
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tickets.insert_one(ticket_doc)
    ticket_doc.pop("_id", None)
    
    # Send ticket creation email to owner (non-blocking)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user and user.get("email"):
        ticket_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Nuovo Ticket Creato</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
                <p style="color: #0A2342; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>{user.get("name", "").split()[0]}</strong>,
                </p>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                    Il tuo ticket è stato creato con successo!
                </p>
                <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="color: #0A2342; margin: 0 0 10px 0; font-size: 16px;">
                        <strong>Ticket #{ticket_id}</strong>
                    </p>
                    <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">
                        <strong>Categoria:</strong> {request.category}
                    </p>
                    <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">
                        <strong>Marina:</strong> {request.marina}
                    </p>
                    <p style="color: #64748b; margin: 0; font-size: 14px;">
                        <strong>Urgenza:</strong> {request.urgency.capitalize()}
                    </p>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 20px; line-height: 1.6;">
                    Ti notificheremo quando un tecnico verrà assegnato al tuo ticket.
                </p>
            </div>
        </div>
        """
        asyncio.create_task(send_email_notification(
            user["email"],
            f"Ticket #{ticket_id} creato - YachtAssist",
            ticket_html
        ))
    
    return {"ticket": Ticket(**ticket_doc), "success": True}

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
