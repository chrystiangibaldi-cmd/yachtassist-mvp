"""Backfill yacht marina_lat/marina_lng via Google Geocoding API.

Run with MONGO_URL and GOOGLE_MAPS_API_KEY in the environment:
    MONGO_URL="mongodb://..." GOOGLE_MAPS_API_KEY="AIza..." \
        python scripts/backfill_yacht_coords.py [--dry]

Idempotent: filters only yachts missing marina_lat or marina_lng
(either field None or absent) AND with a non-empty `marina` string.
--dry prints matches without writing to Mongo.

Rate-limited at 10 QPS (time.sleep(0.1) between calls). Google
Geocoding free tier is far higher; this stays conservative.
"""
import os
import sys
import time

import requests
from pymongo import MongoClient

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
RATE_LIMIT_SLEEP = 0.1
FATAL_STATUSES = {"REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST"}

mongo_url = os.environ.get("MONGO_URL")
api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
if not mongo_url:
    print("ERROR: MONGO_URL env var is required", file=sys.stderr)
    sys.exit(1)
if not api_key:
    print("ERROR: GOOGLE_MAPS_API_KEY env var is required", file=sys.stderr)
    sys.exit(1)

dry_run = "--dry" in sys.argv

client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
db = client[os.environ.get("DB_NAME", "yachtassist")]

query = {
    "$or": [
        {"marina_lat": None},
        {"marina_lng": None},
        {"marina_lat": {"$exists": False}},
        {"marina_lng": {"$exists": False}},
    ],
    "marina": {"$nin": [None, ""]},
}
yachts = list(db.yachts.find(query, {"_id": 0}))
print(f"Found {len(yachts)} yacht(s) without coords and with non-empty marina")
if dry_run:
    print("DRY RUN: no writes will be performed\n")
else:
    print()

updated = 0
skipped = 0

for y in yachts:
    yid = y.get("id")
    marina = y.get("marina", "")
    try:
        resp = requests.get(
            GEOCODE_URL,
            params={"address": marina, "key": api_key},
            timeout=10,
        )
        data = resp.json()
    except Exception as e:
        print(f"  {yid} | marina={marina!r} | HTTP ERROR: {e}")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    status = data.get("status", "UNKNOWN")

    if status in FATAL_STATUSES:
        print(f"  {yid} | marina={marina!r} | FATAL: {status}")
        print(
            "\nABORT: Geocoding API non abilitata o key non autorizzata "
            "su GCP project yachtassist-492114, abilitare prima su "
            "console.cloud.google.com"
        )
        sys.exit(2)

    if status == "ZERO_RESULTS":
        print(f"  {yid} | marina={marina!r} | WARN: ZERO_RESULTS, skip")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    if status != "OK":
        print(f"  {yid} | marina={marina!r} | UNEXPECTED status: {status}, skip")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    try:
        loc = data["results"][0]["geometry"]["location"]
        lat = float(loc["lat"])
        lng = float(loc["lng"])
    except (KeyError, IndexError, TypeError, ValueError) as e:
        print(f"  {yid} | marina={marina!r} | PARSE ERROR: {e}, skip")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    print(f"  {yid} | marina={marina!r} | lat={lat} lng={lng} | OK")
    if not dry_run:
        db.yachts.update_one(
            {"id": yid},
            {"$set": {"marina_lat": lat, "marina_lng": lng}},
        )
    updated += 1
    time.sleep(RATE_LIMIT_SLEEP)

print(f"\nUpdated: {updated}, Skipped: {skipped}, Total: {len(yachts)}")
if dry_run:
    print("DRY RUN: no changes persisted")
