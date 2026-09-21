from typing import Protocol
from schemas import Event
class ExtractionProvider(Protocol):
    def extract(self, text: str) -> list[Event]: ...
