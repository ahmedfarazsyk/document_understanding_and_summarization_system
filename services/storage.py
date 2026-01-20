import uuid
from datetime import datetime

class StorageService:
    def __init__(self, mongodb):
        self.db = mongodb
    
    def final_storage_logic(self, doc_summaries, insight_list, intelligence, raw_chunks, embeddings, filename, owner, parent_group_id=None):
        """
        Combines high-level summaries with granular raw chunks and actionable insights.
        """
        if parent_group_id:
            existing = self.db.documents.find_one({
                "parent_group_id": parent_group_id, 
                "is_current": True
            })
            version = existing.get("version", 1) + 1
            
            # Retire ONLY this specific document identity
            self.db.documents.update_many({"parent_group_id": parent_group_id}, {"$set": {"is_current": False}})
            self.db.chunks.update_many({"parent_group_id": parent_group_id}, {"$set": {"is_current": False}})
        else:
            # Brand new identity (even if filename is the same as something else)
            parent_group_id = str(uuid.uuid4())
            version = 1


        doc_id = str(uuid.uuid4())


        insights_by_chunk = {}
        for ins in insight_list['insights']:
            idx = ins['chunk_index']
            if idx not in insights_by_chunk:
                insights_by_chunk[idx] = []

            # Only add to list if it's not a placeholder "N/A"
            if ins['type'].upper() != "N/A":
                insights_by_chunk[idx].append(ins)


        # 2. Pre-process Semantic Extraction by Chunk Index (Section 3.b)
        entities_by_chunk = {}
        for ent in intelligence['entities']:
            idx = ent['chunk_index']
            if idx not in entities_by_chunk:
                entities_by_chunk[idx] = []
            entities_by_chunk[idx].append(ent)

        rels_by_chunk = {}
        for rel in intelligence ['relationships']:
            idx = rel['chunk_index']
            if idx not in rels_by_chunk:
                rels_by_chunk[idx] = []
            rels_by_chunk[idx].append(rel)


        # 1. Prepare Parent Document (Global Metadata & Summaries)
        # This fulfills your requirement for "Summary Viewing" and "Audit Logging"
        parent_doc = {
            "_id": doc_id,
            "parent_group_id": parent_group_id,
            "filename": filename,
            "version": version,
            "is_current": True,
            "upload_date": datetime.utcnow().isoformat(),
            "owner": owner,
            "document_intent": intelligence['document_intent'],
            "major_themes": intelligence['topics'],
            "executive_summary": doc_summaries['executive_summary'],
            "technical_summary": doc_summaries['technical_summary'],
            "audit_log": [
                {"action": "initial_processing", "user": owner, "time": datetime.utcnow().isoformat()}
            ]
        }

        # 2. Prepare Child Chunks (Searchable Units)
        # We map raw 1500-char chunks to their nearest AI-generated Section Summary
        child_chunks = []

        for i, chunk_text in enumerate(raw_chunks):

            # Heuristic: Find which section header belongs to this chunk
            matched_header, matched_summary = self._match_section(chunk_text, doc_summaries)

            current_insights = insights_by_chunk.get(i, [])
            flat_types = list(set([ins['type'] for ins in current_insights]))

            chunk_entry = {
                "_id": str(uuid.uuid4()),
                "parent_group_id": parent_group_id,
                "parent_doc_id": doc_id,
                "chunk_index": i,
                "section_header": matched_header,
                "chunk_text": chunk_text,  # The actual raw text for RAG retrieval
                "embedding": embeddings[i],  # TODO: Call your embedding function here
                "entities": entities_by_chunk.get(i, []),
                "relationships": rels_by_chunk.get(i, []),
                "section_summary": matched_summary,
                "actionable_insights": current_insights,
                "insight_types": flat_types,
                "version": version,
                "is_current": True,
            }
            child_chunks.append(chunk_entry)

        # 3. Atomic Inserts into MongoDB Atlas
        self.db.documents.insert_one(parent_doc)
        self.db.chunks.insert_many(child_chunks)

        print(f"Document '{filename}' stored. Parent ID: {doc_id} | Chunks: {len(child_chunks)}")
        return doc_id
    

    def _match_section(self, chunk_text: str, doc_summaries):

        for section in doc_summaries['section_summaries']:
            if section['section_header'].lower() in chunk_text.lower():
                return section['section_header'], section['summary_text']
            
        return "General", "N/A"
    



    def get_all_documents(self):
        """Retrieves the list for the individual bars in the Archive tab."""
        docs = self.db.documents.find({"is_current": True}, {"_id": 1, "filename": 1, "upload_date": 1}).sort("upload_date", -1)
        return [{"id": str(d["_id"]), "filename": d["filename"], "upload_date": d["upload_date"]} for d in docs]
    



    def get_document_full_history(self, doc_id):
        """Assembles parent and child data for the detailed history view."""
        parent = self.db.documents.find_one({"_id": doc_id})
        if not parent:
            return None
            
        chunks = list(self.db.chunks.find({"parent_doc_id": doc_id}).sort("chunk_index", 1))
        
        # Reconstruct the analysis format for the frontend
        all_entities = []
        all_relationships = []
        all_insights = []
        section_summaries = []
        seen_headers = set()

        for c in chunks:
            if "actionable_insights" in c:
                all_insights.extend(c["actionable_insights"])

            if "entities" in c:
                all_entities.extend(c["entities"])
            
            if "relationships" in c:
                all_relationships.extend(c["relationships"])
            
            if c.get("section_header") and c["section_header"] not in seen_headers:
                section_summaries.append({
                    "section_header": c["section_header"],
                    "summary_text": c.get("section_summary", "N/A")
                })
                seen_headers.add(c["section_header"])

        return {
            "filename": parent["filename"],
            "document_intent": parent.get("document_intent"),
            "major_themes": parent.get("major_themes", []),
            "entities": all_entities,
            "relationships": all_relationships,
            "executive_summary": parent["executive_summary"],
            "technical_summary": parent["technical_summary"],
            "actionable_insights": all_insights,
            "section_summaries": section_summaries
        }
    
    def soft_delete_document(self, doc_id: str):
        """
        Simple Soft Delete: Sets is_current to False for the entire lineage.
        This effectively hides the document from RAG and UI.
        """
        # 1. Update the document metadata
        self.db.documents.update_many(
            {"_id": doc_id},
            {"$set": {"is_current": False}}
        )

        # 2. Update the vector chunks so RAG ignores them
        self.db.chunks.update_many(
            {"parent_doc_id": doc_id},
            {"$set": {"is_current": False}}
        )
        return True