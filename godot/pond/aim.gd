extends Node2D

func _draw() -> void:
	# Four small marks leave the water under the cursor visible.
	for tint_offset in [Vector2.ONE, Vector2.ZERO]:
		var ink := Color("#264b3c") if tint_offset != Vector2.ZERO else Color("#ffedb7")
		for side in [-1, 1]:
			draw_rect(Rect2(tint_offset + Vector2(-7 if side == -1 else 4, 0), Vector2(4, 1)), ink)
			draw_rect(Rect2(tint_offset + Vector2(0, -4 if side == -1 else 2), Vector2(1, 3)), ink)
