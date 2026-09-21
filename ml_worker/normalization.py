import re
def normalize_text(text):
    return re.sub(r'\bline\s+twenty[ -]four\b','line 24',text,flags=re.I)
def normalize_identifiers(event):
    if event.line_number: event.line_number = event.line_number.upper()
    if event.asset_tag: event.asset_tag = event.asset_tag.upper()
    return event
