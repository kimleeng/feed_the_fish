class_name PondPellet
extends Node2D

signal landed(at: Vector2)

const FLOAT_TIME := 1.7
const LIFETIME := 13.0
const FULL_PELLET := 100 # Hundredths keep every shared bite exact.

var target: Vector2
var origin: Vector2
var airborne := true
var height := 0.0
var water_age := 0.0
var flight := 0.0
var duration: float
var arc: float
var remaining := FULL_PELLET
var lucky := false
var bonus_claimed := false
var drift_phase: float


func launch(start: Vector2, finish: Vector2, motion: StringName, golden: bool, phase: float) -> void:
	origin = start
	position = start
	target = finish
	lucky = golden
	drift_phase = phase
	var distance := start.distance_to(finish)
	duration = 0.6 + distance / 285.0
	arc = 32.0 + distance * 0.12
	if motion == &"sweep":
		duration *= 0.84
		arc *= 0.76
	elif motion == &"lob":
		duration *= 1.2
		arc *= 1.32
	z_index = 8
	reset_physics_interpolation()


func advance(delta: float) -> void:
	if airborne:
		flight = minf(flight + delta, duration)
		var progress := flight / duration
		position = origin.lerp(target, progress)
		height = arc * 4.0 * progress * (1.0 - progress)
		if flight >= duration:
			airborne = false
			z_index = 4
			landed.emit(position)
	else:
		water_age += delta
		var drift := cos(drift_phase) - cos(drift_phase + water_age * 0.78)
		var offset := Vector2(drift * 0.8, water_age * 0.42)
		position = GardenPond.confine(target + offset, 0.995)
		if water_age > FLOAT_TIME:
			z_index = 2
	queue_redraw()


func available_to(bird: bool) -> bool:
	if remaining <= 0 or water_age >= LIFETIME:
		return false
	return (bird and water_age <= FLOAT_TIME) or (not bird and not airborne)


func within_reach(at: Vector2, radius: float) -> bool:
	if airborne and (flight < duration * 0.5 or height > 9.0):
		return false
	return at.distance_squared_to(position + Vector2.UP * height) <= radius * radius


func _draw() -> void:
	var spot := Vector2(0, -roundf(height))
	var sunken := water_age > FLOAT_TIME
	if airborne and GardenPond.in_water(position):
		draw_rect(Rect2(-2, 0, 5, 1), Color(0.035, 0.16, 0.14, 0.50))
	if lucky:
		var length := 2 if sunken else 3
		var edge := Color("#ae8034") if not sunken else Color("#9a9561")
		draw_rect(Rect2(spot + Vector2(-length, 0), Vector2(2 * length + 1, 1)), edge)
		draw_rect(Rect2(spot + Vector2(0, -length), Vector2(1, 2 * length + 1)), edge)
		draw_rect(Rect2(spot - Vector2.ONE, Vector2(3, 3)), Color("#ffdc70"))
		draw_rect(Rect2(spot, Vector2.ONE), Color("#fff5cc"))
		if not sunken and sin((flight + water_age) * 9.0 + drift_phase) > 0.45:
			draw_rect(Rect2(spot + Vector2(3, -3), Vector2.ONE), Color("#fff5cc"))
	else:
		var width := 3 if remaining > 45 else 2
		draw_rect(Rect2(spot - Vector2.ONE, Vector2(width, 2)), Color("#815738") if not sunken else Color("#466e58"))
		draw_rect(Rect2(spot + Vector2(0, -1), Vector2.ONE), Color("#f1c87f") if not sunken else Color("#a4ad79"))
