class_name GameData
extends RefCounted

static var _cached: Dictionary = {}

static func load_data() -> Dictionary:
	if _cached.is_empty():
		var parsed = JSON.parse_string(FileAccess.get_file_as_string("res://godot/data/gameplay.json"))
		assert(parsed is Dictionary, "Missing Godot gameplay data. Run npm run godot:sync.")
		_cached = parsed
	return _cached

static func point(value: Variant) -> Vector2:
	if value is Vector2:
		return value
	if value is Dictionary:
		return Vector2(float(value.get("x", 0)), float(value.get("y", 0)))
	return Vector2.ZERO
