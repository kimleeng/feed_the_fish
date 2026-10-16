class_name PondRenderer
extends Node2D
## Native 2D presentation of the fixed-step pond model.  All animation clocks
## come from the model, so pausing also freezes ripples, wings, and the garden.

const Art = preload("res://godot/scripts/art_library.gd")
const RenderSprite = preload("res://godot/scripts/renderer_sprite.gd")
const Overlay = preload("res://godot/scripts/renderer_overlay.gd")
const Data = preload("res://godot/scripts/game_data.gd")
const CENTER := Vector2(600.0, 389.0)
const RADII := Vector2(498.0, 230.0)
const DIRECTIONS := ["e", "se", "s", "sw", "w", "nw", "n", "ne"]
const SWIM_CYCLE := [0, 2, 1, 3]
const BITE_CADENCE := {"koi": 0.7, "carp": 0.48, "minnow": 0.24, "duck": 0.6, "gull": 0.3, "coot": 0.55, "musk-turtle": 0.9}

var world
var render_alpha := 1.0
var debug_enabled := false
var reduced_motion := false
var _data: Dictionary = {}
var _fish: Polygon2D
var _mouths: Polygon2D
var _surface: Polygon2D
var _water_lines: Overlay
var _shadows: Overlay
var _wakes: Overlay
var _feeding_ripples: Overlay
var _boosts: Overlay
var _effects_art: Overlay
var _food_water: Overlay
var _food_air: Overlay
var _shore_details: Overlay
var _refill_stream: Overlay
var _animals: Dictionary = {}
var _people: Dictionary = {}
var _directions: Dictionary = {}
var _effects: Array[Dictionary] = []
var _thrower: RenderSprite
var _thrower_details: Overlay
var _thrower_label: Label
var _machine: RenderSprite
var _machine_fill: RenderSprite
var _machine_details: Overlay
var _lid: RenderSprite
var _employee: RenderSprite
var _shore: Node2D
var _built := false
var _last_draw_elapsed := -1.0

func setup(model) -> void:
	world = model
	_data = Data.load_data()
	if not _built:
		_build_scene()
	reset_world(model)

func set_debug_enabled(enabled: bool) -> void:
	debug_enabled = enabled
	if _built:
		_boosts.visible = enabled
		advance_draw()

func reset_world(model) -> void:
	world = model
	for collection: Dictionary in [_animals, _people]:
		for value: Dictionary in collection.values():
			for node in value.values():
				if node is Node:
					node.queue_free()
		collection.clear()
	_directions.clear()
	_effects.clear()
	_last_draw_elapsed = -1.0
	if _built:
		for animal: Dictionary in world.animals:
			_spawn_animal(animal)
		advance_draw()

func _process(_delta: float) -> void:
	if world != null and _built:
		advance_draw()

