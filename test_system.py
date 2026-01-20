import requests
import time

BASE_URL = "http://localhost:8000"
TEST_FILE = "Team Alpha.pdf"

def test_full_workflow():
    # 1. Step 1: AI Analysis (Analysis Lab Tab)
    print(f"--- Step 1: Analyzing {TEST_FILE} ---")
    start_time = time.time()
    
    with open(TEST_FILE, "rb") as f:
        files = {"file": (TEST_FILE, f, "application/pdf")}
        # Note: This is now a direct wait for the AI result
        response = requests.post(f"{BASE_URL}/analyze", files=files)
    
    if response.status_code != 200:
        print(f"❌ Analysis failed: {response.text}")
        return

    analysis_data = response.json()
    print(f"✅ AI Analysis Complete! (Took {int(time.time() - start_time)}s)")
    print(f"Summary Preview: {analysis_data['summaries']['executive_summary'][:100]}...")

    # 2. Step 2: Store in Database (The "Store in Knowledge Base" Button)
    print("\n--- Step 2: Storing in Knowledge Base ---")
    # We send the data we just got back to the store endpoint
    store_response = requests.post(f"{BASE_URL}/store", json=analysis_data)
    
    if store_response.status_code == 200:
        print(f"✅ Data successfully committed to MongoDB. Doc ID: {store_response.json().get('doc_id')}")
    else:
        print(f"❌ Storage failed: {store_response.text}")
        return

    # 3. Step 3: Test Search (Repository Tab)
    print("\n--- Step 3: Testing RAG Search ---")
    search_query = "What are the primary risks mentioned in the document?"
    search_response = requests.post(f"{BASE_URL}/search", params={"user_query": search_query})
    print(f"AI Answer: {search_response.json().get('answer')}")

    # 4. Step 4: Test Dashboard (Repository Tab)
    print("\n--- Step 4: Testing Executive Dashboard ---")
    dashboard_response = requests.get(f"{BASE_URL}/dashboard/latest") 
    print(f"Dashboard Summary: {dashboard_response.json().get('dashboard_summary')}")

if __name__ == "__main__":
    test_full_workflow()