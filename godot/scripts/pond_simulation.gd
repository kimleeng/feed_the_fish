class_name PondSimulation
extends RefCounted
## Pure gameplay state. Rendering interpolates previous/current positions while
## this model runs at the game's fixed physics rate.

const GameData = preload("res://godot/scripts/game_data.gd")
const Energy = preload("res://godot/scripts/simulation_energy.gd")
const RandomStream = preload("res://godot/scripts/simulation_random.gd")
const Ambience = preload("res://godot/scripts/ambience.gd")

const POND_CENTER := Vector2(600.0, 389.0)
const POND_RADII := Vector2(498.0, 230.0)
const DOCK_POSITION := Vector2(600.0, 684.0)
const FLOAT_SECONDS := 1.7
const BIRD_TAKEOFF_SECONDS := 0.28
const BIRD_LANDING_SECONDS := 0.32
const BIRD_FLIGHT_CHANCE := 0.5
const TURTLE_SURFACE_SECONDS := 5.0
const LUCKY_CHANCE := 0.02
const LUCKY_BONUS_POINTS := 50
const THROWS_PER_COIN := 10
const MACHINE_CAPACITY := 25
const VENDING_CYCLE := [
	{"phase": "inserting", "seconds": 0.45},
	{"phase": "turning", "seconds": 0.9},
	{"phase": "dispensing", "seconds": 0.55},
	{"phase": "collecting", "seconds": 1.05},
]

var data: Dictionary
var animals: Array[Dictionary] = []
var food: Array[Dictionary] = []
var machine: Dictionary = {
	"phase": "ready", "coins_used": 0, "servings": 0, "stock": MACHINE_CAPACITY,
	"restocking": false, "restocks": 0, "refill_progress": 0.0, "stage": 0, "stage_time": 0.0,
}
var ambience: RefCounted
var elapsed := 0.0
var paused := false
var handfuls := 0
var fish_food := 0.0
var bird_food := 0.0
var turtle_food := 0.0
var lucky_bonus := 0
var fed_fish: Dictionary = {}
var next_throw: Dictionary = {}
var last_throw: Dictionary = {}
var throw_facing := -1

## Independent injectable streams make parity tests deterministic without
## changing ambient weather, animal placement, or lucky-throw probabilities.
var throw_random_override: Callable
var behavior_random_override: Callable

var _random: RefCounted
var _throw_random: RefCounted
var _behavior_random: RefCounted
var _motions: Dictionary
var _hand_pins: Dictionary
var _throw_queue: Array[Dictionary] = []
var _events: Array[Dictionary] = []
var _schools: Dictionary = {}
var _next_food := 0
var _next_throw_id := 0
var _last_observed_throw := -1


func _init(seed_value: int = 0) -> void:
	data = GameData.load_data()
	_motions = data.throw_motions
	_hand_pins = data.throw_hands
	_random = RandomStream.new(seed_value)
	_throw_random = RandomStream.new(seed_value ^ 0x1c69b3f7)
	_behavior_random = RandomStream.new(seed_value ^ 0x7f4a7c15)
	ambience = Ambience.new(seed_value)
	var profiles: Array = data.get("species", []).duplicate()
	var turtle: Dictionary = data.get("turtle", {})
	if not turtle.is_empty():
		profiles.append(turtle)
	for profile: Dictionary in profiles:
		var school_center: Vector2 = random_point(0.0, 0.7)
		for index in range(int(profile.count)):
			if index % 5 == 0:
				school_center = random_point(0.0, 0.7)
			var school := int(index / 5) if profile.movement == "shoal" else -1
			var position: Vector2
			if school >= 0:
				position = school_center + Vector2((_random.next() - 0.5) * 50.0, (_random.next() - 0.5) * 30.0)
			else:
				position = random_point(0.65 if profile.kind == "bird" else 0.0, 0.92)
			var destination := random_point()
			var heading: float = _random.next() * TAU
			var phase: float = _random.next() * TAU
			animals.append({
				"id": animals.size(), "profile": profile, "pos": position, "previous_pos": position,
				"destination": destination, "heading": heading, "previous_heading": heading,
				"chew_left": 0.0, "state": "roaming", "moving": false,
				"meal_duration": 0.0, "meal_amount": 0.0,
				"surface_left": 0.0, "surface_duration": TURTLE_SURFACE_SECONDS,
				"school": school, "phase": phase, "altitude": 0.0, "previous_altitude": 0.0,
				"flight": {}, "flight_choices": {}, "last_ate_at": null, "total_eaten": 0.0,
				"boost_charge": 1.0, "boosting": false, "animation_phase": phase / TAU,
			})
			if school >= 0 and not _schools.has(school):
				_schools[school] = random_point()
	separate_animals()
	for animal: Dictionary in animals:
		animal.previous_pos = animal.pos


