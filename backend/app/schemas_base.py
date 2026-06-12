from datetime import datetime
from pydantic import *
from pydantic import BaseModel as PydanticBaseModel, ConfigDict
from app.utils.time import format_to_ist

class BaseModel(PydanticBaseModel):
    model_config = ConfigDict(
        json_encoders={
            datetime: format_to_ist
        }
    )
