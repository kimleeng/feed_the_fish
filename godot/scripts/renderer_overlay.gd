class_name PondRenderOverlay
extends Node2D

var commands: Array[Dictionary] = []

func begin() -> void:
	commands.clear()

func oval(pos: Vector2, size: Vector2, color: Color, width := -1.0) -> void:
	commands.append({"shape": "oval", "pos": pos, "size": size, "color": color, "width": width})

func line(from: Vector2, to: Vector2, color: Color, width := 1.0) -> void:
	commands.append({"shape": "line", "from": from, "to": to, "color": color, "width": width})

func rectangle(rect: Rect2, color: Color) -> void:
	commands.append({"shape": "rect", "rect": rect, "color": color})

func star(pos: Vector2, radius: float, color: Color, points := 5, angle := -PI * 0.5) -> void:
	commands.append({"shape": "star", "pos": pos, "radius": radius, "color": color, "points": points, "angle": angle})

func text(pos: Vector2, value: String, size: int, color: Color, outline := false) -> void:
	commands.append({"shape": "text", "pos": pos, "text": value, "size": size, "color": color, "outline": outline})

func finish() -> void:
	queue_redraw()

func _draw() -> void:
	for item: Dictionary in commands:
		match item.shape:
			"oval":
				var points := PackedVector2Array()
				for i in range(41):
					var angle := float(i) / 40.0 * TAU
					points.append(item.pos + Vector2(cos(angle), sin(angle)) * item.size * 0.5)
				if float(item.width) < 0.0:
					draw_colored_polygon(points, item.color)
				else:
					draw_polyline(points, item.color, item.width, true)
			"line":
				draw_line(item.from, item.to, item.color, item.width, true)
			"rect":
				draw_rect(item.rect, item.color)
			"star":
				var points := PackedVector2Array()
				for i in range(int(item.points) * 2):
					var angle := float(item.angle) + float(i) / float(item.points * 2) * TAU
					var radius: float = float(item.radius) * (1.0 if i % 2 == 0 else 0.45)
					points.append(item.pos + Vector2(cos(angle), sin(angle)) * radius)
				draw_colored_polygon(points, item.color)
			"text":
				if item.outline:
					var outline_color := Color(0.22, 0.38, 0.29, float(item.color.a))
					draw_string_outline(ThemeDB.fallback_font, item.pos, item.text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, item.size, 3, outline_color)
				draw_string(ThemeDB.fallback_font, item.pos, item.text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, item.size, item.color)