static func in_pond(point: Vector2) -> bool:
	var relative := (point - POND_CENTER) / POND_RADII
	return relative.length_squared() < 1.0


func random_point(min_radius: float = 0.0, max_radius: float = 0.9) -> Vector2:
	var angle: float = _random.next() * TAU
	var radius := sqrt(min_radius * min_radius + _random.next() * (max_radius * max_radius - min_radius * min_radius))
	return POND_CENTER + Vector2(cos(angle), sin(angle)) * POND_RADII * radius


func _throw_roll() -> float:
	return float(throw_random_override.call()) if throw_random_override.is_valid() else _throw_random.next()


func _behavior_roll() -> float:
	return float(behavior_random_override.call()) if behavior_random_override.is_valid() else _behavior_random.next()


func plan_throw() -> Dictionary:
	var remaining := _throw_roll()
	var animation := "spread"
	for name: String in ["toss", "overhand", "spread"]:
		if remaining < float(_motions[name].weight):
			animation = name
			break
		remaining -= float(_motions[name].weight)
	return {"animation": animation, "lucky": _throw_roll() < LUCKY_CHANCE}


func release_origin(animation: String, facing: int = -1) -> Vector2:
	var hand: Dictionary = _hand_pins[animation + "-release"]["left" if facing == -1 else "right"]
	return Vector2(float(hand.x), float(hand.y))


func release_height(animation: String) -> float:
	return DOCK_POSITION.y - release_origin(animation).y


func buy_pellets() -> bool:
	if machine.phase != "ready" or machine.restocking or int(machine.stock) <= 0:
		return false
	machine.coins_used += 1
	machine.stage = 0
	machine.stage_time = 0.0
	machine.phase = "inserting"
	_events.append({"type": "coin"})
	return true


func _step_machine(seconds: float) -> void:
	if machine.phase == "ready" or seconds <= 0.0:
		return
	machine.stage_time += seconds
	while machine.stage_time + 0.000000001 >= float(VENDING_CYCLE[int(machine.stage)].seconds):
		machine.stage_time -= float(VENDING_CYCLE[int(machine.stage)].seconds)
		machine.stage += 1
		if int(machine.stage) >= VENDING_CYCLE.size():
			machine.phase = "ready"
			machine.stage_time = 0.0
			machine.servings += 1
			handfuls += THROWS_PER_COIN
			_events.append({"type": "dispensed", "amount": THROWS_PER_COIN})
			return
		machine.phase = VENDING_CYCLE[int(machine.stage)].phase
		if machine.phase == "dispensing":
			machine.stock -= 1


