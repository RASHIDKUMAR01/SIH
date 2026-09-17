"""
Automated Test for SkyGuard AI Authentication Pipeline.
Tests:
1. Valid credentials login ('admin', 'SkyGuard@2026') -> 200, JWT token returned
2. Invalid credentials login ('admin', 'WrongPass') -> 401, 'INVALID CREDENTIALS'
3. Invalid username login ('hacker', 'SkyGuard@2026') -> 401, 'INVALID CREDENTIALS'
4. Verify session token -> 200 with user profile
5. Verify invalid/tampered token -> 401
6. Logout endpoint -> 200
"""
import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)
    
    print("Testing SkyGuard AI Authentication Endpoints...")
    
    # Test 1: Valid Login
    res1 = client.post("/api/auth/login", json={"username": "admin", "password": "SkyGuard@2026", "remember_me": True})
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
    data1 = res1.json()
    assert data1.get("success") is True
    assert "token" in data1
    token = data1["token"]
    assert data1["user"]["username"] == "admin"
    print("[PASS] Test 1: Valid Login succeeded, token issued.")
    
    # Test 2: Invalid Password
    res2 = client.post("/api/auth/login", json={"username": "admin", "password": "WrongPassword123"})
    assert res2.status_code == 401, f"Expected 401, got {res2.status_code}"
    assert "INVALID CREDENTIALS" in res2.text
    print("[PASS] Test 2: Invalid Password rejected with 'INVALID CREDENTIALS'.")
    
    # Test 3: Invalid Username
    res3 = client.post("/api/auth/login", json={"username": "random_intruder", "password": "SkyGuard@2026"})
    assert res3.status_code == 401, f"Expected 401, got {res3.status_code}"
    assert "INVALID CREDENTIALS" in res3.text
    print("[PASS] Test 3: Invalid Username rejected with 'INVALID CREDENTIALS'.")
    
    # Test 4: Token Verification
    res4 = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert res4.status_code == 200, f"Expected 200, got {res4.status_code}: {res4.text}"
    data4 = res4.json()
    assert data4.get("valid") is True
    assert data4["user"]["username"] == "admin"
    print("[PASS] Test 4: Token verification valid and returned user profile.")
    
    # Test 5: Tampered Token
    res5 = client.get("/api/auth/verify", headers={"Authorization": "Bearer fake.tampered.signature"})
    assert res5.status_code == 401, f"Expected 401, got {res5.status_code}"
    print("[PASS] Test 5: Tampered token rejected.")
    
    # Test 6: Logout
    res6 = client.post("/api/auth/logout")
    assert res6.status_code == 200
    print("[PASS] Test 6: Logout confirmed.")
    
    print("\nALL AUTHENTICATION TESTS PASSED (6/6)!")

if __name__ == "__main__":
    run_tests()
