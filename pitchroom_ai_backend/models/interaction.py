from pydantic import BaseModel, Field


class InteractionRequest(BaseModel):
    script_id: str = Field(min_length=1)
    type: str = Field(pattern="^(view|like|share|message)$")


class InteractionResponse(BaseModel):
    status: str