func scatter(point: Vector2) -> bool:
	if paused or machine.phase != "ready" or handfuls <= 0 or not in_pond(point):
		return false
	var plan: Dictionary = next_throw.duplicate() if not next_throw.is_empty() else plan_throw()
	var motion: Dictionary = _motions[plan.animation]
	var queued: Dictionary = _throw_queue.back() if not _throw_queue.is_empty() else {}
	var facing: int = int(queued.get("facing", throw_facing)) if is_equal_approx(point.x, DOCK_POSITION.x) else (-1 if point.x < DOCK_POSITION.x else 1)
	var origin := release_origin(plan.animation, facing)
	var started_at := elapsed
	if not queued.is_empty():
		started_at = maxf(elapsed, float(queued.started_at) + float(_motions[queued.animation].duration))
	var action := {"animation": plan.animation, "lucky": plan.lucky, "id": _next_throw_id, "started_at": started_at, "facing": facing}
	_next_throw_id += 1
	_throw_queue.append(action)
	if started_at <= elapsed:
		throw_facing = facing
	last_throw = action
	handfuls -= 1
	var forward := (point - origin) / maxf(1.0, origin.distance_to(point))
	for index in range(4):
		var side_jitter: float = _random.next() - 0.5
		var forward_jitter: float = _random.next() - 0.5
		var across := (float(index) - 1.5) * 32.0 + side_jitter * 6.0
		var along := forward_jitter * 18.0
		var offset: Vector2
		if plan.animation == "spread":
			offset = point + Vector2(-forward.y, forward.x) * across + forward * along
		else:
			offset = point + Vector2(side_jitter * 36.0, forward_jitter * 24.0)
		var target := offset if in_pond(offset) else point
		food.append({
			"id": _next_food, "throw_id": action.id, "pos": origin, "previous_pos": origin, "origin": origin, "target": target,
			"launch_height": release_height(plan.animation), "amount": 1.0, "age": 0.0, "phase": "air", "flight_time": 0.0,
			"flight_duration": (0.65 + origin.distance_to(target) / 700.0) * float(motion.flightScale),
			"height": release_height(plan.animation), "release_at": started_at + float(motion.releaseDelay),
			"arc_scale": motion.arcScale, "lucky": plan.lucky and index == 0, "bonus_claimed": false,
		})
		_next_food += 1
	next_throw = plan_throw() if handfuls > 0 else {}
	return true


func score() -> int:
	return roundi((fish_food + turtle_food) * 10.0) + lucky_bonus


func eaten_food() -> float:
	return fish_food + bird_food + turtle_food


func fish_share() -> float:
	return fish_food / eaten_food() if eaten_food() > 0.0 else 0.0


func current_throw() -> Dictionary:
	if _throw_queue.is_empty() or float(_throw_queue[0].started_at) > elapsed:
		return {}
	return _throw_queue[0]


func pending_throws() -> int:
	return _throw_queue.size()


func consume_events() -> Array[Dictionary]:
	var events := _events
	_events = []
	return events


func _update_schools() -> void:
	for school: int in _schools:
		var center := Vector2.ZERO
		var members := 0
		for animal: Dictionary in animals:
			if int(animal.school) == school and animal.state != "chewing":
				center += animal.pos
				members += 1
		if members > 0 and (center / members).distance_to(_schools[school]) < 45.0:
			_schools[school] = random_point(0.0, 0.8)


func _roam(animal: Dictionary) -> Dictionary:
	var pattern: String = animal.profile.movement
	var time := elapsed
	if pattern == "sweep":
		var angle: float = animal.phase + time * 0.12
		return {"destination": POND_CENTER + Vector2(cos(angle) * 380.0, sin(angle) * 160.0), "pace": 0.6, "bend": 0.0}
	if pattern == "shoal":
		var goal: Vector2 = _schools.get(int(animal.school), animal.destination)
		var center := Vector2.ZERO
		var neighbors := 0
		for other: Dictionary in animals:
			if int(other.school) == int(animal.school) and int(other.id) != int(animal.id) and other.pos.distance_to(animal.pos) < 100.0:
				center += other.pos
				neighbors += 1
		center = center / neighbors if neighbors > 0 else goal
		return {"destination": goal * 0.55 + center * 0.45 + Vector2(cos(animal.phase + time) * 18.0, sin(animal.phase + time) * 12.0),
			"pace": 0.25 + pow(maxf(0.0, sin(time * 2.1 + animal.school)), 6) * 0.65, "bend": 0.0}
	if animal.pos.distance_to(animal.destination) < 28.0 or not in_pond(animal.destination):
		animal.destination = random_point(0.72, 0.9) if pattern == "drift" else random_point()
	match pattern:
		"drift": return {"destination": animal.destination, "pace": 0.08 + maxf(0.0, sin(time * 0.8 + animal.phase)) * 0.28, "bend": sin(time * 0.6 + animal.phase) * 0.12}
		"paddle": return {"destination": animal.destination, "pace": 0.38, "bend": sin(time * 1.1 + animal.phase) * 0.3}
		"meander": return {"destination": animal.destination, "pace": 0.38, "bend": sin(time * 0.75 + animal.phase) * 0.5}
		"amble": return {"destination": animal.destination, "pace": 0.3, "bend": sin(time * 0.35 + animal.phase) * 0.16}
	return {"destination": animal.destination, "pace": 0.26, "bend": 0.0}