func _build_scene() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var background := Sprite2D.new()
	background.name = "GardenBackdrop"
	background.texture = Art.raw_texture("pond.png")
	background.position = Vector2(600, 400)
	background.scale = Vector2(1200, 800) / background.texture.get_size()
	add_child(background)
	_fish = _clip_layer("SubmergedAnimals", 10)
	_surface = _clip_layer("WaterReflections", 20)
	var reflections := Sprite2D.new()
	reflections.texture = background.texture
	reflections.position = background.position
	reflections.scale = background.scale
	reflections.modulate.a = 0.33
	_surface.add_child(reflections)
	_water_lines = _overlay("WindShimmer", 1, _surface)
	_food_water = _overlay("FloatingPellets", 1, _surface)
	_mouths = _clip_layer("SurfaceMouths", 25)
	_shadows = _overlay("FlyingBirdShadows", 4, _surface)
	_feeding_ripples = _overlay("FeedingWaterlines", 6, _surface)
	_wakes = _overlay("BirdWakes", 7, _surface)
	_boosts = _overlay("DebugBoostMeters", 47)
	_boosts.visible = debug_enabled
	_food_air = _overlay("AirbornePellets", 45)
	_effects_art = _overlay("PondCelebrations", 65)
	_shore_details = _overlay("GardenFootShadows", 39)
	_refill_stream = _overlay("EmployeePouringPellets", 43)
	_shore = Node2D.new()
	_shore.name = "GardenWalkersAndMachine"
	_shore.z_index = 40
	_shore.y_sort_enabled = true
	add_child(_shore)
	_thrower = RenderSprite.new()
	_thrower.name = "DockThrower"
	_thrower.position = Data.point(_data.dock_position)
	_shore.add_child(_thrower)
	_thrower_details = _overlay("ThrowerHandPellets", 42)
	_thrower_label = Label.new()
	_thrower_label.name = "LuckyThrowLabel"
	_thrower_label.add_theme_font_size_override("font_size", 9)
	_thrower_label.add_theme_color_override("font_color", Color("ffebae"))
	_thrower_label.add_theme_color_override("font_shadow_color", Color("345a48"))
	_thrower_label.add_theme_constant_override("shadow_outline_size", 4)
	_thrower_label.z_index = 44
	add_child(_thrower_label)
	_machine = RenderSprite.new()
	_machine.name = "PelletMachine"
	_machine.position = Data.point(_data.machine_position)
	_machine.set_frame("scene-machine-empty", "machine", 154.0, true)
	var machine_source: Vector2 = _machine.source_size
	_machine.crop_source(Rect2(0, 112, machine_source.x, machine_source.y - 112))
	_machine.pose()
	_shore.add_child(_machine)
	_machine_fill = RenderSprite.new()
	_machine_fill.name = "MachineStock"
	_machine.add_child(_machine_fill)
	_lid = RenderSprite.new()
	_lid.name = "HopperLid"
	_machine.add_child(_lid)
	_machine_details = _overlay("MachinePricePlaque", 0, _machine)
	_employee = RenderSprite.new()
	_employee.name = "RestockingEmployee"
	_shore.add_child(_employee)
	_built = true

func _clip_layer(title: String, depth: int) -> Polygon2D:
	var result := Polygon2D.new()
	result.name = title
	var points := PackedVector2Array()
	for index in range(96):
		var angle := float(index) / 96.0 * TAU
		points.append(CENTER + Vector2(cos(angle), sin(angle)) * RADII)
	result.polygon = points
	result.color = Color.WHITE
	result.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	result.z_index = depth
	add_child(result)
	return result

func _overlay(title: String, depth: int, parent: Node = null) -> Overlay:
	var result := Overlay.new()
	result.name = title
	result.z_index = depth
	(parent if parent != null else self).add_child(result)
	return result

func _spawn_animal(animal: Dictionary) -> void:
	var item: Dictionary = {}
	var kind: String = animal.profile.kind
	var sprite := RenderSprite.new()
	sprite.name = "Animal%d" % int(animal.id)
	if kind == "bird":
		sprite.z_index = 30
		add_child(sprite)
	else:
		_fish.add_child(sprite)
	item.sprite = sprite
	if kind == "fish":
		var body := RenderSprite.new()
		body.name = "FeedingFish%d" % int(animal.id)
		_fish.add_child(body)
		item.body = body
		var mouth := RenderSprite.new()
		mouth.name = "RaisedFishLips%d" % int(animal.id)
		_mouths.add_child(mouth)
		item.mouth = mouth
	elif kind == "turtle":
		var head := RenderSprite.new()
		head.name = "TurtleSurfaceHead"
		head.z_index = 30
		add_child(head)
		item.head = head
	_animals[animal.id] = item

func advance_draw(_delta := 0.0) -> void:
	if world == null or not _built:
		return
	var alpha := clampf(render_alpha, 0.0, 1.0)
	var time := maxf(0.0, float(world.elapsed) - (1.0 - alpha) / 60.0) if not world.paused else float(world.elapsed)
	for layer: Overlay in [_water_lines, _shadows, _wakes, _feeding_ripples, _boosts, _effects_art, _food_water, _food_air, _shore_details, _refill_stream, _thrower_details, _machine_details]:
		layer.begin()
	_update_water(time)
	for animal: Dictionary in world.animals:
		if not _animals.has(animal.id):
			_spawn_animal(animal)
		_update_animal(animal, alpha, time)
	_update_food(alpha, time)
	_update_people(alpha)
	_update_employee(alpha, time)
	_update_machine()
	_update_thrower(time)
	_update_effects(time)
	for layer: Overlay in [_water_lines, _shadows, _wakes, _feeding_ripples, _boosts, _effects_art, _food_water, _food_air, _shore_details, _refill_stream, _thrower_details, _machine_details]:
		layer.finish()
	_last_draw_elapsed = time

