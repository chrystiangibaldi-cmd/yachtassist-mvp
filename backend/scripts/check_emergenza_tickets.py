import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        print("ERROR: MONGO_URL not set in environment")
        return
    client = AsyncIOMotorClient(mongo_url)
    db = client.yachtassist
    cur = db.tickets.find(
        {"$or": [{"category": "emergenza"}, {"category": "Emergenza"}, {"category": "EMERGENZA"}]},
        {"_id": 0, "id": 1, "category": 1, "status": 1, "owner_id": 1, "created_at": 1}
    )
    found = await cur.to_list(100)
    print(f"Found {len(found)} tickets with category emergenza:")
    for t in found:
        print(f"  {t.get('id'):20} | category={t.get('category'):15} | status={t.get('status'):12} | owner={t.get('owner_id'):20} | {t.get('created_at')}")

asyncio.run(main())
