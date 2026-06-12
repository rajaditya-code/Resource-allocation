from datetime import datetime
from zoneinfo import ZoneInfo

def get_ist_now() -> datetime:
    """Return the current time in Indian Standard Time (IST)."""
    return datetime.now(ZoneInfo("Asia/Kolkata"))

def format_to_ist(dt: datetime, format_str: str = None) -> str:
    """
    Ensure the given datetime is formatted as IST explicitly.
    If naive, assumes it ALREADY represents local IST time and just attaches the tzinfo.
    """
    if not dt:
        return ""
    
    if dt.tzinfo is None:
        # Attach the timezone without changing the wall-clock time
        ist_dt = dt.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    else:
        # If it's already aware, convert it to IST
        ist_dt = dt.astimezone(ZoneInfo("Asia/Kolkata"))
    
    if format_str:
        return ist_dt.strftime(format_str)
    return ist_dt.isoformat()
