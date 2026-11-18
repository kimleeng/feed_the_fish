class_name JournalMeter
extends Control

@export var segments := 1
var fraction := 0.0:
	set(value):
		fraction = clampf(value, 0.0, 1.0)
		queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("#d1c7a2"))
	draw_rect(Rect2(0, 0, roundf(size.x * fraction), size.y), Color("#688356"))
	for i in range(1, segments):
		draw_rect(Rect2(roundf(i * size.x / segments), 0, 1, size.y), Color("#f4edd7"))
