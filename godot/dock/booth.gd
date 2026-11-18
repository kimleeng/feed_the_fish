extends Control

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#244a3f"))
	for row in range(12):
		var tint := Color("#466951").lerp(Color("#274d40"), row / 11.0)
		draw_rect(Rect2(0, row * 11, size.x, 11), tint)
	var brass := Color("#b5ae76")
	brass.a = 0.37
	draw_rect(Rect2(5, 5, size.x - 10, size.y - 10), brass, false, 1)
	draw_line(Vector2(7, 152), Vector2(size.x - 7, 152), brass)
	draw_rect(Rect2(37, 148, 66, 4), Color("#193f34"))
	draw_rect(Rect2(29, 152, 82, 2), Color("#214436"))
