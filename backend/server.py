from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import resend
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Literal, Any
from datetime import datetime, timezone, timedelta
from datetime import datetime as _dt  # alias per annotazioni che altrimenti sarebbero shadowate dal nome di campo `datetime`
from math import radians, sin, cos, sqrt, atan2
import uuid
from .auth import hash_password, verify_password, create_access_token
from .payments import payments_router, set_db, calculate_commission
from anthropic import Anthropic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'yachtassist')]

# Initialize Resend
resend.api_key = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Initialize Anthropic
anthropic_client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Health check endpoint (root)
@app.get("/")
async def root():
    return {"status": "ok", "service": "YachtAssist API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Email helper function
async def send_email_notification(to_email: str, subject: str, html_content: str, text_content: str = None):
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
        if text_content:
            params["text"] = text_content
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Email sent to {to_email}: {result.get('id')}")
        return result
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        return None

def haversine_km(lat1, lng1, lat2, lng2):
    """Distanza in km tra due coordinate. Ritorna None se uno dei 4 valori e' None/falsy."""
    if not all([lat1, lng1, lat2, lng2]):
        return None
    R = 6371.0
    lat1r, lng1r, lat2r, lng2r = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2r - lat1r
    dlng = lng2r - lng1r
    a = sin(dlat/2)**2 + cos(lat1r) * cos(lat2r) * sin(dlng/2)**2
    return round(2 * R * atan2(sqrt(a), sqrt(1-a)), 1)


# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    role: Literal["owner", "technician"]
    avatar_url: Optional[str] = None
    porto_base: Optional[str] = None
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None

class Yacht(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    model: str
    owner_id: str
    marina: str
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None
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
    specialization: str  # kept for backward compat (primo valore)
    specializations: List[str] = []  # array completo specializzazioni
    location: str
    distance: str
    rating: float
    eco_certified: bool = False
    avatar_url: Optional[str] = None
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None
    distance_km: Optional[float] = None

class QuoteItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    voce: str
    descrizione: str
    importo: int

class Appointment(BaseModel):
    datetime: Optional[_dt] = None
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    yacht_id: str
    owner_id: str
    technician_id: Optional[str] = None
    status: Literal["aperto", "assegnato", "pagato", "confermato", "eseguito", "chiuso"]
    urgency: Literal["alta", "media", "bassa", "emergenza"]
    work_items: List[str]
    category: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[Any]] = []
    price_min: int
    price_max: int
    final_price: Optional[int] = None
    commission: Optional[int] = None
    technician_payment: Optional[int] = None
    marina: str
    appointment: Optional[Appointment] = None
    proposed_slots: List[str] = Field(default_factory=list)
    appointment_lat: Optional[float] = None  # DEPRECATED, rimuovere in commit 5d dopo rollout completo
    appointment_lng: Optional[float] = None  # DEPRECATED, rimuovere in commit 5d dopo rollout completo
    documents: List[str] = []
    quote_items: Optional[List[QuoteItem]] = None
    quote_note: Optional[str] = None
    preventivo_pdf: Optional[Any] = None
    created_at: str
    appointment_proposed_at: Optional[str] = None
    appointment_confirmed_at: Optional[str] = None

    @field_validator("appointment", mode="before")
    @classmethod
    def _coerce_legacy_appointment(cls, v):
        if isinstance(v, str):
            if v.strip():
                return {"datetime": None, "location": v, "lat": None, "lng": None}
            return None
        return v

    @field_validator("proposed_slots", mode="before")
    @classmethod
    def _coerce_legacy_proposed_slots(cls, v):
        if v is None:
            return []
        return v


class Attachment(BaseModel):
    name: str
    type: str
    data: str  # base64 data URL

class CreateTicketRequest(BaseModel):
    category: str
    description: str
    urgency: Literal["normale", "urgente", "emergenza"]
    marina: str
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None
    photos: Optional[List[Attachment]] = []

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
    specializzazione: Optional[List[str]] = None
    specializzazioni: Optional[List[str]] = None  # array categorie selezionate
    specializations: Optional[List[str]] = None
    porto_base: Optional[str] = None
    telefono: Optional[str] = None
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None

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

class SubmitQuoteRequest(BaseModel):
    items: List[QuoteItem]
    note: Optional[str] = None
    preventivo_pdf: Optional[Any] = None

class CloseTicketRequest(BaseModel):
    documents: List[str]

class ProposeAppointmentRequest(BaseModel):
    slots: List[str] = Field(..., min_length=1, max_length=5)

    @field_validator("slots")
    @classmethod
    def _clean_slots(cls, v: List[str]) -> List[str]:
        cleaned = [s.strip() for s in v if s.strip()]
        for s in cleaned:
            if len(s) > 200:
                raise ValueError("Ogni slot max 200 caratteri")
        if not cleaned:
            raise ValueError("Almeno uno slot non vuoto richiesto")
        return cleaned

class ConfirmAppointmentRequest(BaseModel):
    scheduled_at: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    @field_validator("scheduled_at")
    @classmethod
    def _validate_future(cls, v: str) -> str:
        try:
            dt = datetime.fromisoformat(v)
        except ValueError:
            raise ValueError("scheduled_at deve essere ISO 8601")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt < datetime.now(timezone.utc) - timedelta(minutes=5):
            raise ValueError("scheduled_at deve essere nel futuro")
        return v

class DiagnoseRequest(BaseModel):
    description: str
    category: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Seed demo data
async def seed_data(force_reset=False):
    if force_reset:
        demo_emails = ["demo@owner.it", "demo@tecnico.it", "beta@yachtassist.it"]
        demo_users = await db.users.find({"email": {"$in": demo_emails}}).to_list(None)
        demo_user_ids = [u["id"] for u in demo_users]

        if demo_user_ids:
            demo_yachts = await db.yachts.find({"owner_id": {"$in": demo_user_ids}}).to_list(None)
            demo_yacht_ids = [y["id"] for y in demo_yachts]

            await db.tickets.delete_many({"owner_id": {"$in": demo_user_ids}})
            if demo_yacht_ids:
                await db.checklist_items.delete_many({"yacht_id": {"$in": demo_yacht_ids}})
            await db.yachts.delete_many({"owner_id": {"$in": demo_user_ids}})
            await db.technician_profiles.delete_many({"id": {"$in": demo_user_ids}})
            await db.password_resets.delete_many({"email": {"$in": demo_emails}})
            await db.users.delete_many({"email": {"$in": demo_emails}})

        logger.info("Force reset: Demo data cleared (real data untouched)")

    demo_password = hash_password("Demo2026!")
    beta_password = hash_password("Beta2026!")

    users = [
        {
            "id": "owner-1",
            "name": "Chrystian Gibaldi",
            "nome": "Chrystian",
            "cognome": "Gibaldi",
            "email": "demo@owner.it",
            "password": demo_password,
            "role": "owner",
            "avatar_url": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "tech-1",
            "name": "Enrico Gibaldi",
            "nome": "Enrico",
            "cognome": "Gibaldi",
            "email": "demo@tecnico.it",
            "password": demo_password,
            "role": "technician",
            "specializzazione": "Motore & Propulsione",
            "porto_base": "Livorno",
            "telefono": "",
            "avatar_url": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=200&h=200&fit=crop",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "beta-1",
            "name": "Marco Rossi",
            "nome": "Marco",
            "cognome": "Rossi",
            "email": "beta@yachtassist.it",
            "password": beta_password,
            "role": "owner",
            "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    for user in users:
        await db.users.update_one(
            {"id": user["id"]},
            {"$setOnInsert": user},
            upsert=True
        )

    yachts = [
        {
            "id": "yacht-1",
            "name": "Suerte",
            "model": "Sanlorenzo 50",
            "owner_id": "owner-1",
            "marina": "Marina di Pisa",
            "marina_lat": 43.6723848,
            "marina_lng": 10.2754365,
            "category": "Motore",
            "distance": "12 miglia",
            "compliance_score": 67,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "yacht-beta-1",
            "name": "Libeccio",
            "model": "Azimut 40",
            "owner_id": "beta-1",
            "marina": "Marina di Livorno",
            "marina_lat": 43.548476,
            "marina_lng": 10.3106087,
            "category": "Motore",
            "distance": "",
            "compliance_score": 0,
            "anno": 2019,
            "lunghezza": "12m",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
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
            "specialization": "Motore & Propulsione",
            "specializations": ["motore", "elettrico", "impianti"],
            "location": "Livorno",
            "distance": "8km",
            "rating": 4.9,
            "eco_certified": True,
            "avatar_url": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=200&h=200&fit=crop",
            "marina_lat": 43.548476,
            "marina_lng": 10.3106087
        }
    ]
    for profile in technician_profiles:
        await db.technician_profiles.update_one(
            {"id": profile["id"]},
            {"$setOnInsert": profile},
            upsert=True
        )

    existing_ticket = await db.tickets.find_one({"id": "YA-2025-0847"})
    if not existing_ticket:
        ticket = {
            "id": "YA-2025-0847",
            "yacht_id": "yacht-1",
            "owner_id": "owner-1",
            "technician_id": None,
            "status": "aperto",
            "urgency": "alta",
            "category": "Motore & Propulsione",
            "description": "Zattera di salvataggio mancante e razzi paracadute scaduti. Necessaria sostituzione urgente per conformità.",
            "work_items": ["Fornitura zattera ISO 9650-1", "Sostituzione razzi paracadute × 2"],
            "photos": [],
            "price_min": 180,
            "price_max": 380,
            "final_price": None,
            "commission": None,
            "technician_payment": None,
            "marina": "Marina di Pisa",
            "appointment": None,
            "documents": [],
            "quote_items": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.insert_one(ticket)
        logger.info("Demo ticket YA-2025-0847 created")

@app.on_event("startup")
async def startup_event():
    set_db(db)
    await seed_data()
    logger.info("Demo data seeded successfully")

# Routes
@api_router.post("/auth/demo-login", response_model=LoginResponse)
async def demo_login(request: LoginRequest):
    if request.role == "owner":
        user = await db.users.find_one({"id": "owner-1"}, {"_id": 0})
    else:
        user = await db.users.find_one({"id": "tech-1"}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return LoginResponse(user=User(**user), token=f"demo-token-{user['id']}")

@api_router.post("/auth/register", response_model=LoginResponse)
async def register(request: RegisterRequest):
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email già registrata")
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    hashed_password = hash_password(request.password)
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
    if request.role == "technician":
        user_doc.update({
            "specializzazione": request.specializzazione or request.specializzazioni or request.specializations or [],
            "porto_base": request.porto_base,
            "telefono": request.telefono,
            "marina_lat": request.marina_lat,
            "marina_lng": request.marina_lng,
        })
    await db.users.insert_one(user_doc)
    # Se tecnico, crea profilo per il matching
    if request.role == "technician":
        specializzazioni = request.specializzazione or request.specializzazioni or request.specializations or []
        tech_profile = {
            "id": user_id,
            "name": f"{request.nome} {request.cognome}",
            "specialization": specializzazioni[0] if specializzazioni else "Multidisciplinare",
            "specializations": specializzazioni,
            "location": request.porto_base or "",
            "distance": "",
            "rating": 0.0,
            "eco_certified": False,
            "avatar_url": None,
            "marina_lat": request.marina_lat,
            "marina_lng": request.marina_lng,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.technician_profiles.insert_one(tech_profile)
    token = create_access_token({"user_id": user_id, "email": request.email, "role": request.role})
    welcome_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Benvenuto su YachtAssist!</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
            <p style="color: #0A2342; font-size: 16px;">Ciao <strong>{request.nome}</strong>,</p>
            <p style="color: #64748b; font-size: 14px;">Il tuo account YachtAssist è stato creato con successo!</p>
        </div>
    </div>
    """
    asyncio.create_task(send_email_notification(request.email, "Benvenuto su YachtAssist!", welcome_html))
    user_doc.pop("password", None)
    user_doc.pop("_id", None)
    return LoginResponse(user=User(**user_doc), token=token)

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: RealLoginRequest):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Email o password non validi")
    if "password" not in user:
        raise HTTPException(status_code=401, detail="Utilizza il login demo per questo account")
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email o password non validi")
    token = create_access_token({"user_id": user["id"], "email": user["email"], "role": user["role"]})
    user.pop("password", None)
    return LoginResponse(user=User(**user), token=token)

@api_router.get("/dashboard/owner", response_model=OwnerDashboard)
async def get_owner_dashboard(user_id: str = "owner-1"):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    yacht = await db.yachts.find_one({"owner_id": user_id}, {"_id": 0})
    if not yacht:
        return OwnerDashboard(
            user=User(**user),
            yacht=Yacht(id="pending", name="Nessuna imbarcazione", model="", owner_id=user_id, marina="", category="", distance="", compliance_score=0),
            open_tickets=0, active_interventions=0, season="Stagione 2025", recent_tickets=[]
        )
    tickets = await db.tickets.find({"owner_id": user_id}, {"_id": 0}).to_list(10)
    open_tickets = len([t for t in tickets if t["status"] in ["aperto", "assegnato"]])
    active_interventions = len([t for t in tickets if t["status"] == "pagato"])
    return OwnerDashboard(
        user=User(**user), yacht=Yacht(**yacht),
        open_tickets=open_tickets, active_interventions=active_interventions,
        season="Stagione 2025", recent_tickets=[Ticket(**t) for t in tickets[:2]]
    )

@api_router.get("/dashboard/technician", response_model=TechnicianDashboard)
async def get_technician_dashboard(user_id: str = "tech-1"):
    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        tickets = await db.tickets.find({"technician_id": user_id}, {"_id": 0}).to_list(10)
        total_earnings = sum([(t.get("technician_payment") or 0) for t in tickets if t["status"] == "chiuso"])
        pending_earnings = sum([(t.get("technician_payment") or 0) for t in tickets if t["status"] in ["assegnato", "pagato", "eseguito"]])
        return TechnicianDashboard(
            user=User(**user), assigned_tickets=[Ticket(**t) for t in tickets],
            total_earnings=total_earnings, pending_earnings=pending_earnings
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] /dashboard/technician?user_id={user_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/checklist/{yacht_id}", response_model=List[ChecklistItem])
async def get_checklist(yacht_id: str):
    items = await db.checklist_items.find({"yacht_id": yacht_id}, {"_id": 0}).to_list(100)
    return [ChecklistItem(**item) for item in items]

@api_router.get("/yachts/{yacht_id}", response_model=Yacht)
async def get_yacht(yacht_id: str):
    yacht = await db.yachts.find_one({"id": yacht_id}, {"_id": 0})
    if not yacht:
        raise HTTPException(status_code=404, detail="Yacht not found")
    return Yacht(**yacht)

@api_router.get("/technicians/available", response_model=List[TechnicianProfile])
async def get_available_technicians(
    category: Optional[str] = None,
    marina_lat: Optional[float] = None,
    marina_lng: Optional[float] = None,
):
    profiles = await db.technician_profiles.find({}, {"_id": 0}).to_list(100)

    # Filtro categoria: hide (non riordino) se category specificata
    if category:
        profiles = [p for p in profiles if category in p.get("specializations", [])]

    # Calcolo distanza Haversine (None se manca lat/lng da un lato)
    for p in profiles:
        p["distance_km"] = haversine_km(
            p.get("marina_lat"), p.get("marina_lng"), marina_lat, marina_lng
        )

    def sort_key(p):
        match_score = 1 if (category and category in p.get("specializations", [])) else 0
        rating = p.get("rating") or 0
        has_rating = 1 if rating > 0 else 0
        distance = p.get("distance_km") if p.get("distance_km") is not None else 9999
        created = p.get("created_at") or ""
        try:
            ts = _dt.fromisoformat(created.replace("Z", "+00:00")).timestamp() if created else 0
        except (ValueError, AttributeError):
            ts = 0
        return (-match_score, -has_rating, -rating, distance, -ts)

    profiles = sorted(profiles, key=sort_key)[:100]
    return [TechnicianProfile(**p) for p in profiles]

@api_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return Ticket(**ticket)

@api_router.post("/tickets/{ticket_id}/assign")
async def assign_technician(ticket_id: str, request: AssignTechnicianRequest):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    quote_items = None
    if ticket_id == "YA-2025-0847":
        quote_items = [
            {"voce": "Fornitura zattera ISO 9650-1", "descrizione": "Zattera costiera omologata", "importo": 180},
            {"voce": "Sostituzione razzi paracadute × 2", "descrizione": "Razzi Comet 60m, scad. 2028", "importo": 60},
            {"voce": "Manodopera", "descrizione": "Installazione e verifica", "importo": 40}
        ]
    update_data = {
        "technician_id": request.technician_id,
        "status": "assegnato",
    }
    if quote_items:
        update_data["quote_items"] = quote_items
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})
    technician = await db.technician_profiles.find_one({"id": request.technician_id}, {"_id": 0})
    tech_user = await db.users.find_one({"id": request.technician_id}, {"_id": 0})
    owner = await db.users.find_one({"id": ticket["owner_id"]}, {"_id": 0})
    if owner and owner.get("email"):
        owner_html = f"""<div style="font-family: Arial, sans-serif;"><h2>Tecnico assegnato al ticket #{ticket_id}</h2><p>Tecnico: {technician.get("name") if technician else "N/A"}</p></div>"""
        asyncio.create_task(send_email_notification(owner["email"], f"Tecnico assegnato - Ticket #{ticket_id}", owner_html))
    if tech_user and tech_user.get("email"):
        tech_html = f"""<div style="font-family: Arial, sans-serif;"><h2>Nuovo intervento assegnato - Ticket #{ticket_id}</h2></div>"""
        asyncio.create_task(send_email_notification(tech_user["email"], f"Nuovo intervento - Ticket #{ticket_id}", tech_html))
    return {"success": True}

@api_router.post("/tickets/create")
async def create_generic_ticket(request: CreateTicketRequest, user_id: str):
    yacht = await db.yachts.find_one({"owner_id": user_id}, {"_id": 0})
    yacht_id = yacht["id"] if yacht else "pending"
    import random
    ticket_number = random.randint(1000, 9999)
    ticket_id = f"YA-2025-{ticket_number}"
    work_item = f"{request.category}: {request.description[:50]}..."
    urgency_map = {"normale": "media", "urgente": "alta", "emergenza": "alta"}
    ticket_doc = {
        "id": ticket_id, "yacht_id": yacht_id, "owner_id": user_id,
        "technician_id": None, "status": "aperto",
        "urgency": urgency_map.get(request.urgency, "media"),
        "work_items": [work_item], "category": request.category,
        "description": request.description, "photos": [p.dict() for p in request.photos] if request.photos else [],
        "price_min": 100, "price_max": 500, "final_price": None,
        "commission": None, "technician_payment": None,
        "marina": request.marina, "marina_lat": request.marina_lat, "marina_lng": request.marina_lng,
        "appointment": None, "documents": [],
        "quote_items": None, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tickets.insert_one(ticket_doc)
    ticket_doc.pop("_id", None)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user and user.get("email"):
        ticket_html = f"""<div style="font-family: Arial, sans-serif;"><h2>Ticket #{ticket_id} creato</h2><p>Categoria: {request.category}</p></div>"""
        asyncio.create_task(send_email_notification(user["email"], f"Ticket #{ticket_id} creato - YachtAssist", ticket_html))
    ticket_doc_clean = {k: v for k, v in ticket_doc.items()}
    return {"ticket": ticket_doc_clean, "success": True}

class SetAppointmentRequest(BaseModel):
    appointment: str
    appointment_lat: Optional[float] = None  # DEPRECATED, rimuovere in commit 5d dopo rollout completo
    appointment_lng: Optional[float] = None  # DEPRECATED, rimuovere in commit 5d dopo rollout completo

@api_router.post("/tickets/{ticket_id}/appointment")
async def set_appointment(ticket_id: str, request: SetAppointmentRequest):
    update_fields = {"appointment": request.appointment}
    if request.appointment_lat is not None and request.appointment_lng is not None:
        update_fields["appointment_lat"] = request.appointment_lat
        update_fields["appointment_lng"] = request.appointment_lng
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"success": True}

@api_router.post("/tickets/{ticket_id}/preventivo")
async def submit_quote(ticket_id: str, request: SubmitQuoteRequest):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["status"] != "assegnato":
        raise HTTPException(status_code=400, detail="Il preventivo può essere inviato solo per ticket assegnati")

    quote_items = [item.dict() for item in request.items]
    total = sum(item.importo for item in request.items)
    commission_data = calculate_commission(total)
    commission = commission_data["commission"]
    technician_payment = commission_data["payout"]

    update_data = {
        "quote_items": quote_items,
        "final_price": total,
        "commission": commission,
        "technician_payment": technician_payment,
    }
    if request.note:
        update_data["quote_note"] = request.note
    if request.preventivo_pdf:
        update_data["preventivo_pdf"] = request.preventivo_pdf

    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})

    # Notifica owner via email
    owner = await db.users.find_one({"id": ticket["owner_id"]}, {"_id": 0})
    if owner and owner.get("email"):
        items_html = "".join(
            f"<tr><td style='padding:8px;border-bottom:1px solid #e2e8f0'>{i.voce}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right'>€{i.importo}</td></tr>"
            for i in request.items
        )
        note_html = f"<p style='color:#64748b;margin-top:16px'><strong>Note:</strong> {request.note}</p>" if request.note else ""
        owner_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 24px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Nuovo preventivo per Ticket #{ticket_id}</h1>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
                <table style="width:100%;border-collapse:collapse">
                    <thead><tr style="border-bottom:2px solid #0A2342">
                        <th style="text-align:left;padding:8px;color:#0A2342">Voce</th>
                        <th style="text-align:right;padding:8px;color:#0A2342">Importo</th>
                    </tr></thead>
                    <tbody>{items_html}</tbody>
                    <tfoot><tr style="border-top:2px solid #0A2342">
                        <td style="padding:8px;font-weight:bold;color:#0A2342">Totale</td>
                        <td style="padding:8px;font-weight:bold;color:#0A2342;text-align:right">€{total}</td>
                    </tr></tfoot>
                </table>
                {note_html}
            </div>
        </div>
        """
        asyncio.create_task(send_email_notification(
            owner["email"],
            f"Preventivo ricevuto - Ticket #{ticket_id} - YachtAssist",
            owner_html
        ))

    return {"success": True, "total": total}

@api_router.post("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    request: CloseTicketRequest,
    user_id: str,
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    if ticket.get("technician_id") != user_id:
        raise HTTPException(
            status_code=403,
            detail="Solo il tecnico assegnato può chiudere l'intervento",
        )

    if ticket["status"] == "chiuso":
        return {"success": True}

    if ticket["status"] != "confermato":
        raise HTTPException(
            status_code=409,
            detail=f"Impossibile chiudere: il ticket deve essere in stato confermato (attuale: {ticket['status']})",
        )

    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": "chiuso", "documents": request.documents}}
    )
    if result.modified_count > 0:
        await db.yachts.update_one({"id": ticket["yacht_id"]}, {"$set": {"compliance_score": 100}})
    return {"success": True}
    
class AddPhotosRequest(BaseModel):
    photos: List[Any] = []

@api_router.post("/tickets/{ticket_id}/add-photos")
async def add_photos_to_ticket(ticket_id: str, request: AddPhotosRequest):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    current_photos = ticket.get("photos", [])
    updated_photos = current_photos + request.photos
    if len(updated_photos) > 5:
        raise HTTPException(status_code=400, detail="Massimo 5 allegati per ticket")
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"photos": updated_photos}}
    )
    return {"success": True}

@api_router.post("/tickets/{ticket_id}/propose-appointment")
async def propose_appointment(
    ticket_id: str,
    request: ProposeAppointmentRequest,
    user_id: str,
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    if ticket.get("technician_id") != user_id:
        raise HTTPException(
            status_code=403,
            detail="Solo il tecnico assegnato può proporre disponibilità",
        )

    if ticket["status"] in ("confermato", "eseguito", "chiuso"):
        raise HTTPException(
            status_code=400,
            detail="Appuntamento già confermato, contatta il tecnico per modifiche",
        )

    if ticket["status"] != "pagato":
        raise HTTPException(status_code=400, detail="Ticket non in stato pagato")

    now_iso = datetime.now(timezone.utc).isoformat()

    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "proposed_slots": request.slots,
            "appointment_proposed_at": now_iso,
        }},
    )

    return {
        "success": True,
        "proposed_slots": request.slots,
        "appointment_proposed_at": now_iso,
    }

@api_router.post("/tickets/{ticket_id}/confirm-appointment")
async def confirm_appointment(
    ticket_id: str,
    request: ConfirmAppointmentRequest,
    user_id: str,
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    if ticket.get("owner_id") != user_id:
        raise HTTPException(
            status_code=403,
            detail="Solo il proprietario può confermare l'appuntamento",
        )

    if ticket["status"] in ("confermato", "eseguito", "chiuso"):
        raise HTTPException(
            status_code=400,
            detail="Appuntamento già confermato, contatta il tecnico per modifiche",
        )

    if ticket["status"] != "pagato":
        raise HTTPException(status_code=400, detail="Ticket non in stato pagato")

    if not ticket.get("proposed_slots"):
        raise HTTPException(
            status_code=400,
            detail="Nessuno slot disponibile: il tecnico deve prima proporre la disponibilità",
        )

    final_location = request.location
    final_lat = request.lat
    final_lng = request.lng
    if final_location is None or final_lat is None or final_lng is None:
        yacht = await db.yachts.find_one({"id": ticket.get("yacht_id", "")}, {"_id": 0})
        if yacht:
            if final_location is None:
                final_location = yacht.get("marina", "")
            if final_lat is None:
                final_lat = yacht.get("marina_lat")
            if final_lng is None:
                final_lng = yacht.get("marina_lng")
    if final_location is None:
        final_location = ticket.get("marina", "")

    dt_iso = datetime.fromisoformat(request.scheduled_at).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    new_appointment = {
        "datetime": dt_iso,
        "location": final_location,
        "lat": final_lat,
        "lng": final_lng,
    }

    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "appointment": new_appointment,
            "status": "confermato",
            "appointment_confirmed_at": now_iso,
        }},
    )

    return {
        "success": True,
        "appointment": new_appointment,
        "status": "confermato",
        "appointment_confirmed_at": now_iso,
    }

@api_router.post("/ai/diagnose")
async def ai_diagnose(request: DiagnoseRequest):
    """Analisi AI del problema nautico con Claude"""
    try:
        message = await asyncio.to_thread(
            anthropic_client.messages.create,
            model="claude-opus-4-6",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": f"""Sei un esperto tecnico nautico italiano. Analizza questo problema su un'imbarcazione e rispondi SOLO con un JSON valido, senza markdown, senza testo aggiuntivo.

Categoria: {request.category}
Problema descritto: {request.description}

Rispondi esattamente con questo JSON:
{{
  "causa": "breve descrizione della possibile causa (max 15 parole)",
  "urgency": "urgente oppure normale",
  "note": "consiglio pratico breve (max 20 parole)"
}}"""
            }]
        )
        result = json.loads(message.content[0].text)
        return result
    except json.JSONDecodeError:
        logger.error("AI response non è JSON valido")
        raise HTTPException(status_code=500, detail="Errore parsing risposta AI")
    except Exception as e:
        logger.error(f"AI diagnose error: {str(e)}")
        raise HTTPException(status_code=500, detail="Errore AI")

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

AI_CHAT_SYSTEM_PROMPT = (
    "Sei un assistente esperto di nautica da diporto e della piattaforma YachtAssist. "
    "Rispondi SEMPRE in italiano, in modo chiaro, pratico e cortese.\n\n"
    "Competenze:\n"
    "- Normativa D.M. 133/2024 sulla sicurezza delle imbarcazioni da diporto "
    "(checklist, compliance, obblighi del proprietario).\n"
    "- Funzionamento della piattaforma YachtAssist: richiesta interventi, "
    "gestione preventivi, pagamenti, selezione di tecnici certificati.\n"
    "- Consigli generali di manutenzione, sicurezza e buone pratiche nautiche.\n\n"
    "Regole:\n"
    "- Non hai accesso ai dati personali dell'utente, né al suo ticket o profilo. "
    "Se l'utente ti chiede informazioni specifiche sul suo account, indirizzalo "
    "alla dashboard o all'area ticket.\n"
    "- Per domande non nautiche o fuori scope (fiscali, legali non nautici, "
    "medicina, ecc.) rispondi gentilmente che non sei l'interlocutore "
    "adeguato e, se possibile, suggerisci una fonte ufficiale.\n"
    "- Risposte sintetiche (max 5-6 frasi) quando possibile."
)

@api_router.post("/ai/chat")
async def ai_chat(request: ChatRequest):
    """Chatbot nautico e YachtAssist (Claude Opus 4.6)."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="Nessun messaggio fornito")
    try:
        payload = [{"role": m.role, "content": m.content} for m in request.messages]
        message = await asyncio.to_thread(
            anthropic_client.messages.create,
            model="claude-opus-4-6",
            max_tokens=700,
            system=AI_CHAT_SYSTEM_PROMPT,
            messages=payload,
        )
        reply = message.content[0].text
        return {"reply": reply}
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Errore AI")

@api_router.get("/reset-demo")
async def reset_demo(secret: str = ""):
    if secret != os.environ.get("RESET_SECRET", "yachtassist-reset-2026"):
        raise HTTPException(status_code=403, detail="Non autorizzato")
    await seed_data(force_reset=True)
    logger.info("Demo data reset to initial state")
    return {"status": "ok", "message": "Demo reset completato"}
    
@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Invia email di reset password"""
    user = await db.users.find_one({"email": request.email})
    if not user:
        # Non rivelare se l'email esiste o no
        return {"success": True, "message": "Se l'email esiste riceverai un link di reset"}
    
    # Genera token sicuro
    import secrets
    from datetime import timedelta
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    # Salva token nel DB
    await db.password_resets.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": request.email,
        "expires_at": expires_at,
        "used": False
    })
    
    # URL frontend
    frontend_url = os.environ.get("FRONTEND_URL", "https://gallant-beauty-production-c7e2.up.railway.app")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    reset_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0A2342, #1D9E75); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">YachtAssist</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px;">
            <p style="color: #0A2342; font-size: 16px;">Ciao,</p>
            <p style="color: #64748b;">Hai richiesto il reset della password per il tuo account YachtAssist.</p>
            <p style="color: #64748b;">Clicca il pulsante qui sotto per impostare una nuova password. Il link scade tra <strong>1 ora</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}"
                   style="background:#1D9E75;color:white;
                   padding:14px 28px;border-radius:8px;
                   text-decoration:none;font-weight:bold;
                   font-size:16px;">
                    Reimposta Password
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">Se non hai richiesto il reset, ignora questa email.</p>
        </div>
    </div>
    """
    reset_text = (
        "Ciao,\n\n"
        "Hai richiesto il reset della password per il tuo account YachtAssist.\n\n"
        f"Clicca il link qui sotto per impostare una nuova password (scade tra 1 ora):\n\n"
        f"{reset_link}\n\n"
        "Se non hai richiesto il reset, ignora questa email."
    )
    asyncio.create_task(send_email_notification(request.email, "Reset password - YachtAssist", reset_html, reset_text))
    return {"success": True, "message": "Se l'email esiste riceverai un link di reset"}


@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reimposta password con token valido"""
    from datetime import timedelta
    
    reset_doc = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    })
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Token non valido o già utilizzato")
    
    # Verifica scadenza
    expires_at = datetime.fromisoformat(reset_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Token scaduto. Richiedi un nuovo link.")
    
    # Aggiorna password
    new_hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"id": reset_doc["user_id"]},
        {"$set": {"password": new_hashed}}
    )
    
    # Marca token come usato
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )
    
    return {"success": True, "message": "Password aggiornata con successo"}

class CreateYachtRequest(BaseModel):
    nome: str
    modello: str
    tipo: str = "motore"
    anno: Optional[str] = None
    lunghezza: Optional[str] = None
    marina: str
    marina_lat: Optional[float] = None
    marina_lng: Optional[float] = None

@api_router.post("/yachts/create")
async def create_yacht(request: CreateYachtRequest, user_id: str):
    """Crea una nuova imbarcazione per l'owner"""
    existing = await db.yachts.find_one({"owner_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Hai già un'imbarcazione registrata")
    
    yacht_id = f"yacht-{uuid.uuid4().hex[:8]}"
    yacht_doc = {
        "id": yacht_id,
        "name": request.nome,
        "model": request.modello,
        "owner_id": user_id,
        "marina": request.marina,
        "marina_lat": request.marina_lat,
        "marina_lng": request.marina_lng,
        "category": request.tipo.capitalize(),
        "distance": "",
        "compliance_score": 0,
        "anno": request.anno,
        "lunghezza": request.lunghezza,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.yachts.insert_one(yacht_doc)
    # Genera checklist D.M. 133/2024 standard per la nuova barca
    checklist_items = [
        {"id": f"{yacht_id}-item-1", "yacht_id": yacht_id, "name": "Giubbotti 150N con luce automatica", "status": "mancante", "is_new_2025": True},
        {"id": f"{yacht_id}-item-2", "yacht_id": yacht_id, "name": "Salvagente anulare con boetta", "status": "mancante", "is_new_2025": False},
        {"id": f"{yacht_id}-item-3", "yacht_id": yacht_id, "name": "Zattera di salvataggio", "status": "mancante", "is_new_2025": True},
        {"id": f"{yacht_id}-item-4", "yacht_id": yacht_id, "name": "Razzi a paracadute × 2", "status": "mancante", "is_new_2025": False},
        {"id": f"{yacht_id}-item-5", "yacht_id": yacht_id, "name": "Radio VHF", "status": "mancante", "is_new_2025": False},
        {"id": f"{yacht_id}-item-6", "yacht_id": yacht_id, "name": "Iscrizione ATCN", "status": "mancante", "is_new_2025": True}
    ]
    await db.checklist_items.insert_many(checklist_items)
    yacht_doc.pop("_id", None)
    return {"yacht": yacht_doc, "success": True}
api_router.include_router(payments_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

