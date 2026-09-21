from schemas import Event
def validate_local_output(payload):
    """Schema boundary for a future local provider. No network/tool execution."""
    return [Event.model_validate(item) for item in payload]
def extract(*_args):
    raise RuntimeError('Local LLM provider is not configured. Use deterministic-v1 for the documented demo vocabulary.')