static func collision_radius(animal: Dictionary) -> float:
	var kind: String = animal.profile.kind
	return float(animal.profile.size) * (0.14 if kind == "fish" else 0.18 if kind == "turtle" else 0.2)


static func share_collision_layer(first: Dictionary, second: Dictionary) -> bool:
	if not first.flight.is_empty() or not second.flight.is_empty():
		return false
	return (first.profile.kind == "bird") == (second.profile.kind == "bird")


func _swimming_heading(animal: Dictionary, destination: Vector2, bend: float) -> float:
	var heading: float = animal.pos.angle_to_point(destination) + bend
	var forward := Vector2.from_angle(heading)
	var direction := forward
	for other: Dictionary in animals:
		if int(other.id) == int(animal.id) or not share_collision_layer(animal, other):
			continue
		var offset: Vector2 = other.pos - animal.pos
		var gap := offset.length()
		var room := (collision_radius(animal) + collision_radius(other)) * 1.8
		if gap >= room or gap < 0.0001:
			continue
		var toward := offset / gap
		var pressure := 1.0 - gap / room
		direction -= toward * pressure * 0.8
		if forward.dot(toward) > 0.35:
			direction += Vector2(-forward.y, forward.x) * pressure * 0.45
	return direction.angle()


func _keep_body_in_pond(animal: Dictionary) -> void:
	var radius := collision_radius(animal)
	var offset: Vector2 = animal.pos - POND_CENTER
	var squared := (offset / POND_RADII).length_squared()
	var slope := (offset / (POND_RADII * POND_RADII)).length()
	var rim := pow(radius / minf(POND_RADII.x, POND_RADII.y), 2.0)
	if squared > 0.0 and squared + 2.0 * radius * slope + rim >= 1.0:
		var scale := (sqrt(pow(radius * slope, 2.0) + squared * (1.0 - rim)) - radius * slope) / squared * 0.9999
		animal.pos = POND_CENTER + offset * scale


func separate_animals(iterations: int = 16) -> void:
	for animal: Dictionary in animals:
		if animal.flight.is_empty():
			_keep_body_in_pond(animal)
	for iteration in range(iterations):
		var separated := false
		for first_index in range(animals.size()):
			for second_index in range(first_index + 1, animals.size()):
				var first: Dictionary = animals[first_index]
				var second: Dictionary = animals[second_index]
				if not share_collision_layer(first, second):
					continue
				var first_radius := collision_radius(first)
				var second_radius := collision_radius(second)
				var offset: Vector2 = second.pos - first.pos
				var touching := first_radius + second_radius
				if offset.length_squared() >= touching * touching:
					continue
				var gap := offset.length()
				var overlap := touching - gap
				if overlap <= 0.01:
					continue
				separated = true
				var angle := (int(first.id) * 31 + int(second.id) * 17 + 1) * 2.399963229728653
				var normal := offset / gap if gap > 0.0001 else Vector2.from_angle(angle)
				var first_share := second_radius * second_radius / (first_radius * first_radius + second_radius * second_radius)
				first.pos -= normal * overlap * first_share
				second.pos += normal * overlap * (1.0 - first_share)
				_keep_body_in_pond(first)
				_keep_body_in_pond(second)
		if not separated:
			break


