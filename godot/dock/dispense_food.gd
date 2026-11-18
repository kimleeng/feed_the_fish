extends Node2D

@export var progress := -1.0:
	set(value):
		progress = value
		queue_redraw()

func _draw() -> void:
	if progress < 0:
		return
	for i in range(8):
		var fall := progress * 1.9 - i * 0.107
		if fall < 0 or fall > 1:
			continue
		var at := Vector2(70 + sin(i * 5.1) * (1 + fall * 8), 138 + fall * fall * 21).round()
		draw_rect(Rect2(at, Vector2(2, 2)), Color("#ab793c"))
		draw_rect(Rect2(at, Vector2.ONE), Color("#ffd378"))
