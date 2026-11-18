extends Node2D

func _draw() -> void:
	draw_circle(Vector2(1, 2), 9, Color("#243e2f"))
	draw_circle(Vector2.ZERO, 9, Color("#936329"))
	draw_circle(Vector2(0, -1), 8, Color("#f0cb74"))
	draw_circle(Vector2(0, -1), 6, Color("#b38543"), false, 1)
	draw_string(ThemeDB.fallback_font, Vector2(-3, 3), "5", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#684925"))
