# Reve SDK

Official SDK and tools for the [Reve](https://reve.com) image generation API.

## Python SDK

Install the Python package from PyPI:

```bash
pip install reve
```

Requires Python 3.10+. See the [Python SDK README](python/README.md) for full
documentation on authentication, image generation, remixing, editing, and more.

### Quick Start

```python
from reve.v1.image import create

img = create(prompt="A red dragon flying over mountains")
img.save("dragon.jpg")
```

Set your API token first:

```bash
export REVE_API_TOKEN="papi.your-token-here"
```

To create a token, visit <https://app.reve.com/account>, scroll to the bottom,
and click "Enable API."

## Claude Skill

The file [`skills/reve-image/SKILL.md`](skills/reve-image/SKILL.md) can be
installed as a Claude skill. It teaches Claude how to use the Reve Python SDK
for image generation, remixing, and editing. Add it in your Claude project or
MCP configuration to give Claude full knowledge of the Reve API.

## License

This repository is licensed under the
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
license.

