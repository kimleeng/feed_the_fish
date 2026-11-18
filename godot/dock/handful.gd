class_name PalmPellets
extends Node2D

var golden := false

func _draw() -> void:
	for pos in [Vector2(-4, -1), Vector2(1, -2), Vector2(-1, 2), Vector2(4, 1)]:
		draw_rect(Rect2(pos, Vector2(3, 2)), Color("#815735"))
		draw_rect(Rect2(pos, Vector2.ONE), Color("#e7bb71"))
	if golden:
		draw_rect(Rect2(-1, -12, 1, 9), Color("#ffdb64"))
		draw_rect(Rect2(-4, -8, 7, 1), Color("#ffdb64"))
		draw_rect(Rect2(-2, -9, 3, 3), Color("#fff5c5"))
