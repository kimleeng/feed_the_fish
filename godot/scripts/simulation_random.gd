extends RefCounted
## The browser's small seeded stream, isolated for placement, throws and flight.

var value: int


func _init(seed_value: int = 0) -> void:
	value = seed_value & 0xffffffff


func next() -> float:
	value = (value + 0x6d2b79f5) & 0xffffffff
	var mixed: int = ((value ^ (value >> 15)) * (1 | value)) & 0xffffffff
	mixed = (mixed ^ (mixed + (((mixed ^ (mixed >> 7)) * (61 | mixed)) & 0xffffffff))) & 0xffffffff
	return float((mixed ^ (mixed >> 14)) & 0xffffffff) / 4294967296.0
