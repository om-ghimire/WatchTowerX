from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


MonitorType = Literal["http", "https", "ping", "tcp", "dns"]
HttpMethod = Literal["GET", "POST", "PUT", "DELETE"]


class RequestConfig(BaseModel):
    method: HttpMethod = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = None
    expected_status_codes: list[int] = Field(default_factory=lambda: [200])
    keyword: str | None = None


class RetryConfig(BaseModel):
    retry_attempts_before_down: int = 0
    retry_interval_seconds: int = 2
    timeout_seconds: int = 10
    failure_threshold: int = 1


class NotificationConfig(BaseModel):
    enabled: bool = False
    channel_ids: list[int] = Field(default_factory=list)
    trigger_on_down: bool = True
    trigger_on_recovery: bool = True
    custom_message: str | None = None
    cooldown_seconds: int = 300


class CheckSettings(BaseModel):
    interval_seconds: int = 60
    locations: list[str] = Field(default_factory=list)


class AuthConfig(BaseModel):
    type: Literal["none", "basic", "api_token"] = "none"
    username: str | None = None
    password: str | None = None
    token: str | None = None
    header_name: str | None = "Authorization"


class AdvancedConfig(BaseModel):
    authentication: AuthConfig = Field(default_factory=AuthConfig)
    ignore_ssl_errors: bool = False
    follow_redirects: bool = True
    user_agent: str | None = None


class OrganizationConfig(BaseModel):
    tags: list[str] = Field(default_factory=list)
    project: str | None = None
    description: str | None = None


class MonitorBase(BaseModel):
    name: str
    monitor_type: MonitorType
    target: str
    port: int | None = None
    request_config: RequestConfig = Field(default_factory=RequestConfig)
    retry_config: RetryConfig = Field(default_factory=RetryConfig)
    notification_config: NotificationConfig = Field(default_factory=NotificationConfig)
    check_settings: CheckSettings = Field(default_factory=CheckSettings)
    advanced_config: AdvancedConfig = Field(default_factory=AdvancedConfig)
    organization_config: OrganizationConfig = Field(default_factory=OrganizationConfig)

    @field_validator("name", "target")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty")
        return value

    @field_validator("port")
    @classmethod
    def validate_port(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1 or value > 65535:
            raise ValueError("Port must be between 1 and 65535")
        return value


class MonitorCreate(MonitorBase):
    pass


class MonitorUpdate(BaseModel):
    name: str | None = None
    monitor_type: MonitorType | None = None
    target: str | None = None
    port: int | None = None
    request_config: RequestConfig | None = None
    retry_config: RetryConfig | None = None
    notification_config: NotificationConfig | None = None
    check_settings: CheckSettings | None = None
    advanced_config: AdvancedConfig | None = None
    organization_config: OrganizationConfig | None = None
    is_active: bool | None = None


class MonitorOut(BaseModel):
    id: int
    name: str
    monitor_type: MonitorType
    target: str
    port: int | None
    url: str
    interval_minutes: int
    request_config: RequestConfig
    retry_config: RetryConfig
    notification_config: NotificationConfig
    check_settings: CheckSettings
    advanced_config: AdvancedConfig
    organization_config: OrganizationConfig
    consecutive_failures: int
    is_active: bool
    is_up: bool | None
    last_checked_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
