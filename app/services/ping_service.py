import asyncio
import socket
import time
import httpx
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.check_result import CheckResult
from app.models.monitor import Monitor
from app.models.alert_channel import AlertChannel

async def _send_webhook_alert(channel_type: str, target: str, text: str) -> None:
    payload = {"text": text}
    if channel_type == "teams":
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "summary": text,
            "text": text,
        }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(target, json=payload)


def _expand_expected_status_codes(raw_codes: object) -> set[int]:
    """Normalize accepted status code values (ints and ranges like '200-299')."""
    if not isinstance(raw_codes, list):
        return {200}

    expanded: set[int] = set()
    for raw in raw_codes:
        if isinstance(raw, int):
            if 100 <= raw <= 599:
                expanded.add(raw)
            continue

        if isinstance(raw, str):
            token = raw.strip()
            if not token:
                continue
            if "-" in token:
                parts = token.split("-", 1)
                if len(parts) != 2:
                    continue
                start_str, end_str = parts[0].strip(), parts[1].strip()
                if start_str.isdigit() and end_str.isdigit():
                    start, end = int(start_str), int(end_str)
                    if 100 <= start <= end <= 599:
                        for code in range(start, end + 1):
                            expanded.add(code)
                continue
            if token.isdigit():
                code = int(token)
                if 100 <= code <= 599:
                    expanded.add(code)

    return expanded or {200}


def _message_from_template(template: str | None, fallback: str, monitor: Monitor) -> str:
    if not template:
        return fallback
    return (
        template
        .replace("{monitor_name}", monitor.name)
        .replace("{target}", monitor.target)
    )


async def _maybe_send_monitor_notifications(
    db: AsyncSession,
    monitor: Monitor,
    is_up: bool,
    was_up: bool | None,
    error: str | None,
    status_code: int | None,
) -> None:
    cfg = monitor.notification_config or {}
    if not cfg.get("enabled", False):
        return

    now = datetime.utcnow()
    cooldown_seconds = int(cfg.get("cooldown_seconds", 300))
    if monitor.last_notification_sent_at:
        elapsed = (now - monitor.last_notification_sent_at).total_seconds()
        if elapsed < cooldown_seconds:
            return

    should_send_down = cfg.get("trigger_on_down", True) and (not is_up)
    should_send_recovery = cfg.get("trigger_on_recovery", True) and is_up and (was_up is False)
    if not (should_send_down or should_send_recovery):
        return

    if should_send_down:
        message = _message_from_template(
            cfg.get("custom_message"),
            f"Monitor {monitor.name} is DOWN ({status_code or 'no status'}; {error or 'no error'})",
            monitor,
        )
    else:
        message = _message_from_template(
            cfg.get("custom_message"),
            f"Monitor {monitor.name} recovered and is UP",
            monitor,
        )

    channel_ids = [int(cid) for cid in (cfg.get("channel_ids") or []) if str(cid).isdigit()]
    if not channel_ids:
        return

    result = await db.execute(
        select(AlertChannel).where(
            AlertChannel.user_id == monitor.user_id,
            AlertChannel.id.in_(channel_ids),
            AlertChannel.is_active == True,  # noqa: E712
        )
    )
    channels = result.scalars().all()
    for channel in channels:
        ch_type = (channel.channel_type or "custom").lower()
        target = channel.webhook_url
        if ch_type in {"webhook", "slack", "teams", "custom"} and target:
            try:
                await _send_webhook_alert(ch_type, target, message)
            except Exception:
                continue

    monitor.last_notification_sent_at = now
    await db.flush()


async def _http_check(monitor: Monitor) -> dict:
    retry_cfg = monitor.retry_config or {}
    request_cfg = monitor.request_config or {}
    advanced_cfg = monitor.advanced_config or {}

    timeout = max(float(retry_cfg.get("timeout_seconds", 10)), 1)
    method = (request_cfg.get("method") or "GET").upper()
    headers = dict(request_cfg.get("headers") or {})
    body = request_cfg.get("body")
    keyword = request_cfg.get("keyword")
    expected_status_codes = _expand_expected_status_codes(
        request_cfg.get("expected_status_codes") or [200]
    )

    if advanced_cfg.get("user_agent"):
        headers["User-Agent"] = advanced_cfg["user_agent"]

    auth_cfg = advanced_cfg.get("authentication") or {}
    auth = None
    if auth_cfg.get("type") == "basic" and auth_cfg.get("username") is not None:
        auth = (auth_cfg.get("username"), auth_cfg.get("password") or "")
    elif auth_cfg.get("type") == "api_token" and auth_cfg.get("token"):
        header_name = auth_cfg.get("header_name") or "Authorization"
        headers[header_name] = auth_cfg["token"]

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=bool(advanced_cfg.get("follow_redirects", True)),
            verify=not bool(advanced_cfg.get("ignore_ssl_errors", False)),
        ) as client:
            response = await client.request(
                method,
                monitor.url,
                headers=headers,
                content=body if method in {"POST", "PUT", "DELETE"} else None,
                auth=auth,
            )
            elapsed_ms = (time.monotonic() - start) * 1000
            status_ok = response.status_code in expected_status_codes
            keyword_ok = True
            if keyword:
                keyword_ok = keyword in response.text
            return {
                "is_up": status_ok and keyword_ok,
                "status_code": response.status_code,
                "response_time_ms": round(elapsed_ms, 2),
                "error": None if (status_ok and keyword_ok) else "Response validation failed",
            }
    except httpx.TimeoutException:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": "Request timed out",
        }
    except httpx.RequestError as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": str(exc)[:512],
        }


