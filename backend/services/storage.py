from collections import OrderedDict
from datetime import datetime, timedelta, timezone

comparisons: OrderedDict[str, dict] = OrderedDict()
SESSION_TTL = timedelta(minutes=30)
MAX_ACTIVE_COMPARISONS = 3


def store_comparison(comparison_id: str, comparison: dict) -> None:
    now = datetime.now(timezone.utc)
    for key, value in list(comparisons.items()):
        if now - value["created_at"] > SESSION_TTL:
            comparisons.pop(key)
    comparisons[comparison_id] = {**comparison, "created_at": now}
    while len(comparisons) > MAX_ACTIVE_COMPARISONS:
        comparisons.popitem(last=False)


def get_comparison(comparison_id: str) -> dict | None:
    comparison = comparisons.get(comparison_id)
    if comparison is None:
        return None
    if datetime.now(timezone.utc) - comparison["created_at"] > SESSION_TTL:
        comparisons.pop(comparison_id)
        return None
    comparisons.move_to_end(comparison_id)
    return comparison
