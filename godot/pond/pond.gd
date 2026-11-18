class_name GardenPond
extends Node2D

signal meal(swimmer: PondSwimmer, units: int, bonus: int)
signal thrown
signal machine_requested

const CENTER := Vector2(240, 157)
const RADII := Vector2(209, 91)
const PROFILES: Array[PondSpecies] = [
	preload("res://pond/species/koi.tres"), preload("res://pond/species/carp.tres"),
	preload("res://pond/species/minnow.tres"), preload("res://pond/species/duck.tres"),
	preload("res://pond/species/gull.tres"), preload("res://pond/species/coot.tres")
]
const SWIMMER := preload("res://pond/swimmer.tscn")

class Shoal:
	var center: Vector2
	var destination: Vector2
	var pulse := 0.0
	var phase: float

@onready var marks: WaterMarks = $WaterMarks
@onready var hand: ThrowingHand = $Hand
@onready var surface: ShaderMaterial = $Reflections.material
var swimmers: Array[PondSwimmer] = []
var food: Array[PondPellet] = []
var schools: Array[Shoal] = []
var rng := RandomNumberGenerator.new()
var fish_population := 0
var elapsed := 0.0
var _water_tick := -1


static func in_water(point: Vector2) -> bool:
	return ((point - CENTER) / RADII).length_squared() < 1.0


static func confine(point: Vector2, limit: float) -> Vector2:
	var local := (point - CENTER) / RADII
	if local.length_squared() <= limit * limit:
		return point
	return CENTER + local.normalized() * limit * RADII


func _ready() -> void:
	$DispenserPost/OpenCounter.pressed.connect(machine_requested.emit)
	$DispenserPost/OpenCounter.mouse_entered.connect($Aim.hide)
	hand.released.connect(_scatter)
	reset_visit()


func reset_visit() -> void:
	for swimmer in swimmers:
		swimmer.hide()
		swimmer.queue_free()
	for pellet in food:
		pellet.hide()
		pellet.queue_free()
	swimmers.clear()
	food.clear()
	schools.clear()
	marks.clear()
	hand.reset()
	fish_population = 0
	elapsed = 0.0
	_water_tick = -1
	for i in range(4):
		var shoal := Shoal.new()
		shoal.center = random_point(0.05, 0.76)
		shoal.destination = random_point(0.08, 0.78)
		shoal.phase = rng.randf_range(0.0, TAU)
		schools.append(shoal)
	for profile in PROFILES:
		if not profile.bird:
			fish_population += profile.count
		for i in range(profile.count):
			var swimmer: PondSwimmer = SWIMMER.instantiate()
			var parent: Node2D = $Birds if profile.bird else $Fish
			parent.add_child(swimmer)
			var spot := random_point(0.46 if profile.bird else 0.03, 0.91)
			var facing := rng.randf_range(-PI, PI)
			if profile.gait == PondSpecies.Gait.SHOAL:
				swimmer.school = floori(i / 5.0)
				var group := schools[swimmer.school]
				swimmer.school_offset = Vector2.from_angle(TAU * (i % 5) / 5.0 + group.phase) * Vector2(13, 8)
				spot = group.center + swimmer.school_offset
				facing = group.center.angle_to_point(group.destination)
			swimmer.place(profile, spot, facing, rng.randf_range(0, TAU))
			swimmer.destination = roam_point(profile)
			swimmers.append(swimmer)


func random_point(inner: float, outer: float) -> Vector2:
	return CENTER + Vector2.from_angle(rng.randf_range(-PI, PI)) * RADII * sqrt(rng.randf_range(inner * inner, outer * outer))


func roam_point(profile: PondSpecies) -> Vector2:
	return random_point(0.66 if profile.gait == PondSpecies.Gait.DRIFT else 0.05, 0.91)


func _physics_process(delta: float) -> void:
	elapsed += delta
	for group in schools:
		group.pulse = pow(maxf(0.0, sin(elapsed * 1.9 + group.phase)), 4.0)
		group.center = group.center.move_toward(group.destination, delta * (4.5 + 7.0 * group.pulse))
		if group.center.distance_squared_to(group.destination) < 16.0:
			group.destination = random_point(0.1, 0.79)
	for pellet in food:
		pellet.advance(delta)
	for swimmer in swimmers:
		swimmer.advance(delta, self)
	for i in range(food.size() - 1, -1, -1):
		var pellet := food[i]
		if pellet.remaining <= 0 or pellet.water_age >= PondPellet.LIFETIME:
			pellet.hide()
			pellet.queue_free()
			food.remove_at(i)
	marks.advance(delta)
	var tick := floori(elapsed * 12.0)
	if tick != _water_tick:
		_water_tick = tick
		surface.set_shader_parameter(&"water_time", tick / 12.0)


func nearest_food(swimmer: PondSwimmer) -> PondPellet:
	var nearest: PondPellet
	var distance := swimmer.profile.vision * swimmer.profile.vision
	for pellet in food:
		if not pellet.available_to(swimmer.profile.bird):
			continue
		var at := pellet.target if pellet.airborne else pellet.position
		var candidate := swimmer.position.distance_squared_to(at)
		if candidate < distance:
			nearest = pellet
			distance = candidate
	return nearest


func personal_space(swimmer: PondSwimmer) -> Vector2:
	var steer := Vector2.ZERO
	for neighbor in swimmers:
		if neighbor == swimmer or neighbor.profile.bird != swimmer.profile.bird:
			continue
		var radius := 0.85 * (swimmer.profile.snout + neighbor.profile.snout)
		var offset := swimmer.position - neighbor.position
		var squared := offset.length_squared()
		if squared < radius * radius and squared > 0.001:
			var apart := sqrt(squared)
			steer += offset / apart * (1.0 - apart / radius)
	return steer.limit_length(1.0)


func take_bite(swimmer: PondSwimmer, pellet: PondPellet) -> void:
	var units := mini(swimmer.profile.bite_units, pellet.remaining)
	if units <= 0:
		return
	pellet.remaining -= units
	var bonus := 0
	var kind := WaterMarks.Kind.BIRD if swimmer.profile.bird else WaterMarks.Kind.FISH
	if pellet.lucky and not pellet.bonus_claimed and not swimmer.profile.bird:
		pellet.bonus_claimed = true
		kind = WaterMarks.Kind.LUCKY
		bonus = 50
	marks.add_mark(kind, pellet.position, 1.55 if bonus else 0.98)
	meal.emit(swimmer, units, bonus)


func _scatter(global_origin: Vector2, aim: Vector2, motion: StringName, lucky: bool) -> void:
	var start := to_local(global_origin)
	for i in range(4):
		var pellet := PondPellet.new()
		$Pellets.add_child(pellet)
		var jitter := Vector2(rng.randf_range(-7, 7), rng.randf_range(-5, 5))
		var landing := confine(aim + jitter, 0.995)
		pellet.launch(start, landing, motion, lucky and i == 0, rng.randf_range(0, TAU))
		pellet.landed.connect(_on_splash)
		food.append(pellet)
	thrown.emit()


func _on_splash(at: Vector2) -> void:
	marks.add_mark(WaterMarks.Kind.SPLASH, at, 0.85)
