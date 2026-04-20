from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
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

# Calcola commissione YachtAssist secondo scala tariffaria
def calculate_commission(amount_euros: int) -> dict:
    if amount_euros <= 100:
        rate = 0.20
    elif amount_euros <= 300:
        rate = 0.15
    elif amount_euros <= 1000:
        rate = 0.12
    elif amount_euros <= 3000:
        rate = 0.10
    else:
        rate = 0.08
    commission = round(amount_euros * rate)
    payout = amount_euros - commission
    return {"commission": commission, "payout": payout, "rate": rate}

@payments_router.post("/create-intent")
async def create_payment_intent(ticket_id: str):
    """Crea PaymentIntent Stripe per il ticket specificato"""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe non configurato")

    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trovato")

    if ticket["status"] == "chiuso":
        raise HTTPException(status_code=400, detail="Ticket già pagato e chiuso")

    amount_euros = ticket.get("final_price") or ticket.get("price_max", 0)
    if amount_euros <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    commission_data = calculate_commission(amount_euros)

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_euros * 100,  # Stripe vuole centesimi
            currency="eur",
            automatic_payment_methods={"enabled": True},
            metadata={
                "ticket_id": ticket_id,
                "owner_id": ticket.get("owner_id", ""),
                "technician_id": ticket.get("technician_id", ""),
                "commission": str(commission_data["commission"]),
                "payout": str(commission_data["payout"]),
            },
            description=f"YachtAssist - Ticket {ticket_id}",
        )

        # Salva i dati commissione nel ticket
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "final_price": amount_euros,
                "commission": commission_data["commission"],
                "technician_payment": commission_data["payout"],
                "stripe_payment_intent_id": intent.id,
                "payment_status": "pending"
            }}
        )

        return {
            "client_secret": intent.client_secret,
            "amount": amount_euros,
            "commission": commission_data["commission"],
            "payout": commission_data["payout"],
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
                # Chiudi il ticket e aggiorna compliance
                await db.tickets.update_one(
                    {"id": ticket_id},
                    {"$set": {
                        "status": "chiuso",
                        "payment_status": "paid"
                    }}
                )
                await db.yachts.update_one(
                    {"id": ticket.get("yacht_id", "")},
                    {"$set": {"compliance_score": 100}}
                )
                logger.info(f"Ticket {ticket_id} chiuso dopo pagamento Stripe")

    return {"received": True}
