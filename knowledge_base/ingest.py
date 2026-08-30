"""
Knowledge Base Ingestion — loads source documents into ChromaDB
for each use case's RAG retrieval.

Run this once before starting the gateway:
    python knowledge_base/ingest.py
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from rich import print

load_dotenv()

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
KB_DIR = os.path.dirname(os.path.abspath(__file__))

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
)

# Map each source document to its use case collection
INGESTION_MAP = [
    {
        "file": os.path.join(KB_DIR, "warranty_policy.txt"),
        "use_case": "customer_support",
        "description": "Product warranty policy document",
    },
    {
        "file": os.path.join(KB_DIR, "hr_handbook.txt"),
        "use_case": "hr_assistant",
        "description": "Employee handbook and HR policies",
    },
    {
        "file": os.path.join(KB_DIR, "financial_guidelines.txt"),
        "use_case": "financial_tool",
        "description": "Financial authorization and expenditure guidelines",
    },
]



def ingest_document(file_path: str, use_case: str, description: str):
    print(f"\n[purple]Ingesting:[/purple] {os.path.basename(file_path)} → use case: {use_case}")

    # Load document
    loader = TextLoader(file_path, encoding="utf-8")
    documents = loader.load()

    # Add metadata
    for doc in documents:
        doc.metadata["source"] = os.path.basename(file_path)
        doc.metadata["use_case"] = use_case
        doc.metadata["description"] = description

    # Split into chunks
    chunks = text_splitter.split_documents(documents)
    print(f"  Split into {len(chunks)} chunks")

    # Store in ChromaDB collection for this use case
    collection_name = f"veritas_{use_case}"
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_DB_PATH,
    )

    print(f"  [green]✓ Ingested into collection: {collection_name}[/green]")
    return len(chunks)


def main():
    print("[bold purple]Veritas Knowledge Base Ingestion[/bold purple]")
    print("[purple]Loading source documents into ChromaDB...[/purple]\n")

    total_chunks = 0
    for item in INGESTION_MAP:
        if not os.path.exists(item["file"]):
            print(f"[red]✗ File not found: {item['file']}[/red]")
            continue
        chunks = ingest_document(
            file_path=item["file"],
            use_case=item["use_case"],
            description=item["description"],
        )
        total_chunks += chunks

    print(f"\n[bold green]✓ Ingestion complete. Total chunks stored: {total_chunks}[/bold green]")
    print(f"[green]ChromaDB persisted at: {CHROMA_DB_PATH}[/green]")


if __name__ == "__main__":
    main()
