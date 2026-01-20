from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_google_genai import GoogleGenerativeAIEmbeddings, GoogleGenerativeAI
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError
from langchain_classic.chains.query_constructor.base import AttributeInfo
from langchain_classic.retrievers.self_query.base import SelfQueryRetriever
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from core.database import system_mongodb
from fastapi import HTTPException
import os

def get_workspace_key(workspace_id: str):
    """Checks the DB for a key and puts it in the system memory."""
    workspace = system_mongodb.workspaces.find_one({"workspace_id": workspace_id})
    if workspace and "google_api_key" in workspace:
        print(f"DEBUG: Found key in DB for {workspace_id}. Loading to environment...")
        return workspace["google_api_key"]
    print(f"DEBUG: No key found in DB for {workspace_id}.")
    return None



class RAGEngine:
    def __init__(self, db_collection, parent_collection, index_name):
        self.parent_collection = parent_collection
        self.db_collection = db_collection
        self.index_name = index_name

        self.document_content_description = "A collection of long-form technical and legal document chunks with extracted insights, entities, and relationships."

        self.metadata_field_info = [
            AttributeInfo(
                name="section_header",
                description="The specific header or title of the section (e.g., Introduction, Methodology)",
                type="string",
            ),
            AttributeInfo(
                name="insight_types",
                description="The category of insight: Risk, Deadline, Decision, or Recommendation",
                type="string",
            ),
            AttributeInfo(
                name="parent_doc_id",
                description="The unique ID of the document to filter by a specific file",
                type="string",
            ),
            AttributeInfo(
                name="entities.name",
                description="Names of specific entities mentioned (e.g., 'NLP', 'Researchers')",
                type="string",
            ),
            AttributeInfo(
                name="entities.type",
                description="The category of the entity (e.g., 'Stakeholder', 'Legal Reference')",
                type="string",
            ),
            AttributeInfo(
                name="relationships.relation",
                description="The type of connection detected (e.g., 'aims to address', 'supports')",
                type="string",
            ),
            # Add this to your metadata_field_info list
            AttributeInfo(
                name="is_current",
                description="Whether the document is the latest version. Always True for current docs.",
                type="boolean",
            ),
        ]

    def _get_active_components(self, workspace_id: str):

        # 2. load it from the Database
        api_key = get_workspace_key(workspace_id)

        if not api_key:
            raise HTTPException(status_code=428, detail="AI_CONFIG_MISSING")

        embedding_model = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=api_key)
        llm = GoogleGenerativeAI(model="models/gemma-3-27b-it", google_api_key=api_key)


        vector_store = MongoDBAtlasVectorSearch(
            collection=self.db_collection,
            embedding=embedding_model, # Your text-embedding-004 wrapper
            index_name=self.index_name,
            text_key="chunk_text",
            relevance_score_fn="cosine",
        )
        

        retriever = SelfQueryRetriever.from_llm(
            llm=llm,
            vectorstore=vector_store,
            document_contents=self.document_content_description,
            metadata_field_info=self.metadata_field_info,
            verbose=True # Helpful to see the "Query Translation" in the notebook
        )

        
        self.template = """
        You are the Document Intelligence Engine.
        You are provided with specific document chunks and their associated metadata (Risks, Decisions, Entities, and Obligations etc.).

        TASK: {task_instruction}

        CONTEXT FROM DOCUMENT:
        {context}

        STRICT GUIDELINES:
        1. Use ONLY the provided context.
        2. Pay special attention to 'KEY ENTITIES' and 'DETECTED OBLIGATIONS' metadata to identify stakeholders and responsibilities accurately.
        3. If you are summarizing, use professional bullet points.
        4. If you are answering a search, provide a concise 2-3 sentence explanation followed by the evidence.
        4. For EVERY claim or summary point, you MUST mention the Source Filename and Section Header in brackets.
        5. Format example: "The security protocol requires MFA (File: security_policy.pdf, Section: Authentication).

        FINAL OUTPUT:
        """

        self.prompt = ChatPromptTemplate.from_template(self.template)

        return llm, retriever



    def format_docs_with_metadata(self, docs):
        filename_cache={}
        formatted = []
        for doc in docs:
             
            # 1. Extract the rich metadata we stored in MongoDB
            parent_id = doc.metadata.get("parent_doc_id")
            if parent_id not in filename_cache:
                # Query the 'documents' collection for the filename
                parent_doc = self.parent_collection.find_one({"_id": parent_id}, {"filename": 1})
                filename_cache[parent_id] = parent_doc.get("filename", "Unknown Document") if parent_doc else "Unknown Document"
            
            filename = filename_cache[parent_id]

            header = doc.metadata.get("section_header", "General")
            insights = doc.metadata.get("insight_types", [])

            # 2. Extract our new Semantic Intelligence (Section 3.b)
            entities = doc.metadata.get("entities", [])
            relationships = doc.metadata.get("relationships", [])

            # 3. Build the context block for the LLM
            text = f"--- SOURCE_FILE: {filename} | SECTION: {header} ---\n"

            if insights:
                text += f"CATEGORIES: {', '.join(insights)}\n"

            if entities:
                entity_list = [f"{e['name']} ({e['type']})" for e in entities]
                text += f"KEY ENTITIES: {', '.join(entity_list)}\n"

            if relationships:
                rel_list = [f"{r['subject']} -> {r['relation']} -> {r['object']}" for r in relationships]
                text += f"DETECTED OBLIGATIONS: {'; '.join(rel_list)}\n"

            text += f"RAW CONTENT: {doc.page_content}\n"

            formatted.append(text)

        return "\n\n".join(formatted)
    


    def generate_intelligence(self, user_query: str, workspace_id, mode="search"):

        llm, retriever = self._get_active_components(workspace_id)

        search_kwargs = {
        "pre_filter": { "is_current": { "$eq": True } }
        }

        try:
            retrieved_docs = retriever.invoke(user_query, search_kwargs=search_kwargs)
            # Format the context string (using the logic we discussed earlier)
            context_text = self.format_docs_with_metadata(retrieved_docs)

            # Switch instructions based on the mode
            if mode == "dashboard":
                instruction = """
                Synthesize a high-level executive dashboard from these chunks.
                You must highlight:
                1. KEY DECISIONS & RISKS: From the actionable insights.
                2. STAKEHOLDERS & OBLIGATIONS: From the entities and detected relationships.
                3. PRIMARY THEMES: Based on the content and headers.

                Format the output for a quick professional briefing.
                """
            else:
                instruction = f"Answer the following user search query: {user_query}"

            # Run the chain
            chain = self.prompt | llm | StrOutputParser()
            return chain.invoke({"task_instruction": instruction, "context": context_text})
        
        except ChatGoogleGenerativeAIError as e:
            # Catch the specific 'API key not valid' error from LangChain
            if "INVALID_ARGUMENT" in str(e) or "API key not valid" in str(e):
                raise HTTPException(status_code=401, detail="INVALID_API_KEY")
            # For other AI errors (quota, etc.)
            raise HTTPException(status_code=502, detail=f"AI Engine Error: {str(e)}")
        






