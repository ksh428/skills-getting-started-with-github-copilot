from fastapi.testclient import TestClient
from urllib.parse import quote
from src.app import app, activities

client = TestClient(app)


def test_get_activities():
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_and_unregister_flow():
    activity = "Basketball Club"
    email = "testuser+copilot@example.com"

    # snapshot original participants so we can restore state
    original = list(activities[activity]["participants"])
    try:
        # Ensure the test email is not already present
        assert email not in activities[activity]["participants"]

        # Sign up the test user
        res = client.post(f"/activities/{quote(activity)}/signup", params={"email": email})
        assert res.status_code == 200

        # Verify the activity now lists the new participant
        res = client.get("/activities")
        assert res.status_code == 200
        data = res.json()
        assert email in data[activity]["participants"]

        # Unregister the participant
        res = client.delete(f"/activities/{quote(activity)}/participants", params={"email": email})
        assert res.status_code == 200

        # Verify participant removed
        res = client.get("/activities")
        data = res.json()
        assert email not in data[activity]["participants"]
    finally:
        # Restore original state (defensive cleanup)
        activities[activity]["participants"] = original
