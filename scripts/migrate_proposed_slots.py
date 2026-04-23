"""One-shot: normalize `proposed_slots` on existing tickets.

Dopo il fix 6b il backend espone sempre `proposed_slots: list` (mai null).
Questo script aggiorna i ticket creati prima del fix:
  - `proposed_slots: null`  -> `[]`
  - campo mancante           -> `[]`

Run con MONGO_PUBLIC_URL nell'ambiente:
    MONGO_PUBLIC_URL="mongodb://..."  python scripts/migrate_proposed_slots.py
"""
import os
import sys

from pymongo import MongoClient

url = os.environ.get("MONGO_PUBLIC_URL")
if not url:
    print("ERROR: MONGO_PUBLIC_URL env var is required", file=sys.stderr)
    sys.exit(1)

client = MongoClient(url, serverSelectionTimeoutMS=10000)
client.admin.command("ping")

system_dbs = {"admin", "local", "config"}
candidate_dbs = [n for n in client.list_database_names() if n not in system_dbs]
print("Databases available:", candidate_dbs)

filter_ = {
    "$or": [
        {"proposed_slots": None},
        {"proposed_slots": {"$exists": False}},
    ]
}

total_matched = 0
total_modified = 0
for name in candidate_dbs:
    db = client[name]
    if "tickets" not in db.list_collection_names():
        continue

    to_fix = db.tickets.count_documents(filter_)
    print(f"  {name}.tickets -> {to_fix} ticket da normalizzare")
    if to_fix == 0:
        continue

    result = db.tickets.update_many(filter_, {"$set": {"proposed_slots": []}})
    print(f"    matched={result.matched_count}, modified={result.modified_count}")
    total_matched += result.matched_count
    total_modified += result.modified_count

print(f"\nTotale matched: {total_matched}, modified: {total_modified}")
