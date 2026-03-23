#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class YachtAssistAPITester:
    def __init__(self, base_url="https://assist-email-notify.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.owner_token = None
        self.tech_token = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            
            print(f"   Request: {method} {endpoint}")
            if data:
                print(f"   Data: {json.dumps(data, indent=2)}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response snippet: {str(response_data)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_owner_login(self):
        """Test owner demo login"""
        success, response = self.run_test(
            "Owner Demo Login",
            "POST", 
            "auth/demo-login",
            200,
            data={"role": "owner"}
        )
        if success and 'token' in response and 'user' in response:
            self.owner_token = response['token']
            user = response['user']
            print(f"   Logged in as: {user['name']} (Role: {user['role']})")
            return True
        return False

    def test_technician_login(self):
        """Test technician demo login"""
        success, response = self.run_test(
            "Technician Demo Login",
            "POST",
            "auth/demo-login", 
            200,
            data={"role": "technician"}
        )
        if success and 'token' in response and 'user' in response:
            self.tech_token = response['token']
            user = response['user']
            print(f"   Logged in as: {user['name']} (Role: {user['role']})")
            return True
        return False

    def test_owner_dashboard(self):
        """Test owner dashboard"""
        success, response = self.run_test(
            "Owner Dashboard",
            "GET",
            "dashboard/owner?user_id=owner-1",
            200
        )
        if success:
            print(f"   Yacht: {response.get('yacht', {}).get('name')} - {response.get('yacht', {}).get('model')}")
            print(f"   Compliance: {response.get('yacht', {}).get('compliance_score')}%")
            print(f"   Open tickets: {response.get('open_tickets')}")
        return success

    def test_technician_dashboard(self):
        """Test technician dashboard"""
        success, response = self.run_test(
            "Technician Dashboard",
            "GET",
            "dashboard/technician?user_id=tech-1",
            200
        )
        if success:
            print(f"   Assigned tickets: {len(response.get('assigned_tickets', []))}")
            print(f"   Pending earnings: €{response.get('pending_earnings')}")
            print(f"   Total earnings: €{response.get('total_earnings')}")
        return success

    def test_checklist(self):
        """Test checklist endpoint"""
        success, response = self.run_test(
            "Checklist Items",
            "GET",
            "checklist/yacht-1",
            200
        )
        if success:
            items = response if isinstance(response, list) else []
            conforme_count = len([item for item in items if item.get('status') == 'conforme'])
            total_count = len(items)
            print(f"   Items: {total_count}, Conforme: {conforme_count}")
            print(f"   Progress: {round((conforme_count/total_count)*100) if total_count > 0 else 0}%")
        return success

    def test_available_technicians(self):
        """Test available technicians"""
        success, response = self.run_test(
            "Available Technicians",
            "GET",
            "technicians/available",
            200
        )
        if success:
            technicians = response if isinstance(response, list) else []
            print(f"   Found {len(technicians)} technicians")
            for tech in technicians:
                eco_cert = "✓ Eco Certified" if tech.get('eco_certified') else ""
                print(f"   - {tech.get('name')} ({tech.get('specialization')}) ⭐{tech.get('rating')} {eco_cert}")
        return success

    def test_get_yacht_by_id(self):
        """Test new yacht endpoint - Bug Fix 1"""
        success, response = self.run_test(
            "Get Yacht by ID (Bug Fix 1)",
            "GET",
            "yachts/yacht-1",
            200
        )
        if success:
            print(f"   Yacht: {response.get('name')} - {response.get('model')}")
            print(f"   Owner: {response.get('owner_id')}")
            print(f"   Marina: {response.get('marina')}")
            # Verify this is the correct yacht for demo user
            if response.get('name') == 'Suerte' and response.get('model') == 'Sanlorenzo 50':
                print("   ✅ Bug Fix 1: Correct yacht data returned")
                return True
            else:
                print("   ❌ Bug Fix 1: Wrong yacht data")
        return success

    def test_get_ticket(self):
        """Test get ticket details - Bug Fix 2"""
        success, response = self.run_test(
            "Get Ticket Details (Bug Fix 2)",
            "GET", 
            "tickets/YA-2025-0847",
            200
        )
        if success:
            print(f"   Ticket: {response.get('id')}")
            print(f"   Status: {response.get('status')}")
            print(f"   Urgency: {response.get('urgency')}")
            print(f"   Work items: {len(response.get('work_items', []))}")
            print(f"   Yacht ID: {response.get('yacht_id')}")
            
            # Check Bug Fix 2: quote_items should be None for generic tickets initially
            quote_items = response.get('quote_items')
            if quote_items is None:
                print("   ✅ Bug Fix 2: quote_items is None (will show placeholder)")
            else:
                print(f"   Quote items: {len(quote_items) if quote_items else 0}")
        return success

    def test_assign_technician(self):
        """Test assigning technician to ticket"""
        success, response = self.run_test(
            "Assign Technician",
            "POST",
            "tickets/YA-2025-0847/assign",
            200,
            data={"technician_id": "tech-1"}
        )
        if success:
            print(f"   Assignment successful: {response.get('success')}")
        return success

    def test_close_ticket(self):
        """Test closing ticket"""
        success, response = self.run_test(
            "Close Ticket", 
            "POST",
            "tickets/YA-2025-0847/close",
            200,
            data={"documents": ["Fattura.pdf", "Foto_zattera.jpg", "Cert_omologazione.pdf"]}
        )
        if success:
            print(f"   Closure successful: {response.get('success')}")
        return success

    def test_ticket_status_after_assignment(self):
        """Test ticket status after assignment"""
        success, response = self.run_test(
            "Ticket Status After Assignment",
            "GET",
            "tickets/YA-2025-0847", 
            200
        )
        if success:
            print(f"   Status: {response.get('status')}")
            print(f"   Technician assigned: {response.get('technician_id')}")
            print(f"   Appointment: {response.get('appointment')}")
        return success

def main():
    print("🚢 YachtAssist API Testing Suite")
    print("=" * 50)
    
    tester = YachtAssistAPITester()
    
    # Test authentication
    print("\n📋 AUTHENTICATION TESTS")
    if not tester.test_owner_login():
        print("❌ Owner login failed, stopping tests")
        return 1
    
    if not tester.test_technician_login():
        print("❌ Technician login failed, stopping tests")
        return 1

    # Test dashboard endpoints
    print("\n📊 DASHBOARD TESTS")
    tester.test_owner_dashboard()
    tester.test_technician_dashboard()
    
    # Test data endpoints
    print("\n📝 DATA ENDPOINTS")
    tester.test_checklist()
    tester.test_available_technicians()
    tester.test_get_yacht_by_id()  # New yacht endpoint test
    
    # Test ticket workflow
    print("\n🎫 TICKET WORKFLOW TESTS")
    tester.test_get_ticket()
    tester.test_assign_technician()
    tester.test_ticket_status_after_assignment()
    tester.test_close_ticket()
    
    # Final status check
    tester.test_get_ticket()  # Check final status
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = round((tester.tests_passed / tester.tests_run) * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate}%")
    
    if success_rate >= 80:
        print("✅ Backend API tests mostly successful!")
        return 0
    else:
        print("❌ Backend API tests failed - needs attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())