from pydantic import BaseModel, Field
from typing import List, Optional


class Entity(BaseModel):
    chunk_index: int = Field(description="The index of the chunk where this was found (0-9)")
    name: str = Field(description="The extracted entity (e.g., 'Itsolera', '2026-01-01')")
    type: str = Field(description="Organization, Date, Monetary Value, Legal Reference, or Stakeholder")

class Relationship(BaseModel):
    chunk_index: int = Field(description="The index of the chunk where this connection was found")
    subject: str = Field(description="The entity performing the action/obligation")
    relation: str = Field(description="The connection (e.g., 'must deliver', 'partnered with', 'deadline for')")
    object: str = Field(description="The entity or task being acted upon")

class FullDocumentExtraction(BaseModel):
    # Overall Document Semantics (Section 3.b Requirement)
    document_intent: str = Field(description="High-level semantics: What is the purpose of this document?")
    topics: List[str] = Field(description="Topic Modeling: List major themes and subject areas found")

    # Granular Extraction (Section 3.b Requirement)
    entities: List[Entity] = Field(description="Named Entity Recognition: Extracted key data points")
    relationships: List[Relationship] = Field(description="Detected obligations, dependencies, or responsibilities")


class ActionableInsight(BaseModel):
    chunk_index: int = Field(description="Chunk Number")
    type: str = Field(description="Risk, Deadline, Decision, or Recommendation")
    description: str = Field(description="Summary of the insight")
    entities: List[str] = Field(description="Stakeholders involved")
    date_or_value: str = Field(description="Deadlines or values")

class ActionableInsightList(BaseModel):
    insights: List[ActionableInsight]

class SectionSummary(BaseModel):
    section_header: str
    summary_text: str

class DocumentSummaries(BaseModel):
    executive_summary: str
    technical_summary: str
    section_summaries: List[SectionSummary]