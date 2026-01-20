from docling.document_converter import DocumentConverter
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

class IngestionService:
    def __init__(self):
        self.converter = DocumentConverter()
        self.headers_to_split = [("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")]
        self.markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=self.headers_to_split, strip_headers=False)
        self.child_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=150)

    def process_file(self, source_path: str):
        # Convert PDF to Markdown
        result = self.converter.convert(source_path)
        markdown_text = result.document.export_to_markdown()
        
        # Split into logical sections
        section_docs = self.markdown_splitter.split_text(markdown_text)
        
        # Split into final chunks
        return self.child_splitter.split_documents(section_docs)