func _start_flight(animal: Dictionary, destination: Vector2) -> void:
	var profile: Dictionary = animal.profile.flight
	animal.flight = {"origin": animal.pos, "destination": destination, "elapsed": 0.0,
		"duration": BIRD_TAKEOFF_SECONDS + animal.pos.distance_to(destination) / float(profile.speed) + BIRD_LANDING_SECONDS}
	animal.heading = animal.pos.angle_to_point(destination)
	animal.state = "taking-off"
	_events.append({"type": "bird_splash", "position": animal.pos, "animal": animal.id, "phase": "takeoff"})


func _update_flight(animal: Dictionary, seconds: float) -> void:
	var flight: Dictionary = animal.flight
	flight.elapsed = minf(flight.duration, flight.elapsed + seconds)
	var progress: float = flight.elapsed / flight.duration
	animal.pos = flight.origin.lerp(flight.destination, progress)
	animal.altitude = 4.0 * progress * (1.0 - progress) * float(animal.profile.flight.height)
	animal.moving = true
	animal.state = "taking-off" if flight.elapsed < BIRD_TAKEOFF_SECONDS else "flying" if flight.elapsed < flight.duration - BIRD_LANDING_SECONDS else "landing"
	if flight.elapsed >= flight.duration:
		animal.flight = {}
		animal.altitude = 0.0
		animal.state = "approaching"
		animal.moving = false
		_events.append({"type": "bird_splash", "position": animal.pos, "animal": animal.id, "phase": "landing"})


static func flight_position(pellet: Dictionary) -> Dictionary:
	var progress := clampf(float(pellet.flight_time) / float(pellet.flight_duration), 0.0, 1.0)
	var arc: float = sin(PI * progress) * (85.0 + pellet.origin.distance_to(pellet.target) * 0.12) * float(pellet.arc_scale)
	return {"position": pellet.origin.lerp(pellet.target, progress) - Vector2(0.0, arc),
		"height": float(pellet.launch_height) * (1.0 - progress) + arc}


func _step_food(seconds: float) -> void:
	for pellet: Dictionary in food:
		if pellet.phase == "air":
			var flight_start := maxf(elapsed - seconds, pellet.release_at)
			var flight_delta := minf(elapsed - flight_start, pellet.flight_duration - pellet.flight_time)
			if flight_delta <= 0.0:
				continue
			var wind: Dictionary = ambience.sample_wind(flight_start + flight_delta * 0.5)
			var target: Vector2 = pellet.target + Vector2(float(wind.x) * 48.0, float(wind.y) * 32.0) * flight_delta
			var radius := ((target - POND_CENTER) / POND_RADII).length()
			if radius >= 1.0:
				target = POND_CENTER + (target - POND_CENTER) / radius * 0.9999
			pellet.target = target
			pellet.flight_time = minf(pellet.flight_duration, pellet.flight_time + flight_delta)
			var position := flight_position(pellet)
			pellet.pos = position.position
			pellet.height = position.height
			if pellet.flight_time >= pellet.flight_duration:
				pellet.phase = "water"
				pellet.pos = pellet.target
				pellet.height = 0.0
				pellet.age = 0.0
				if pellet.amount > 0.0:
					_events.append({"type": "splash", "position": pellet.pos, "food": pellet.id})
		else:
			pellet.age += seconds
			var drift: Vector2 = pellet.pos + Vector2(sin(float(pellet.id) + pellet.age) * seconds * 1.6, seconds * 0.8)
			if in_pond(drift):
				pellet.pos = drift