func _direction(heading: float, animal_id: int) -> String:
	if _directions.has(animal_id):
		var previous: int = DIRECTIONS.find(_directions[animal_id])
		if absf(angle_difference(float(previous) * PI / 4.0, heading)) < PI / 8.0 + 0.08:
			return _directions[animal_id]
	var result: String = DIRECTIONS[posmod(roundi(heading / (PI / 4.0)), 8)]
	_directions[animal_id] = result
	return result

func _eating_stage(animal: Dictionary) -> String:
	var left := float(animal.chew_left)
	var duration := float(animal.meal_duration)
	if animal.state != "chewing" or left <= 0.0 or duration <= 0.0:
		return ""
	var age := maxf(0.0, duration - left)
	var settle := minf(0.14, duration * 0.12)
	var swallow := minf(0.38, duration * 0.24)
	var bite := minf(0.2, duration * 0.2)
	if left <= settle:
		return "rest"
	if left <= swallow + settle:
		return "swallow"
	if age < bite:
		return "bite"
	var cadence: float = BITE_CADENCE.get(animal.profile.id, 0.5)
	return "chew" if fmod(age - bite, cadence) < cadence * 0.58 else "bite"

func _surface_amount(animal: Dictionary) -> float:
	if animal.state != "chewing" or float(animal.meal_duration) <= 0.0 or float(animal.chew_left) <= 0.0:
		return 0.0
	var duration := float(animal.meal_duration)
	var amount := clampf(minf((duration - float(animal.chew_left)) / minf(0.18, duration * 0.25), float(animal.chew_left) / minf(0.24, duration * 0.28)), 0.0, 1.0)
	return smoothstep(0.0, 1.0, amount)

func _turtle_amount(animal: Dictionary) -> float:
	if float(animal.surface_left) <= 0.0:
		return 0.0
	var amount := clampf(minf((float(animal.surface_duration) - float(animal.surface_left)) / 0.35, float(animal.surface_left) / 0.75), 0.0, 1.0)
	return smoothstep(0.0, 1.0, amount)

