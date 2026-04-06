import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.services.ping_service import ping_url, _expand_expected_status_codes


@pytest.mark.asyncio
async def test_ping_url_success():
    mock_response = httpx.Response(200)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response):
        result = await ping_url("https://example.com")
    assert result["is_up"] is True
    assert result["status_code"] == 200
    assert result["response_time_ms"] >= 0
    assert result["error"] is None


@pytest.mark.asyncio
async def test_ping_url_server_error():
    mock_response = httpx.Response(500)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response):
        result = await ping_url("https://example.com")
    assert result["is_up"] is False
    assert result["status_code"] == 500


@pytest.mark.asyncio
async def test_ping_url_timeout():
    with patch(
        "httpx.AsyncClient.get",
        new_callable=AsyncMock,
        side_effect=httpx.TimeoutException("timed out"),
    ):
        result = await ping_url("https://example.com")
    assert result["is_up"] is False
    assert result["error"] == "Request timed out"
    assert result["status_code"] is None


@pytest.mark.asyncio
async def test_ping_url_connection_error():
    with patch(
        "httpx.AsyncClient.get",
        new_callable=AsyncMock,
        side_effect=httpx.ConnectError("connection refused"),
    ):
        result = await ping_url("https://example.com")
    assert result["is_up"] is False
    assert "connection refused" in result["error"]


def test_expand_expected_status_codes_supports_ranges_and_singles():
    result = _expand_expected_status_codes(["200-204", 301, " 302 "])
    assert result == {200, 201, 202, 203, 204, 301, 302}


def test_expand_expected_status_codes_falls_back_to_default_when_invalid():
    result = _expand_expected_status_codes(["foo", "700-800", 99])
    assert result == {200}
