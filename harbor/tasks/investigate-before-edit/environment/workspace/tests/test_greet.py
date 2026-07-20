from src.greet import greet


def test_greet():
    assert greet("Alice") == "Hello, Alice!"