func _update_animal(animal: Dictionary, alpha: float, time: float) -> void:
	var item: Dictionary = _animals[animal.id]
	var sprite: RenderSprite = item.sprite
	var profile: Dictionary = animal.profile
	var kind: String = profile.kind
	var bird := kind == "bird"
	var airborne: bool = bird and not animal.flight.is_empty()
	var position: Vector2 = animal.previous_pos.lerp(animal.pos, alpha)
	var heading := lerp_angle(float(animal.previous_heading), float(animal.heading), alpha)
	var altitude := lerpf(float(animal.previous_altitude), float(animal.altitude), alpha)
	var direction := _direction(heading, animal.id)
	var phase_rate := 1.4 if bird else float(profile.speed) / 24.0
	if airborne:
		var flight_progress: float = float(animal.flight.elapsed) / float(animal.flight.duration)
		phase_rate = float(profile.flight.flapRate) * (1.0 + 0.5 * (1.0 - smoothstep(0.0, 0.28, flight_progress)))
	elif animal.boosting:
		phase_rate *= 1.4
	elif not animal.moving:
		phase_rate *= 0.4
	var animation_cycles := float(animal.animation_phase) - (phase_rate * (1.0 - alpha) / 60.0 if not world.paused else 0.0)
	var phase := animation_cycles * TAU
	var stroke: int = SWIM_CYCLE[posmod(floori(animation_cycles * 2.0), 4)] if animal.moving else 0
	var stage := _eating_stage(animal)
	var feeding := stage != "" and stage != "rest"
	var atlas := "bird-flyers" if airborne else "bird-swimmers" if bird else "turtle-swimmer" if kind == "turtle" else "fish-swimmers"
	var frame := "%s-%s-%d" % [str(profile.texture), direction, stroke]
	var mode := "paddle" if bird else "swim"
	var wing_extent := 1.0
	var drawing_size := float(profile.size)
	if airborne:
		var wing := cos(phase)
		# One registered source keeps the head, breast, and feather roots in the
		# same place through both halves of the beat.  The mesh supplies all the
		# intervening angles, including the downward stroke.
		stroke = 0
		frame = "%s-%s-%d" % [str(profile.texture), direction, stroke]
		var flight_progress: float = float(animal.flight.elapsed) / float(animal.flight.duration)
		var unfold := minf(smoothstep(0.0, 0.14, flight_progress), 1.0 - smoothstep(0.84, 1.0, flight_progress))
		wing_extent = lerpf(0.025, wing * (0.72 if wing < 0.0 else 1.0), unfold)
		drawing_size *= lerpf(0.84, 1.0, unfold)
		mode = "flight"
	elif feeding and kind != "turtle":
		atlas = "animal-eating"
		var eating_pose := "chew" if stage == "swallow" and kind == "fish" else stage
		frame = "%s-%s-%s" % [str(profile.texture), direction, eating_pose]
		mode = "still"
	sprite.set_frame(atlas, frame, drawing_size)
	sprite.visible = true
	sprite.position = position - Vector2(0, altitude)
	if bird and not airborne:
		sprite.position.y += sin(time * 1.8 + float(animal.phase)) * 0.65
	sprite.z_index = 46 if airborne else 30 if bird else int(position.y / 100.0)
	# Small continuous banks preserve the registered eight views while smoothing
	# turns and the four sampled paddle/tail poses between their authored frames.
	var view_heading := float(DIRECTIONS.find(direction)) * PI / 4.0
	var turn_bank := clampf(angle_difference(view_heading, heading), -0.42, 0.42)
	sprite.rotation = turn_bank * (0.18 if bird else 0.35)
	sprite.pose(mode if animal.moving or airborne else "still", phase, heading, 1.0 if animal.moving else 0.25, wing_extent)
	var tint := Color.hex(int(profile.get("tint", 0xffffff)) * 256 + 255)
	var underwater_alpha := 0.83 + float(int(animal.id) % 4) * 0.025
	sprite.modulate = tint
	if kind == "fish":
		var amount := _surface_amount(animal)
		sprite.modulate.a = underwater_alpha * (1.0 - amount)
		_update_feeding_fish(animal, item, direction, position, amount, underwater_alpha, tint)
	elif kind == "turtle":
		var amount := _turtle_amount(animal)
		sprite.modulate.a = underwater_alpha * (1.0 if debug_enabled else amount)
		sprite.visible = sprite.modulate.a > 0.001
		var head: RenderSprite = item.head
		var head_frame := "%s-%s-%s" % [str(profile.texture), direction, stage] if feeding else "musk-turtle-%s-head" % direction
		head.set_frame("animal-eating" if feeding else "turtle-swimmer", head_frame, float(profile.size))
		head.position = position - Vector2(0, amount * 3.0)
		head.pose()
		head.modulate.a = amount
		head.visible = amount > 0.001
		if amount > 0.0:
			var offset: Dictionary = head.data.get("surfaceOffset", {"x": 0, "y": 0})
			_wakes.oval(position + Vector2(float(offset.x), float(offset.y)) * float(profile.size) + Vector2(0, 2), Vector2(14 + sin(time * 2) * 2, 5), Color(0.84, 0.9, 0.74, amount * 0.4), 0.8)
	if airborne:
		var relative_altitude := altitude / maxf(1.0, float(profile.flight.height))
		_shadows.oval(position + Vector2(relative_altitude * 5.0, float(profile.size) * 0.13), Vector2(float(profile.size) * (0.65 - relative_altitude * 0.15), float(profile.size) * 0.16), Color(0.09, 0.18, 0.20, 0.15 - relative_altitude * 0.055))
	elif bird:
		var size := float(profile.size)
		_wakes.oval(position + Vector2(0, size * 0.20), Vector2(size * 0.55, size * 0.13), Color(0.77, 0.86, 0.76, 0.2), 0.85)
		if animal.moving:
			var axis := Vector2.from_angle(heading)
			var tail := position + Vector2(-axis.x * size * 0.28, size * 0.17 - axis.y * size * 0.20)
			for side in [-1, 1]:
				_wakes.line(tail, tail + Vector2(-axis.x * 15 - axis.y * float(side) * 7, -axis.y * 10 + axis.x * float(side) * 5), Color(0.7, 0.83, 0.73, 0.20), 1.1)
	if debug_enabled and kind != "turtle":
		var width := clampf(float(profile.size) * 0.26, 10.0, 16.0)
		var at := sprite.position + Vector2(-width * 0.5, sprite.visible_top() - 5)
		var recently_fed: bool = animal.last_ate_at != null and float(world.elapsed) - float(animal.last_ate_at) < 20.0
		var color := Color("f3d28c") if animal.boosting else Color("9cafb5") if recently_fed else Color("aed1a0")
		_boosts.rectangle(Rect2(at - Vector2.ONE, Vector2(width + 2, 4)), Color(0.12, 0.24, 0.23, 0.75))
		_boosts.rectangle(Rect2(at, Vector2(width * float(animal.boost_charge), 2)), color)

