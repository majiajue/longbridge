from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    data_dir: Path = Path("data")
    duckdb_path: Path = Path("data/quant.db")
    encryption_key: Optional[str] = None

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def get_fernet(self) -> Fernet:
        key = self.encryption_key or self._load_or_create_key()
        return Fernet(key)

    def _load_or_create_key(self) -> bytes:
        key_file = self.data_dir / "encryption.key"
        if key_file.exists():
            return key_file.read_bytes().strip()

        key = Fernet.generate_key()
        key_file.write_bytes(key)
        # Restrict permissions (best effort on POSIX)
        try:
            os.chmod(key_file, 0o600)
        except PermissionError:
            pass
        return key


def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