async def _tcp_check(host: str, port: int, timeout: float) -> dict:
    start = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.close()
        await writer.wait_closed()
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": True,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": str(exc)[:512],
        }


async def _dns_check(host: str, timeout: float) -> dict:
    start = time.monotonic()
    try:
        loop = asyncio.get_running_loop()
        await asyncio.wait_for(loop.getaddrinfo(host, None, type=socket.SOCK_STREAM), timeout=timeout)
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": True,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": str(exc)[:512],
        }


async def _single_check(monitor: Monitor) -> dict:
    monitor_type = (monitor.monitor_type or "http").lower()
    timeout = float((monitor.retry_config or {}).get("timeout_seconds", 10))

    if monitor_type in {"http", "https"}:
        return await _http_check(monitor)
    if monitor_type == "tcp":
        port = monitor.port or 80
        return await _tcp_check(monitor.target, port, timeout)
    if monitor_type == "dns":
        return await _dns_check(monitor.target, timeout)
    if monitor_type == "ping":
        if monitor.port:
            return await _tcp_check(monitor.target, monitor.port, timeout)
        return await _dns_check(monitor.target, timeout)

    return {
        "is_up": False,
        "status_code": None,
        "response_time_ms": None,
        "error": f"Unsupported monitor type: {monitor_type}",
    }


async def ping_url(url: str) -> dict:
    """Backward-compatible helper used in tests."""
    monitor = Monitor(
        name="adhoc",
        monitor_type="http",
        target=url,
        url=url,
        request_config={"method": "GET", "headers": {}, "expected_status_codes": [200]},
        retry_config={"timeout_seconds": 10},
        notification_config={},
        check_settings={},
        advanced_config={"follow_redirects": True, "ignore_ssl_errors": False},
        organization_config={},
        interval_minutes=1,
        user_id=0,
    )
    return await _http_check(monitor)


async def run_check(db: AsyncSession, monitor_id: int) -> CheckResult:
    """Run a monitor check using monitor-local request/retry/notification configuration."""
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    if not monitor:
        raise ValueError(f"Monitor {monitor_id} not found")

    retry_cfg = monitor.retry_config or {}
    retry_attempts = max(int(retry_cfg.get("retry_attempts_before_down", 0)), 0)
    retry_interval = max(float(retry_cfg.get("retry_interval_seconds", 2)), 0)
    failure_threshold = max(int(retry_cfg.get("failure_threshold", 1)), 1)

    was_up = monitor.is_up

    result_data = None
    for attempt in range(retry_attempts + 1):
        result_data = await _single_check(monitor)
        if result_data["is_up"]:
            break
        if attempt < retry_attempts and retry_interval > 0:
            await asyncio.sleep(retry_interval)

    assert result_data is not None

    if result_data["is_up"]:
        monitor.consecutive_failures = 0
        effective_is_up = True
    else:
        monitor.consecutive_failures = (monitor.consecutive_failures or 0) + 1
        effective_is_up = monitor.consecutive_failures >= failure_threshold
        effective_is_up = not effective_is_up

    monitor.is_up = effective_is_up
    monitor.last_checked_at = datetime.utcnow()
    if not effective_is_up:
        monitor.last_failure_at = monitor.last_checked_at

    if result_data["is_up"] is False and effective_is_up is True:
        threshold_msg = f"Failure threshold not reached ({monitor.consecutive_failures}/{failure_threshold})"
        result_data["error"] = f"{threshold_msg}: {result_data['error'] or 'transient failure'}"

    check = CheckResult(
        monitor_id=monitor_id,
        is_up=effective_is_up,
        status_code=result_data["status_code"],
        response_time_ms=result_data["response_time_ms"],
        error=result_data["error"],
        checked_at=monitor.last_checked_at,
    )
    db.add(check)
    await db.flush()

    await _maybe_send_monitor_notifications(
        db=db,
        monitor=monitor,
        is_up=effective_is_up,
        was_up=was_up,
        error=result_data["error"],
        status_code=result_data["status_code"],
    )

    # Helper field for scheduler logs without extra DB round-trips.
    check.monitor_url = monitor.url  # type: ignore[attr-defined]
    await db.commit()
    return check