func _update_feeding_fish(animal: Dictionary, item: Dictionary, direction: String, position: Vector2, amount: float, underwater_alpha: float, tint: Color) -> void:
	var body: RenderSprite = item.body
	var mouth: RenderSprite = item.mouth
	body.visible = amount > 0.001
	mouth.visible = body.visible
	if not body.visible:
		return
	var stage := "bite" if _eating_stage(animal) == "bite" else "chew"
	var frame := "%s-%s-surface-%s" % [str(animal.profile.texture), direction, stage]
	body.set_frame("animal-eating", frame, float(animal.profile.size))
	mouth.set_frame("animal-eating", frame, float(animal.profile.size))
	var lip: Dictionary = body.data.surfaceMouth
	mouth.crop_source(Rect2(float(lip.x), float(lip.y), float(lip.w), float(lip.h)))
	var at := position - Vector2(0, float(animal.profile.size) * 0.055 * amount)
	body.position = at
	mouth.position = at
	body.pose()
	mouth.pose()
	body.modulate = tint
	body.modulate.a = underwater_alpha * amount
	mouth.modulate = tint
	mouth.modulate.a = amount
	var waterline := at + body.point_from_source(Vector2(float(lip.waterX), float(lip.waterY)))
	var age := float(animal.meal_duration) - float(animal.chew_left)
	var spread := fmod(age, 0.8) / 0.8
	var width := maxf(6.0, float(lip.w) * body.reference_scale * 1.45)
	_feeding_ripples.oval(waterline + Vector2(0, 0.6), Vector2(width, width * 0.27), Color(0.15, 0.31, 0.25, amount * 0.55), 0.8)
	_feeding_ripples.oval(waterline, Vector2(width, width * 0.27), Color(0.96, 0.93, 0.77, amount * 0.8), 0.9)
	_feeding_ripples.oval(waterline, Vector2(width + spread * 12, width * 0.3 + spread * 4), Color(0.84, 0.90, 0.75, amount * (1 - spread) * 0.4), 0.8)

func _update_food(alpha: float, time: float) -> void:
	for pellet: Dictionary in world.food:
		if time < float(pellet.release_at):
			continue
		var airborne: bool = pellet.phase == "air"
		var position: Vector2 = pellet.previous_pos.lerp(pellet.pos, alpha)
		var pulse := 1.0 + sin(time * 5.0 + float(pellet.id)) * 0.06 if pellet.lucky else 1.0
		var size := (1.1 if airborne else maxf(0.5, float(pellet.amount))) * pulse
		var opacity := 1.0 if airborne or float(pellet.age) <= 1.7 else 0.65 if pellet.lucky else 0.4
		var layer := _food_air if airborne else _food_water
		if pellet.lucky:
			layer.oval(position, Vector2(14, 10) * size, Color(1.0, 0.84, 0.49, 0.22 * opacity))
			layer.star(position, 4.5 * size, Color(1.0, 0.87, 0.51, opacity))
		else:
			layer.rectangle(Rect2(position - Vector2(2.25, 1.6) * size, Vector2(4.5, 3.2) * size), Color(0.52, 0.35, 0.20, opacity))
			layer.rectangle(Rect2(position - Vector2(1.75, 1.2) * size, Vector2(3.5, 2.3) * size), Color(0.74, 0.55, 0.33, opacity))

