"""Backfill technician_profiles.marina_lat/marina_lng via Google Geocoding API.

Run with MONGO_URL and GOOGLE_MAPS_API_KEY in the environment:
    MONGO_URL="mongodb://..." GOOGLE_MAPS_API_KEY="AIza..." \
        python scripts/backfill_technician_coords.py [--dry]

Two-attempt geocoding strategy per technician:
  1. Prefix form: "Marina di {location}" (e.g. "Marina di Livorno")
  2. Fallback: raw `location` string (e.g. "Livorno")
Log tags which attempt succeeded: "prefix" or "fallback_raw".
If both attempts return ZERO_RESULTS, technician is skipped.
Any FATAL status aborts the whole run.

Idempotent: filters only technician_profiles missing marina_lat or
marina_lng (either field None or absent) AND with a non-empty
`location` string. --dry prints matches without writing to Mongo.

Rate-limited at 10 QPS (time.sleep(0.1) between calls).
"""
import os
import sys
import time

import requests
from pymongo import MongoClient

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
RATE_LIMIT_SLEEP = 0.1
FATAL_STATUSES = {"REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST"}
PREFIX_TEMPLATE = "Marina di {}"

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
    "location": {"$nin": [None, ""]},
}
technicians = list(db.technician_profiles.find(query, {"_id": 0}))
print(f"Found {len(technicians)} technician(s) without coords and with non-empty location")
if dry_run:
    print("DRY RUN: no writes will be performed\n")
else:
    print()


def geocode(address):
    """Return (status, lat, lng) or raise for network errors."""
    resp = requests.get(
        GEOCODE_URL,
        params={"address": address, "key": api_key},
        timeout=10,
    )
    data = resp.json()
    status = data.get("status", "UNKNOWN")
    if status != "OK":
        return status, None, None
    try:
        loc = data["results"][0]["geometry"]["location"]
        return "OK", float(loc["lat"]), float(loc["lng"])
    except (KeyError, IndexError, TypeError, ValueError):
        return "PARSE_ERROR", None, None


def abort_fatal(status, tech_id, location, attempt):
    print(f"  {tech_id} | location={location!r} | attempt={attempt} | FATAL: {status}")
    print(
        "\nABORT: Geocoding API non abilitata o key non autorizzata "
        "su GCP project yachtassist-492114, abilitare prima su "
        "console.cloud.google.com"
    )
    sys.exit(2)


updated = 0
skipped = 0

for t in technicians:
    tid = t.get("id")
    location = t.get("location", "")
    loc_stripped = location.strip()
    if loc_stripped.lower().startswith("marina di "):
        prefixed = loc_stripped
        via_label = "as_is"
    else:
        prefixed = PREFIX_TEMPLATE.format(loc_stripped)
        via_label = "prefix"

    # Attempt 1: prefix or as-is form
    try:
        status, lat, lng = geocode(prefixed)
    except Exception as e:
        print(f"  {tid} | location={location!r} | attempt={via_label} | HTTP ERROR: {e}")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    if status in FATAL_STATUSES:
        abort_fatal(status, tid, location, via_label)

    if status == "OK":
        if via_label == "as_is":
            print(f"  {tid} | location={location!r} | as_is | lat={lat} lng={lng} | OK")
        else:
            print(f"  {tid} | location={location!r} | prefix ({prefixed!r}) | lat={lat} lng={lng} | OK")
        if not dry_run:
            db.technician_profiles.update_one(
                {"id": tid},
                {"$set": {"marina_lat": lat, "marina_lng": lng}},
            )
        updated += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    if status != "ZERO_RESULTS":
        # Unexpected non-OK, non-FATAL, non-ZERO_RESULTS (e.g. PARSE_ERROR)
        print(f"  {tid} | location={location!r} | attempt={via_label} | UNEXPECTED status: {status}, trying fallback")

    # Attempt 2: fallback raw location
    time.sleep(RATE_LIMIT_SLEEP)
    try:
        status, lat, lng = geocode(location)
    except Exception as e:
        print(f"  {tid} | location={location!r} | attempt=fallback_raw | HTTP ERROR: {e}")
        skipped += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    if status in FATAL_STATUSES:
        abort_fatal(status, tid, location, "fallback_raw")

    if status == "OK":
        print(f"  {tid} | location={location!r} | fallback_raw | lat={lat} lng={lng} | OK")
        if not dry_run:
            db.technician_profiles.update_one(
                {"id": tid},
                {"$set": {"marina_lat": lat, "marina_lng": lng}},
            )
        updated += 1
        time.sleep(RATE_LIMIT_SLEEP)
        continue

    if status == "ZERO_RESULTS":
        print(f"  {tid} | location={location!r} | WARN: ZERO_RESULTS su entrambi i tentativi, skip")
    else:
        print(f"  {tid} | location={location!r} | attempt=fallback_raw | UNEXPECTED status: {status}, skip")
    skipped += 1
    time.sleep(RATE_LIMIT_SLEEP)


print(f"\nUpdated: {updated}, Skipped: {skipped}, Total: {len(technicians)}")
if dry_run:
    print("DRY RUN: no changes persisted")
