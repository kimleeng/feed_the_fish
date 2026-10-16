extends Control
## A light corner mask keeps the pond rounded without an offscreen viewport.

var paper := Color("f6f3eb")
var radius := 15.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	var corner := PackedVector2Array([Vector2.ZERO, Vector2(radius, 0.0)])
	for step in range(25):
		var angle := -PI * 0.5 - float(step) / 24.0 * PI * 0.5
		corner.append(Vector2.ONE * radius + Vector2(cos(angle), sin(angle)) * radius)
	var positions := [Vector2.ZERO, Vector2(size.x, 0.0), size, Vector2(0.0, size.y)]
	for index in range(4):
		draw_set_transform(positions[index], float(index) * PI * 0.5)
		draw_colored_polygon(corner, paper)
	draw_set_transform(Vector2.ZERO)