func _update_people(alpha: float) -> void:
	var present: Dictionary = {}
	for person: Dictionary in world.ambience.people:
		var id: int = person.id
		present[id] = true
		if not _people.has(id):
			var sprite := RenderSprite.new()
			sprite.name = "Visitor%d" % id
			_shore.add_child(sprite)
			_people[id] = {"sprite": sprite}
		var sprite: RenderSprite = _people[id].sprite
		var watching: bool = person.phase == "watching"
		var atlas := "garden-observers" if watching and int(person.look) < 3 else "people-walking"
		var frame: String = str(person.design) + ("-watch" if watching else "-step-%d" % posmod(floori(float(person.cycles) * 8.0), 8))
		sprite.set_frame(atlas, frame, float(person.height), true)
		sprite.position = person.previous_pos.lerp(person.pos, alpha)
		sprite.visible = true
		sprite.pose("still" if watching else "human", float(person.cycles) * TAU, 0.0, 0.6, 1.0, Vector2.ZERO, not watching and int(person.direction) == -1)
		var shadow_size := Vector2(44, 8) if person.kind == "adult" else Vector2(30, 6)
		_shore_details.oval(sprite.position - Vector2(0, 1), shadow_size, Color(0.29, 0.25, 0.20, 0.2))
	for id in _people.keys():
		if not present.has(id):
			_people[id].sprite.queue_free()
			_people.erase(id)

func _employee_frame(person: Dictionary) -> String:
	if person.walking:
		return "employee-step-%d" % posmod(floori(float(person.cycles) * 8.0), 8)
	var progress := float(person.phase_time) / maxf(0.001, float(_data.restock_timing.get(person.phase, 1.0)))
	match str(person.phase):
		"opening": return "open-reach" if progress < 0.25 else "open" if progress < 0.75 else "open-return"
		"lifting": return "lift-half" if progress < 0.25 else "lift-ready" if progress < 0.5 else "lift-tip" if progress < 0.75 else "lift"
		"pouring": return "pour"
		"closing": return "close-lower" if progress < 0.3 else "close-reach" if progress < 0.5 else "close" if progress < 0.85 else "close-return"
	return "open-return"

func _update_employee(alpha: float, _time: float) -> void:
	var person: Dictionary = world.ambience.employee
	_employee.visible = person.phase != "away"
	if not _employee.visible:
		return
	_employee.set_frame("people-walking" if person.walking else "garden-employee", _employee_frame(person), float(_data.employee_height), true)
	_employee.position = person.previous_pos.lerp(person.pos, alpha)
	_employee.pose("human" if person.walking else "still", float(person.cycles) * TAU, 0.0, 0.7, 1.0, Vector2.ZERO, int(person.direction) == -1)
	_shore_details.oval(_employee.position - Vector2(0, 1), Vector2(43, 8), Color(0.29, 0.25, 0.20, 0.2))
	if person.phase == "pouring" and _employee.data.has("pour"):
		var pin: Dictionary = _employee.data.pour
		var origin := _employee.position + _employee.point_from_source(Vector2(float(pin.x), float(pin.y)), int(person.direction) == -1)
		var target := Data.point(_data.machine_position) - Vector2(0, 138)
		for index in range(10):
			var t := fmod(float(person.phase_time) * 2.4 + float(index) / 10.0, 1.0)
			var position := Vector2(lerpf(origin.x, target.x, t) + sin(float(index) * 2.3) * 1.5, lerpf(origin.y, target.y, t * t))
			_refill_stream.rectangle(Rect2(position, Vector2(1.5, 1.8)), Color("c49b58") if index % 2 else Color("956435"))

func _update_machine() -> void:
	var position := Data.point(_data.machine_position)
	var stock := float(world.machine.stock)
	if world.machine.restocking:
		stock += (25.0 - stock) * clampf(float(world.machine.get("refill_progress", 0.0)), 0.0, 1.0)
	var level := 0 if stock <= 0.0 else clampi(roundi(stock), 1, 25)
	_machine_fill.visible = level > 0
	if level > 0:
		var name := "stock-%d" % level
		var data := Art.frame_data("pellet-stock", name)
		var height := 32.5 / float(data.sourceSize.w) * float(data.sourceSize.h)
		_machine_fill.set_frame("pellet-stock", name, height, true)
		_machine_fill.position = -Vector2(0, 1025.0 * _machine.reference_scale)
		_machine_fill.pose()
	var lid_data := Art.frame_data("scene-machine-empty", "lid")
	_lid.set_frame("scene-machine-empty", "lid", float(lid_data.sourceSize.h) * _machine.reference_scale, true)
	# Move the mesh origin onto the left hinge before rotating the cap.
	_lid.source_origin = Vector2(0, _lid.source_size.y)
	_lid.position = Vector2(-_lid.source_size.x * _machine.reference_scale * 0.5, -1322.0 * _machine.reference_scale)
	_lid.rotation = -float(world.ambience.employee.lid_open) * PI * 0.5
	_lid.pose()
	_machine_details.rectangle(Rect2(Vector2(-11.5, -74), Vector2(23, 12)), Color("746b50"))
	_machine_details.rectangle(Rect2(Vector2(-11, -73.5), Vector2(22, 11)), Color("e5d8b4"))
	_machine_details.text(Vector2(-8.5, -65.3), "5 kr", 8, Color("344a3d"))