func _feed(animal: Dictionary, target: Dictionary, seconds: float) -> void:
	var profile: Dictionary = animal.profile
	var amount := minf(profile.bite, target.amount)
	target.amount = maxf(0.0, target.amount - amount)
	animal.chew_left = float(profile.chew) * (0.55 + 0.45 * clampf(amount / float(profile.bite), 0.0, 1.0))
	animal.meal_duration = animal.chew_left
	animal.meal_amount = amount
	animal.state = "chewing"
	Energy.step_boost(animal, elapsed, seconds, false)
	Energy.record_feeding(animal, amount, elapsed)
	var bonus := 0
	match str(profile.kind):
		"fish":
			fish_food += amount
			fed_fish[int(animal.id)] = true
		"turtle":
			turtle_food += amount
			animal.surface_duration = maxf(TURTLE_SURFACE_SECONDS, animal.chew_left + 0.75)
			animal.surface_left = animal.surface_duration
		"bird": bird_food += amount
	if profile.kind == "fish" and target.lucky and not target.bonus_claimed:
		target.bonus_claimed = true
		bonus = LUCKY_BONUS_POINTS
		lucky_bonus += bonus
		_events.append({"type": "lucky", "position": target.pos, "bonus": bonus, "animal": animal.id})
	_events.append({"type": "bite", "position": target.pos, "kind": profile.kind, "animal": animal.id, "amount": amount, "phase": target.phase, "bonus": bonus})
	ambience.notice_eating(amount)


func _step_animal(animal: Dictionary, seconds: float) -> void:
	animal.moving = false
	animal.surface_left = maxf(0.0, animal.surface_left - seconds)
	if not animal.flight.is_empty():
		Energy.step_boost(animal, elapsed, seconds, false)
		_update_flight(animal, seconds)
		return
	if animal.chew_left > 0.0:
		Energy.step_boost(animal, elapsed, seconds, false)
		animal.chew_left = maxf(0.0, animal.chew_left - seconds)
		if animal.chew_left < 0.000000001:
			animal.chew_left = 0.0
		animal.state = "chewing" if animal.chew_left > 0.0 else "roaming"
		if animal.chew_left == 0.0:
			animal.meal_duration = 0.0
			animal.meal_amount = 0.0
		return
	if animal.profile.kind == "turtle" and animal.surface_left > 0.0:
		Energy.step_boost(animal, elapsed, seconds, false)
		return
	var profile: Dictionary = animal.profile
	var target: Dictionary = {}
	var nearest := INF
	var fly_to_target := false
	for pellet: Dictionary in food:
		if pellet.amount <= 0.0 or pellet.age > 13.0 or elapsed < pellet.release_at:
			continue
		if profile.kind != "bird" and pellet.phase != "water":
			continue
		if profile.kind == "bird" and pellet.phase == "water" and pellet.age > FLOAT_SECONDS:
			continue
		var goal: Vector2 = pellet.target if pellet.phase == "air" else pellet.pos
		var gap: float = animal.pos.distance_to(goal)
		var flight: Dictionary = profile.get("flight", {}) if profile.kind == "bird" else {}
		if gap > float(flight.get("maxDistance", profile.vision)):
			continue
		var fly := false
		if not flight.is_empty() and gap >= float(flight.minDistance):
			var available: float = pellet.flight_duration - pellet.flight_time + FLOAT_SECONDS if pellet.phase == "air" else FLOAT_SECONDS - pellet.age
			var duration := BIRD_TAKEOFF_SECONDS + gap / float(flight.speed) + BIRD_LANDING_SECONDS
			if duration + seconds >= available or gap >= nearest:
				continue
			if not animal.flight_choices.has(int(pellet.throw_id)):
				animal.flight_choices[int(pellet.throw_id)] = _behavior_roll() < BIRD_FLIGHT_CHANCE
			fly = bool(animal.flight_choices[int(pellet.throw_id)])
			if not fly and gap > float(profile.vision):
				continue
		elif gap > float(profile.vision):
			continue
		if gap < nearest:
			target = pellet
			nearest = gap
			fly_to_target = fly
	var destination: Vector2
	var pace: float
	var bend := 0.0
	if not target.is_empty():
		animal.state = "approaching"
		destination = target.target if target.phase == "air" else target.pos
		pace = 1.0
		if fly_to_target:
			Energy.step_boost(animal, elapsed, seconds, false)
			_start_flight(animal, destination)
			_update_flight(animal, seconds)
			return
		var eat_radius := maxf(9.0, float(profile.size) * 0.2)
		var reachable: bool = target.phase == "water" or (target.height <= 22.0 and animal.pos.distance_to(target.pos) < eat_radius)
		if reachable and nearest < eat_radius:
			_feed(animal, target, seconds)
			return
	else:
		animal.state = "roaming"
		var motion := _roam(animal)
		destination = motion.destination
		pace = motion.pace
		bend = motion.bend
	var desired := _swimming_heading(animal, destination, bend)
	var turn := float(profile.turnRate) * (1.8 if not target.is_empty() else 1.0) * seconds
	animal.heading += clampf(angle_difference(animal.heading, desired), -turn, turn)
	var gap: float = animal.pos.distance_to(destination)
	var boost: float = Energy.step_boost(animal, elapsed, seconds, not target.is_empty() and profile.kind != "turtle" and gap >= maxf(9.0, float(profile.size) * 0.2))
	var travel := minf(gap, float(profile.speed) * pace * boost * seconds)
	var next: Vector2 = animal.pos + Vector2.from_angle(animal.heading) * travel
	if in_pond(next):
		animal.pos = next
		animal.moving = travel > 0.001
	else:
		animal.heading = animal.pos.angle_to_point(POND_CENTER)
		animal.destination = random_point(0.0, 0.7)


