#!/usr/bin/env python3
#!/usr/bin/env python3
"""兼容入口：转发到 run.py（推荐 python run.py）。"""

from __future__ import annotations

import run as talk_run


if __name__ == "__main__":
    raise SystemExit(talk_run.main())