func _hand_for_frame(frame: String, facing: int) -> Vector2:
	var pin: Dictionary = _data.throw_hands.get(frame, _data.throw_hands.rest)
	return Data.point(pin.right if facing == 1 else pin.left)

func _update_thrower(time: float) -> void:
	var action: Dictionary = world.current_throw()
	var frame := "rest" if int(world.handfuls) > 0 else "empty"
	var hand := Vector2.ZERO
	var facing: int = world.throw_facing
	var hand_shift := Vector2.ZERO
	var holding: bool = int(world.handfuls) > 0 and world.machine.phase == "ready"
	var lucky: bool = holding and not world.next_throw.is_empty() and bool(world.next_throw.get("lucky", false))
	if not action.is_empty():
		var age := maxf(0.0, time - float(action.started_at))
		facing = int(action.facing)
		var motion: Dictionary = _data.throw_motions[action.animation]
		var frames: Array = motion.frames
		var index := 0
		for next in range(frames.size()):
			if age < float(frames[next].at):
				break
			index = next
		frame = str(frames[index].frame)
		hand = _hand_for_frame(frame, facing)
		if index + 1 < frames.size():
			var a: Dictionary = frames[index]
			var b: Dictionary = frames[index + 1]
			var blend := smoothstep(float(a.at), float(b.at), age)
			var next_hand := _hand_for_frame(str(b.frame), facing)
			var desired_hand := hand.lerp(next_hand, blend)
			hand_shift = desired_hand - hand
			hand = desired_hand
		holding = age < float(motion.releaseDelay)
		lucky = bool(action.lucky) and holding
	else:
		hand = _hand_for_frame(frame, facing)
	_thrower.set_frame("dock-thrower", frame, float(_data.thrower_height), true)
	var unmirrored_shift := Vector2(-hand_shift.x, hand_shift.y) if facing == 1 else hand_shift
	_thrower.pose("throw", time * 1.2, 0.0, 1.0, 1.0, unmirrored_shift, facing == 1)
	_shore_details.oval(_thrower.position - Vector2(0, 1), Vector2(38, 8), Color(0.31, 0.24, 0.17, 0.23))
	if holding:
		_thrower_details.rectangle(Rect2(hand + Vector2(-3, -1), Vector2(2, 2)), Color("a97942"))
		_thrower_details.rectangle(Rect2(hand + Vector2(0, 0), Vector2(2, 2)), Color("b98b4c"))
		_thrower_details.rectangle(Rect2(hand + Vector2(-1, -3), Vector2(2, 2)), Color("96663d"))
	if lucky:
		var pulse := 1.0 + sin(time * 4.0) * 0.07
		_thrower_details.oval(hand - Vector2(0, 4), Vector2(34, 24) * pulse, Color(1.0, 0.86, 0.47, 0.23))
		_thrower_details.star(hand - Vector2(0, 4), 5.5 * pulse, Color("ffe494"))
	_thrower_label.visible = lucky or (not action.is_empty() and bool(action.get("lucky", false)))
	_thrower_label.text = "LUCKY PELLET" if holding else "LUCKY THROW"
	_thrower_label.position = _thrower.position + Vector2(-42, -float(_data.thrower_height) - 24)

func _update_water(time: float) -> void:
	if reduced_motion:
		return
	var wind: Dictionary = world.ambience.wind
	var strength := float(wind.get("strength", 0.2))
	var drift := Vector2(float(wind.get("x", 0.0)), float(wind.get("y", 0.0)))
	for index in range(54):
		var phase := float(index) * 2.399963229728653
		var radial := sqrt((float(index) + 0.5) / 54.0) * 0.91
		var life := 3.1 + float(index % 5) * 0.39
		var age := fmod(time + float(index) * 0.71, life) / life
		var fade := pow(sin(age * PI), 2.0)
		var center := CENTER + Vector2(cos(phase), sin(phase)) * RADII * radial
		center += drift * (age - 0.5) * 18.0 + Vector2(sin(time * 0.5 + phase) * 1.1, 0)
		var width := (5.0 + float(index % 4) * 2.0) * (1.0 + strength)
		var opacity := fade * (0.14 + strength * 0.24)
		_water_lines.rectangle(Rect2(center + Vector2(1.5, 1.8), Vector2(width, 1.2)), Color(0.08, 0.36, 0.35, opacity * 0.5))
		_water_lines.rectangle(Rect2(center, Vector2(width, 1.3)), Color(1.0, 0.95, 0.77, opacity))
		_water_lines.rectangle(Rect2(center + Vector2(3.0, 4.0), Vector2(width * 0.5, 1.0)), Color(0.89, 0.94, 0.82, opacity * 0.45))

