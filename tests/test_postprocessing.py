"""Tests for reve.v1.postprocessing module."""

from reve.v1.postprocessing import effect, fit_image, remove_background, upscale


def test_upscale_default():
    result = upscale()
    assert result == {"process": "upscale", "upscale_factor": 2}


def test_upscale_custom_factor():
    result = upscale(factor=4)
    assert result == {"process": "upscale", "upscale_factor": 4}


def test_remove_background():
    result = remove_background()
    assert result == {"process": "remove_background"}


def test_fit_image_max_width():
    result = fit_image(max_width=512)
    assert result == {"process": "fit_image", "max_width": 512}


def test_fit_image_max_height():
    result = fit_image(max_height=768)
    assert result == {"process": "fit_image", "max_height": 768}


def test_fit_image_max_dim():
    result = fit_image(max_dim=1024)
    assert result == {"process": "fit_image", "max_dim": 1024}


def test_fit_image_all_params():
    result = fit_image(max_width=512, max_height=768, max_dim=1024)
    assert result == {
        "process": "fit_image",
        "max_width": 512,
        "max_height": 768,
        "max_dim": 1024,
    }


def test_fit_image_no_params():
    result = fit_image()
    assert result == {"process": "fit_image"}


def test_effect_name_only():
    result = effect("sepia")
    assert result == {"process": "effect", "effect_name": "sepia"}


def test_effect_with_parameters():
    result = effect("blur", parameters={"radius": 5})
    assert result == {
        "process": "effect",
        "effect_name": "blur",
        "effect_parameters": {"radius": 5},
    }
