"""Version of the reve SDK.

The canonical version lives in ``pyproject.toml``; ``increment_version.py``
(run by ``publish.sh``) rewrites the constant below to match, so the two
stay in sync. A static constant is used instead of installed package
metadata because metadata can be stale (an editable install after a bump)
or belong to a different installed distribution named ``reve``.
"""

#: Kept in sync with pyproject.toml by increment_version.py.
__version__ = "0.1.8"


def get_version() -> str:
    """Return the SDK version."""
    return __version__
