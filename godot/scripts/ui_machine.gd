extends Control
## Presentation only. The simulation remains the authority for stock and phases.

const CREAM := Color("fff8e7")
const GOLD := Color("d4aa55")
var art
var phase := "ready"
var phase_clock := 0.0
var stock_fraction := 1.0
var _machine: Texture2D
var _stock: Texture2D
var _hand: Texture2D


func setup(pond_art) -> void:
	art = pond_art
	_machine = art.raw_texture("machine-empty.png")
	_hand = art.raw_texture("hand.png")
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	queue_redraw()


func update_machine(machine: Dictionary, delta: float) -> void:
	var next_phase := str(machine.get("phase", "ready"))
	if next_phase != phase:
		phase = next_phase
		phase_clock = 0.0
	else:
		phase_clock += delta
	phase_clock = float(machine.get("stage_time", phase_clock))
	var progress := float(machine.get("refill_progress", 0.0))
	stock_fraction = clampf((float(machine.get("stock", 25)) + (25.0 - float(machine.get("stock", 25))) * progress) / 25.0, 0.0, 1.0)
	var level := clampi(roundi(stock_fraction * 25.0), 1, 25) if stock_fraction > 0.0 else 0
	_stock = art.frame("pellet-stock", "stock-%d" % maxi(level, 1)) if art != null else null
	queue_redraw()


func _draw() -> void:
	if _machine == null:
		return
	var scale_factor := minf(size.x / 300.0, size.y / 420.0)
	var machine_size := Vector2(220.0, 330.0) * scale_factor
	var origin := Vector2((size.x - machine_size.x) * 0.5, 6.0 * scale_factor)
	var apparatus := Rect2(origin, machine_size)
	# A soft grounded shadow makes the machine feel part of the panel.
	draw_set_transform(Vector2(size.x * 0.5, origin.y + machine_size.y - 3.0), 0.0, Vector2(1.0, 0.19))
	draw_circle(Vector2.ZERO, machine_size.x * 0.34, Color(0.17, 0.27, 0.20, 0.10))
	draw_set_transform(Vector2.ZERO)
	draw_texture_rect(_machine, apparatus, false)
	# Match the browser's globe registration, independent of atlas trimming.
	if _stock != null and stock_fraction > 0.0:
		var stock_size := Vector2(machine_size.x * 0.64, machine_size.x * 0.64 * 171.0 / 255.0)
		var stock_origin := origin + Vector2(machine_size.x * 0.18, machine_size.y * 0.548 - stock_size.y)
		draw_texture_rect(_stock, Rect2(stock_origin, stock_size), false)
	draw_rect(Rect2(origin + Vector2(machine_size.x * 0.5 - 11.5 * scale_factor, machine_size.y * 0.64), Vector2(23.0, 5.0) * scale_factor), Color("3d4944"))
	var center := origin + Vector2(machine_size.x * 0.5, machine_size.y * 0.70)
	var crank_angle := 0.0
	if phase == "turning":
		var t := clampf(phase_clock / 0.9, 0.0, 1.0)
		crank_angle = TAU * (t * t * (3.0 - 2.0 * t))
	draw_set_transform(center, crank_angle)
	draw_circle(Vector2.ZERO, 14.0 * scale_factor, Color("4a5853"))
	draw_circle(Vector2.ZERO, 11.5 * scale_factor, Color("c1c9be"))
	draw_circle(Vector2.ZERO, 7.0 * scale_factor, Color("edf0df"))
	draw_rect(Rect2(Vector2(-22.0, -3.5) * scale_factor, Vector2(44.0, 7.0) * scale_factor), Color("64736a"))
	draw_rect(Rect2(Vector2(-21.0, -3.5) * scale_factor, Vector2(42.0, 2.0) * scale_factor), Color("f4f0dc"))
	draw_rect(Rect2(Vector2(17.0, -8.0) * scale_factor, Vector2(7.0, 17.0) * scale_factor), Color("78877b"))
	draw_set_transform(Vector2.ZERO)
	var tray := origin + Vector2(machine_size.x * 0.5, machine_size.y * 0.87)
	if phase == "dispensing":
		for index in range(12):
			var progress := fposmod(phase_clock * 2.7 + float(index) * 0.113, 1.0)
			var point := tray + Vector2(sin(float(index) * 3.1) * 8.0, -21.0 + 25.0 * progress * progress) * scale_factor
			draw_circle(point, 2.3 * scale_factor, Color("a47036"))
	if phase == "dispensing" or phase == "collecting":
		var collecting := clampf(phase_clock / 1.05, 0.0, 1.0) if phase == "collecting" else 0.0
		if collecting < 0.38:
			for index in range(14):
				var point := tray + Vector2(sin(float(index) * 4.7) * 12.0, cos(float(index) * 2.4) * 4.0) * scale_factor
				draw_circle(point, 2.4 * scale_factor, Color("b7803d"))
		if phase == "collecting" and _hand != null:
			var reveal := smoothstep(0.0, 0.30, collecting) * (1.0 - smoothstep(0.70, 1.0, collecting))
			var hand_size := Vector2(142.0, 213.0) * scale_factor
			var hand_position := tray + Vector2(-hand_size.x * 0.5, -50.0 * scale_factor + (1.0 - reveal) * 140.0 * scale_factor)
			draw_texture_rect(_hand, Rect2(hand_position, hand_size), false, Color(1.0, 1.0, 1.0, reveal))
			if collecting >= 0.38:
				for index in range(11):
					var point := hand_position + Vector2(hand_size.x * 0.5 + sin(float(index) * 4.7) * 10.0 * scale_factor, hand_size.y * 0.35 + cos(float(index) * 2.4) * 4.0 * scale_factor)
					draw_circle(point, 2.4 * scale_factor, Color("b7803d"))
	if phase == "inserting":
		var t := clampf(phase_clock / 0.45, 0.0, 1.0)
		var coin_start := Vector2(size.x * 0.5, 374.0 * scale_factor)
		var coin_target := origin + Vector2(machine_size.x * 0.72, machine_size.y * 0.55)
		var coin_position := coin_start.lerp(coin_target, t * t)
		draw_set_transform(coin_position, t * 0.3, Vector2(1.0 - t * 0.75, 1.0 - t * 0.65))
		draw_circle(Vector2.ZERO, 24.0 * scale_factor, GOLD)
		draw_arc(Vector2.ZERO, 20.0 * scale_factor, 0.0, TAU, 36, CREAM, 1.2 * scale_factor, true)
		draw_set_transform(Vector2.ZERO)
