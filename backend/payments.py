from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import stripe
import os
import logging

logger = logging.getLogger(__name__)

payments_router = APIRouter(prefix="/payments")

# Stripe config
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

# DB reference - viene iniettata da server.py
db = None

def set_db(database):
    global db
    db = database

# Calcola commissione YachtAssist secondo scala tariffaria.
# Scaglioni decisione 27 apr 2026 (per valore singolo ticket):
#   €0     - €300    : 15%
#   €301   - €1.000  : 10%
#   €1.001 - €3.000  : 8%
#   €3.001+          : 5%
# Curva regressiva: ticket piccoli sussidiano costi fissi piattaforma,
# ticket grandi premiano tecnici di alto profilo.
#
# Se technician_id è passato e quel tecnico ha commission_override
# popolato sul TechnicianProfile, l'override sostituisce gli scaglioni
# (es. 0.05 per abbonamento premium 2027 o accordi bilaterali pre-beta).
#
# Welcome bonus (BP v6, acquisizione tecnici Scenario B): se
# welcome_bonus=True, applica -5pp al rate finale (dopo override o
# scaglione) con floor 0% via max(0.0, ...). Si applica anche su
# commission_override (no skip premium). Triggerato dal call site solo
# per il primissimo preventivo EVER del tecnico.
async def calculate_commission(
    amount_euros: int,
    *,
    technician_id: Optional[str] = None,
    welcome_bonus: bool = False,
) -> dict:
    rate = None

    if technician_id and db is not None:
        tech_profile = await db.technician_profiles.find_one(
            {"id": technician_id}, {"_id": 0}
        )
        if tech_profile and tech_profile.get("commission_override") is not None:
            rate = tech_profile["commission_override"]

    if rate is None:
        if amount_euros <= 300:
            rate = 0.15
        elif amount_euros <= 1000:
            rate = 0.10
        elif amount_euros <= 3000:
            rate = 0.08
        else:
            rate = 0.05

    if welcome_bonus:
        rate = max(0.0, round(rate - 0.05, 4))

    commission = round(amount_euros * rate)
    payout = amount_euros - commission
    return {
        "commission": commission,
        "payout": payout,
        "rate": rate,
        "welcome_bonus_applied": welcome_bonus,
    }

@payments_router.post("/create-intent")
async def create_payment_intent(ticket_id: str):
    """Crea PaymentIntent Stripe per il ticket specificato"""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe non configurato")

    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    if ticket["status"] in ("chiuso", "pagato"):
        raise HTTPException(status_code=400, detail="Ticket già pagato")

    # Authoritative path: submit_quote ha già scritto commission/payout/rate.
    # Self-heal per ticket pre-refactor che mancano dei valori salvati.
    final_price = ticket.get("final_price")
    if final_price is None or final_price <= 0:
        raise HTTPException(
            status_code=422,
            detail="Preventivo non completo: impossibile creare PaymentIntent"
        )

    commission = ticket.get("commission")
    payout = ticket.get("technician_payment")

    if commission is None or payout is None:
        commission_data = await calculate_commission(
            int(final_price),
            technician_id=ticket.get("technician_id"),
        )
        commission = commission_data["commission"]
        payout = commission_data["payout"]
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "commission": commission,
                "technician_payment": payout,
                "commission_rate": commission_data["rate"],
            }}
        )

    amount_euros = final_price

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_euros * 100,  # Stripe vuole centesimi
            currency="eur",
            automatic_payment_methods={"enabled": True},
            metadata={
                "ticket_id": ticket_id,
                "owner_id": ticket.get("owner_id", ""),
                "technician_id": ticket.get("technician_id", ""),
                "commission": str(commission),
                "payout": str(payout),
            },
            description=f"YachtAssist - Ticket {ticket_id}",
        )

        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "stripe_payment_intent_id": intent.id,
                "payment_status": "pending"
            }}
        )

        return {
            "client_secret": intent.client_secret,
            "amount": amount_euros,
            "commission": commission,
            "payout": payout,
            "payment_intent_id": intent.id
        }

    except stripe.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@payments_router.post("/webhook")
async def stripe_webhook(request: Request):
    """Riceve eventi da Stripe e aggiorna lo stato del ticket"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET non configurato")
        raise HTTPException(status_code=500, detail="Webhook secret mancante")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        logger.error("Webhook signature non valida")
        raise HTTPException(status_code=400, detail="Firma webhook non valida")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        ticket_id = intent["metadata"].get("ticket_id")

        if ticket_id:
            ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
            if ticket:
                if ticket.get("status") == "pagato":
                    logger.info(f"Ticket {ticket_id} già 'pagato', webhook idempotente: skip")
                    return {"received": True, "status": "already_processed"}
                await db.tickets.update_one(
                    {"id": ticket_id},
                    {"$set": {
                        "status": "pagato",
                        "payment_status": "paid"
                    }}
                )
                logger.info(f"Ticket {ticket_id} transizionato a 'pagato' dopo pagamento Stripe")

    return {"received": True}
