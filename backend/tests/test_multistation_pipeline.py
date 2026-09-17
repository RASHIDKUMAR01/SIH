"""
Unit and Integration Tests for SIH26073 Local Brain V4 Multi-Station Mesonet Architecture.
Tests:
1. LocalBrain evaluation (trust score, local status, fault types)
2. SpatialAnalyzer (haversine distance, neighborhood agreement)
3. GlobalBrain (7 diagnostic categories, multi-station spatial-temporal consensus)
4. MesonetSimulator (multi-station generation, scenarios A-E)
5. FastAPI Multi-Station Endpoints (/api/stations, /api/stations/spatial-map, /api/stations/select-primary, /api/simulator/scenario)
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db
from app.ml.local_brain import LocalBrain
from app.ml.spatial_analyzer import SpatialAnalyzer, haversine_distance
from app.ml.global_brain import GlobalBrain
from app.simulator.mesonet_network import MesonetSimulator, mesonet_manager


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_local_brain_nominal():
    brain = LocalBrain("AWS-TEST-01")
    report = brain.evaluate_reading({
        "temperature": 25.0,
        "pressure": 1013.25,
        "humidity": 65.0,
        "wind_speed": 4.5,
        "solar_radiation": 600.0,
        "wind_direction": 180.0,
        "battery_voltage": 12.6,
        "is_reporting": True,
    })
    assert report["local_status"] == "NORMAL"
    assert report["fault_type"] == "NOMINAL"
    assert report["trust_score"] >= 0.85
    assert not report["is_flagged"]


def test_local_brain_spike_and_boundary():
    brain = LocalBrain("AWS-TEST-02")
    report = brain.evaluate_reading({
        "temperature": 85.0, # Exceeds boundary
        "pressure": 1013.25,
        "humidity": 65.0,
        "wind_speed": 4.5,
    })
    assert report["local_status"] in ("ANOMALY", "WARNING")
    assert report["is_flagged"] is True
    assert "temperature" in report["boundary_violations"]
    assert report["trust_score"] < 0.80


def test_spatial_analyzer_haversine():
    # Distance between AWS-01 (Vellore Central: 12.9165, 79.1325) and AWS-02 (Katpadi: 12.9698, 79.1350)
    dist = haversine_distance(12.9165, 79.1325, 12.9698, 79.1350)
    # Approx 5.9 km
    assert 5.0 <= dist <= 7.0


def test_mesonet_simulator_all_scenarios():
    sim = MesonetSimulator()
    
    # Scenario E: Nominal
    sim.trigger_scenario("SCENARIO_E_NOMINAL")
    step_e = sim.step()
    fleet_e = step_e["stations"]
    assert len(fleet_e) == 5
    for st in fleet_e:
        assert st["is_reporting"] is True
        assert st["local_status"] in ("NORMAL", "WARNING")

    # Scenario A: Localized Anomaly on AWS-01
    sim.trigger_scenario("SCENARIO_A_LOCALIZED_SPIKE")
    step_a = sim.step()
    fleet_a = step_a["stations"]
    aws01 = next(s for s in fleet_a if s["station_id"] == "AWS-01")
    assert aws01["temperature"] > 40.0
    assert aws01["local_status"] == "ANOMALY"

    # Scenario B: Regional Storm
    sim.trigger_scenario("SCENARIO_B_REGIONAL_STORM")
    step_b = sim.step()
    fleet_b = step_b["stations"]
    for st in fleet_b:
        assert st["wind_speed"] >= 18.0
        assert st["pressure"] < 1000.0

    # Scenario C: Sensor Drift on AWS-02
    sim.trigger_scenario("SCENARIO_C_SENSOR_DRIFT")
    for _ in range(3):
        step_c = sim.step()
    fleet_c = step_c["stations"]
    aws02 = next(s for s in fleet_c if s["station_id"] == "AWS-02")
    assert aws02["temperature"] > 30.0

    # Scenario D: Comm Dropout on AWS-04
    sim.trigger_scenario("SCENARIO_D_COMM_DROPOUT")
    step_d = sim.step()
    fleet_d = step_d["stations"]
    aws04 = next(s for s in fleet_d if s["station_id"] == "AWS-04")
    assert aws04["is_reporting"] is False
    assert aws04["local_status"] == "OFFLINE"


def test_global_brain_classification_scenarios():
    gb = GlobalBrain()
    
    # Test Regional Storm consensus
    storm_readings = [
        {"station_id": "AWS-01", "temperature": 22.0, "pressure": 985.0, "humidity": 95.0, "wind_speed": 26.0, "is_reporting": True, "trust_score": 0.95, "latitude": 12.9165, "longitude": 79.1325},
        {"station_id": "AWS-02", "temperature": 21.5, "pressure": 986.0, "humidity": 94.0, "wind_speed": 25.0, "is_reporting": True, "trust_score": 0.94, "latitude": 12.9698, "longitude": 79.1350},
        {"station_id": "AWS-03", "temperature": 21.8, "pressure": 985.5, "humidity": 96.0, "wind_speed": 27.0, "is_reporting": True, "trust_score": 0.96, "latitude": 12.9229, "longitude": 79.3323},
    ]
    diag = gb.diagnose(storm_readings[0], storm_readings[1:], is_ml_anomaly=True)
    assert diag["diagnosis_category"] == "GENUINE WEATHER EVENT"
    assert diag["spatial_agreement_pct"] >= 70.0

    # Test Localized Spike consensus
    isolated_spike = {"station_id": "AWS-01", "temperature": 52.0, "pressure": 1012.0, "humidity": 60.0, "wind_speed": 3.0, "is_reporting": True, "trust_score": 0.40, "latitude": 12.9165, "longitude": 79.1325}
    normal_neighbors = [
        {"station_id": "AWS-02", "temperature": 28.0, "pressure": 1012.0, "humidity": 60.0, "wind_speed": 3.0, "is_reporting": True, "trust_score": 0.98, "latitude": 12.9698, "longitude": 79.1350},
        {"station_id": "AWS-03", "temperature": 28.2, "pressure": 1011.8, "humidity": 61.0, "wind_speed": 3.2, "is_reporting": True, "trust_score": 0.97, "latitude": 12.9229, "longitude": 79.3323},
    ]
    diag_isolated = gb.diagnose(isolated_spike, normal_neighbors, is_ml_anomaly=True)
    assert diag_isolated["diagnosis_category"] in ("SENSOR FAULT", "UNKNOWN ANOMALY")


def test_api_stations_endpoints(client):
    # 1. Fetch stations list
    res = client.get("/api/stations")
    assert res.status_code == 200
    data = res.json()
    assert "stations" in data
    assert len(data["stations"]) >= 5
    assert "network_health" in data
    assert "active_scenario" in data

    # 2. Fetch specific station
    res_st = client.get("/api/stations/AWS-01")
    assert res_st.status_code == 200
    st_data = res_st.json()
    assert st_data["station_id"] == "AWS-01"

    # 3. Fetch spatial map
    res_map = client.get("/api/stations/spatial-map")
    assert res_map.status_code == 200
    map_data = res_map.json()
    assert "spatial_topology" in map_data
    assert len(map_data["spatial_topology"]) >= 5

    # 4. Select primary station
    res_sel = client.post("/api/stations/select-primary?station_id=AWS-02")
    assert res_sel.status_code == 200
    sel_data = res_sel.json()
    assert sel_data["primary_station_id"] == "AWS-02"

    # 5. Trigger scenario
    res_sc = client.post("/api/simulator/scenario", json={"scenario_key": "SCENARIO_B_REGIONAL_STORM"})
    assert res_sc.status_code == 200
    sc_data = res_sc.json()
    assert sc_data["active_scenario"] == "SCENARIO_B_REGIONAL_STORM"

    # Reset back to nominal
    client.post("/api/simulator/scenario", json={"scenario_key": "SCENARIO_E_NOMINAL"})
    client.post("/api/stations/select-primary?station_id=AWS-01")
