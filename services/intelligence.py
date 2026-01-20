from google import genai
from models.schemas import ActionableInsightList, DocumentSummaries, FullDocumentExtraction
from fastapi import HTTPException
from core.database import system_mongodb
from dotenv import load_dotenv
import os


def get_workspace_key(workspace_id: str):
    """Checks the DB for a key and puts it in the system memory."""
    workspace = system_mongodb.workspaces.find_one({"workspace_id": workspace_id})
    if workspace and "google_api_key" in workspace:
        print(f"DEBUG: Found key in DB for {workspace_id}. Loading to environment...")
        return workspace["google_api_key"]
    print(f"DEBUG: No key found in DB for {workspace_id}.")
    return None


class IntelligenceService:
    def _get_client(self, workspace_id: str):

        # 2. load it from the Database
        api_key = get_workspace_key(workspace_id)

        # 3. If it's still not there, the Admin hasn't set it yet
        if not api_key:
            raise HTTPException(
                status_code=428, 
                detail="AI_CONFIG_MISSING"
            )
        
        try:
            client = genai.Client(api_key=api_key)
            # A tiny "ping" or check can be done here if you want to verify immediately, 
            # otherwise, the error will be caught during the first generation call.
            return client
        except Exception:
            raise HTTPException(status_code=401, detail="INVALID_API_KEY")


    def generate_embedding(self, texts: list[str], workspace_id: str) -> list[list[float]]:
        client = self._get_client(workspace_id)
        result = client.models.embed_content(
            model="models/text-embedding-004",
            contents=texts
        )
        return [e.values for e in result.embeddings]
    

    def generate_all_intelligence(self, full_text_to_analyze, workspace_id: str):
        client = self._get_client(workspace_id)
        prompt = f"""
            Analyze the following document which is split into numbered chunks.

            TASK:
            1. Identify the OVERALL INTENT of the Document (High-level Semantics).
            2. List MAJOR THEMES of the Document (Topic Modeling).
            2. Extract all ORGANIZATIONS, DATES, MONETARY VALUES, LEGAL REFERENCES and KEY STAKEHOLDERS (NER).
            3. Detect all OBLIGATIONS, DEPENDENCIES and RELATIONSHIP between these entities (Relationship Detection).

            CRITICAL: For every Entity and Relationship, note the CHUNK INDEX where it appeared.

            DOCUMENT TEXT:
            {full_text_to_analyze}
            """

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': FullDocumentExtraction, # Uses your Pydantic model
            },
        )
        return response.parsed


    def generate_actionable_insights(self, full_text_to_analyze: str, chunk_count: int, workspace_id: str):
        client = self._get_client(workspace_id)
        prompt = f"""
            Analyze these document segments. For EVERY numbered chunk index, you MUST return at least one entry in the 'insights' list.

            - If a chunk contains a Risk, Decision, Deadline or other Action: Extract it normally.
            - If a chunk contains NO actionable insights: Set 'type' to "N/A", 'description' to "N/A", 'date_or_value' to "N/A" and 'entities' to [].
            - Every chunk index from 0 to {chunk_count-1} must be represented in your output.

            SEGMENTS:
            {full_text_to_analyze}
            """
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': ActionableInsightList, # Uses your Pydantic model
            },
        )
        return response.parsed
    

    def generate_final_summaries(self, insights_list, original_text: str, workspace_id: str):
        # We pass the list of extracted insights as a helper to the model
        # This ensures the summary doesn't miss the specific risks/deadlines we found
        client = self._get_client(workspace_id)
        prompt = f"""
        Using the following extracted insights and the original text, generate three types of summaries.

        EXTRACTED INSIGHTS:
        {insights_list}

        ORIGINAL TEXT:
        {original_text[:10000]} # Using a large window

        REQUIREMENTS:
        1. Executive: 3-5 sentences, high-level.
        2. Technical: Detailed, focusing on dependencies.
        3. Section-wise: A summary for each major header identified.
        """

        # Using your working extraction pattern
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": DocumentSummaries,
            }
        )
        return response.parsed