func handle_events(events: Array) -> void:
	if world == null:
		return
	for event: Dictionary in events:
		var type: String = str(event.get("type", ""))
		var position: Vector2 = event.get("position", CENTER)
		if type == "splash":
			_effects.append({"kind": "ripple", "at": float(world.elapsed), "pos": position, "color": Color("e4efcc"), "alpha": 0.45, "radius": 35.0})
		elif type == "bird_splash":
			var landing: bool = event.get("phase", "") == "landing"
			_effects.append({"kind": "ripple", "at": float(world.elapsed), "pos": position, "color": Color("d5e7d2"), "alpha": 0.45 if landing else 0.3, "radius": 30.0 if landing else 20.0})
		elif type == "bite":
			if event.get("phase", "water") == "water":
				_effects.append({"kind": "ripple", "at": float(world.elapsed), "pos": position, "color": Color("f7c187") if event.get("kind", "") == "bird" else Color("e4f5ba"), "alpha": 0.3, "radius": 23.0})
			if event.get("kind", "") == "fish" and int(event.get("bonus", 0)) <= 0:
				_effects.append({"kind": "heart", "at": float(world.elapsed), "pos": position})
		elif type == "lucky":
			_effects.append({"kind": "lucky", "at": float(world.elapsed), "pos": position, "bonus": int(event.get("bonus", 50))})
	# A held key can produce many throws; bounded visual history never affects
	# feeding, probability, or food lifetimes in the gameplay model.
	if _effects.size() > 160:
		_effects = _effects.slice(_effects.size() - 160)

func _update_effects(time: float) -> void:
	var remaining: Array[Dictionary] = []
	for effect: Dictionary in _effects:
		var age := maxf(0.0, time - float(effect.at))
		var duration := 1.8 if effect.kind == "lucky" else 1.6 if effect.kind == "heart" else 1.5
		if age >= duration:
			continue
		remaining.append(effect)
		var progress := age / duration
		var opacity := 1.0 - progress
		var position: Vector2 = effect.pos
		if effect.kind == "ripple":
			var color: Color = effect.color
			color.a = float(effect.alpha) * opacity
			var width := lerpf(8.0, float(effect.radius) * 2.0, progress)
			_wakes.oval(position, Vector2(width, width * 0.5), color, 0.9)
		elif effect.kind == "heart":
			# Two lobes and a tapered point keep the tiny thank-you mark crisp.
			var at := position + Vector2(0, -15 - 20 * progress)
			_effects_art.oval(at + Vector2(-1.3, -1), Vector2(3.6, 3.4), Color(1.0, 0.95, 0.73, opacity))
			_effects_art.oval(at + Vector2(1.3, -1), Vector2(3.6, 3.4), Color(1.0, 0.95, 0.73, opacity))
			_effects_art.star(at + Vector2(0, 1), 2.6, Color(1.0, 0.95, 0.73, opacity), 3, PI * 0.5)
		elif effect.kind == "lucky":
			for index in range(8):
				var angle := float(index) * PI / 4.0
				var star_position := position + Vector2(cos(angle) * 32, sin(angle) * 20 - 12) * sin(minf(1.0, age / 1.1) * PI * 0.5) - Vector2(0, progress * 20)
				_effects_art.star(star_position, 4.0, Color(1.0, 0.88, 0.57, opacity))
			_wakes.oval(position, Vector2(16 + progress * 108, 8 + progress * 54), Color(1.0, 0.84, 0.46, opacity * 0.5), 1.0)
			_effects_art.text(position + Vector2(-26, -26 - progress * 20), "+%d lucky" % int(effect.bonus), 15, Color(1.0, 0.94, 0.69, opacity), true)
	_effects = remaining
