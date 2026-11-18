class_name WaterMarks
extends Node2D

enum Kind { WAKE, SPLASH, FISH, BIRD, LUCKY }

class Mark:
	var kind: Kind
	var at: Vector2
	var direction: Vector2
	var age := 0.0
	var duration: float

var _marks: Array[Mark] = []
const RIPPLES := preload("res://art/ripples.png")
const HEART := [Vector2i(-2,-2), Vector2i(0,-2), Vector2i(-3,-1), Vector2i(-2,-1),
	Vector2i(-1,-1), Vector2i(0,-1), Vector2i(1,-1), Vector2i(-2,0), Vector2i(-1,0),
	Vector2i(0,0), Vector2i(-1,1)]


func add_wake(at: Vector2, direction: Vector2) -> void:
	add_mark(Kind.WAKE, at, 0.85, direction)


func add_mark(kind: Kind, at: Vector2, duration: float, direction := Vector2.ZERO) -> void:
	var mark := Mark.new()
	mark.kind = kind
	mark.at = at.round()
	mark.direction = direction
	mark.duration = duration
	_marks.append(mark)


func advance(delta: float) -> void:
	if _marks.is_empty():
		return
	for i in range(_marks.size() - 1, -1, -1):
		_marks[i].age += delta
		if _marks[i].age >= _marks[i].duration:
			_marks.remove_at(i)
	queue_redraw()


func clear() -> void:
	_marks.clear()
	queue_redraw()


func _draw() -> void:
	for mark in _marks:
		var t := mark.age / mark.duration
		var ink := Color("#e2f2cc")
		ink.a = (1.0 - t) * 0.66
		if mark.kind == Kind.WAKE:
			var back := -mark.direction
			var normal := back.orthogonal()
			ink.a *= 0.43
			for side in [-1.0, 1.0]:
				var start := mark.at + normal * float(side) * (1.0 + 2.0 * t)
				draw_line(start.round(), (start + (back + normal * float(side) * 0.7) * 3.0).round(), ink)
			continue
		if mark.kind == Kind.LUCKY:
			ink = Color(1.0, 0.85, 0.42, 1.0 - t)
		elif mark.kind == Kind.BIRD:
			ink = Color(1.0, 0.77, 0.53, (1.0 - t) * 0.7)
		var frame := mini(11, int(t * 12.0))
		var row := 1 if mark.kind == Kind.LUCKY else 0
		var source := Rect2(frame * 40, row * 20, 40, 20)
		draw_texture_rect_region(RIPPLES, Rect2(mark.at - Vector2(20, 10), Vector2(40, 20)), source, ink)
		if mark.kind == Kind.FISH:
			var above := (mark.at + Vector2(0, -5.0 - t * 9.0)).round()
			for pixel in HEART:
				draw_rect(Rect2(above + Vector2(pixel), Vector2.ONE), Color(1.0, 0.91, 0.68, 1.0 - t))
		elif mark.kind == Kind.LUCKY:
			var above := (mark.at + Vector2(-10, -7 - t * 11.0)).round()
			draw_string(ThemeDB.fallback_font, above + Vector2.ONE, "+50", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.13, 0.24, 0.16, 1.0-t))
			draw_string(ThemeDB.fallback_font, above, "+50", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, ink)
			for j in range(5):
				var ray := Vector2.from_angle(j * TAU / 5.0)
				var star := (mark.at + ray * (4.0 + t * 18.0)).round()
				draw_rect(Rect2(star - Vector2.RIGHT, Vector2(3, 1)), ink)
				draw_rect(Rect2(star - Vector2.DOWN, Vector2(1, 3)), ink)