func _advance_animation(animal: Dictionary, seconds: float) -> void:
	var rate: float = 1.4 if animal.profile.kind == "bird" else float(animal.profile.speed) / 24.0
	if not animal.flight.is_empty():
		var progress: float = animal.flight.elapsed / animal.flight.duration
		rate = float(animal.profile.flight.flapRate) * (1.0 + 0.5 * (1.0 - smoothstep(0.0, 0.28, progress)))
	elif animal.boosting:
		rate *= Energy.BOOST_SPEED_MULTIPLIER
	elif not animal.moving:
		rate *= 0.4
	animal.animation_phase += seconds * rate


func step(delta: float) -> void:
	var seconds := clampf(delta, 0.0, 0.1)
	# A paid vending animation finishes even while the pond is paused, matching
	# the original interface's purchase overlay. Animal/world clocks stay frozen.
	_step_machine(seconds)
	if handfuls > 0 and next_throw.is_empty():
		next_throw = plan_throw()
	if paused or seconds <= 0.0:
		return
	for animal: Dictionary in animals:
		animal.previous_pos = animal.pos
		animal.previous_heading = animal.heading
		animal.previous_altitude = animal.altitude
	for pellet: Dictionary in food:
		pellet.previous_pos = pellet.pos
	elapsed += seconds
	ambience.step(seconds, machine)
	while not _throw_queue.is_empty() and elapsed >= float(_throw_queue[0].started_at) + float(_motions[_throw_queue[0].animation].duration):
		_throw_queue.pop_front()
	var released := current_throw()
	if not released.is_empty():
		throw_facing = released.facing
		if int(released.id) != _last_observed_throw and elapsed >= float(released.started_at) + float(_motions[released.animation].releaseDelay):
			_last_observed_throw = released.id
			_events.append({"type": "throw", "position": release_origin(released.animation, released.facing), "lucky": released.lucky, "animation": released.animation})
			ambience.notice_throw()
	_step_food(seconds)
	_update_schools()
	var active_throws: Dictionary = {}
	for pellet: Dictionary in food:
		if pellet.amount > 0.001 and (pellet.phase == "air" or pellet.age <= FLOAT_SECONDS):
			active_throws[int(pellet.throw_id)] = true
	for animal: Dictionary in animals:
		for throw_id: int in animal.flight_choices.keys():
			if not active_throws.has(throw_id):
				animal.flight_choices.erase(throw_id)
		_step_animal(animal, seconds)
		_advance_animation(animal, seconds)
	separate_animals()
	var remaining_food: Array[Dictionary] = []
	for pellet: Dictionary in food:
		if pellet.amount > 0.001 and (pellet.phase == "air" or pellet.age < 13.0):
			remaining_food.append(pellet)
	food = remaining_food
