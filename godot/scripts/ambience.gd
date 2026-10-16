class_name PondAmbience
extends RefCounted
## Independent, pause-aware weather, visitors and the machine attendant.

const SeededRandom = preload("res://godot/scripts/simulation_random.gd")
const Data = preload("res://godot/scripts/game_data.gd")
const PATH_START := -50.0
const PATH_END := 1250.0
const PATH_LANES := [760.0, 773.0, 784.0]
const WATCH_SPOTS := [Vector2(270, 738), Vector2(335, 735), Vector2(490, 740), Vector2(725, 738), Vector2(800, 735), Vector2(870, 738), Vector2(935, 744)]
const EMPLOYEE_ENTRANCE := Vector2(-85, 778)
const EMPLOYEE_SPEED := 52.0
const MAX_VISITORS := 8
const DEFAULT_HEIGHTS := {"adult": [158.0, 153.0, 149.0, 157.0, 164.0, 151.0], "kid": [109.0, 115.0, 96.0, 103.0, 115.0, 126.0]}
const DEFAULT_GAITS := {"adult": [0.838266, 0.854007, 0.769968, 0.902036, 0.938119, 0.90621], "kid": [0.773041, 0.895906, 0.758772, 0.852903, 0.909091, 0.852086]}

var elapsed := 0.0
var wind: Dictionary = {}
var wind_history: Array[Dictionary] = []
var people: Array[Dictionary] = []
var employee: Dictionary = {}
var _random: RefCounted
var _wind_phases: Array[float] = []
var _next_wind_sample := 1
var _next_person_id := 0
var _arrival_in := 0.0
var _last_throw_at := 0.0
var _scene_interest := 1.0
var _data: Dictionary = {}


func _init(seed_value: int = 0) -> void:
	_random = SeededRandom.new(seed_value ^ 0x46b9a7d3)
	var weather_random: RefCounted = SeededRandom.new(seed_value ^ 0x7a5b39d1)
	for index: int in range(5):
		_wind_phases.append(weather_random.next() * TAU)
	_data = Data.load_data()
	wind = sample_wind(0.0)
	wind_history.append(wind.duplicate())
	var employee_height: float = float(_data.get("employee_height", 153.0))
	employee = {"phase": "away", "pos": EMPLOYEE_ENTRANCE, "previous_pos": EMPLOYEE_ENTRANCE,
		"height": employee_height, "distance_walked": 0.0, "velocity": 0.0,
		"phase_time": 0.0, "lid_open": 0.0, "walking": false, "direction": 1, "cycles": 0.25}
	var count: int = 2 + int(_random.next() * 3.0)
	for index: int in range(count):
		var progress: float = (float(index) + 0.5) / count + (_random.next() - 0.5) * 0.1
		_arrive(progress, "adult" if index == 0 else "kid" if index == 1 else "")
	_arrival_in = _next_arrival()


func step(delta: float, machine: Dictionary) -> void:
	var dt: float = clampf(delta, 0.0, 0.1)
	if dt <= 0.0:
		return
	elapsed += dt
	wind = sample_wind(elapsed)
	while _next_wind_sample <= int(floor(elapsed + 0.000000001)):
		wind_history.append(sample_wind(float(_next_wind_sample)))
		_next_wind_sample += 1
	_step_people(dt)
	_step_employee(dt, machine)


func sample_wind(time: float) -> Dictionary:
	var at: float = maxf(0.0, time) if is_finite(time) else 0.0
	var bearing: float = _wind_phases[0] + sin(at * 0.031 + _wind_phases[1]) * 0.38 + sin(at * 0.079 + _wind_phases[2]) * 0.18
	var direction: float = fposmod(bearing, TAU)
	var strength: float = 0.14 + (0.5 + sin(at * 0.13 + _wind_phases[3]) * 0.5) * 0.29 + pow(0.5 + sin(at * 0.47 + _wind_phases[4]) * 0.5, 4.0) * 0.25
	return {"time": at, "direction": direction, "strength": strength,
		"x": cos(direction) * strength, "y": sin(direction) * strength}


func notice_throw() -> void:
	_last_throw_at = elapsed
	_notice_feeding(0.04)


func notice_eating(amount: float) -> void:
	_notice_feeding(maxf(0.0, amount) * 0.01)


func observer_frame(person: Dictionary) -> String:
	if person.phase == "watching":
		return "%s-watch" % person.design
	return "%s-step-%d" % [person.design, mini(7, int(floor(fposmod(float(person.cycles), 1.0) * 8.0 + 0.0000001)))]


func employee_frame() -> String:
	if employee.walking:
		return "employee-step-%d" % mini(7, int(floor(fposmod(float(employee.cycles), 1.0) * 8.0 + 0.0000001)))
	var phase: String = employee.phase
	var progress: float = float(employee.phase_time) / _phase_duration(phase)
	match phase:
		"opening":
			return "open-reach" if progress < 0.25 else "open" if progress < 0.75 else "open-return"
		"lifting":
			return "lift-half" if progress < 0.25 else "lift-ready" if progress < 0.5 else "lift-tip" if progress < 0.75 else "lift"
		"pouring":
			return "pour"
		"closing":
			return "close-lower" if progress < 0.3 else "close-reach" if progress < 0.5 else "close" if progress < 0.85 else "close-return"
	return "open-return"


func _between(low: float, high: float) -> float:
	return low + _random.next() * (high - low)


func _next_arrival() -> float:
	return 2.5 - log(maxf(0.000000001, 1.0 - _random.next())) * 13.0


func _path_y(x: float, lane: float) -> float:
	return lane - sin(clampf(x, 0.0, 1200.0) / 1200.0 * PI) * 7.0


func _path_blend(progress: float) -> float:
	var t: float = clampf(progress, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


func _walking_advance(velocity: float, speed: float, remaining: float, acceleration: float, dt: float) -> Dictionary:
	if remaining <= 0.0 or dt <= 0.0:
		return {"velocity": 0.0, "distance": 0.0}
	var target: float = minf(speed, sqrt(2.0 * acceleration * remaining))
	var next: float = move_toward(velocity, target, acceleration * dt)
	var distance: float = minf(remaining, (velocity + next) * 0.5 * dt)
	return {"velocity": 0.0 if distance >= remaining else next, "distance": distance}


func _stop_chance(person: Dictionary) -> float:
	return (0.9 if person.kind == "kid" else 0.7) + (float(person.interest) - 1.0) * 0.3


func _invite_to_watch(person: Dictionary) -> void:
	if person.phase != "walking" or person.has_watched or float(person.stop_roll) >= _stop_chance(person):
		return
	var available: Array[Vector2] = []
	for spot: Vector2 in WATCH_SPOTS:
		if (spot.x - person.pos.x) * int(person.direction) <= 50.0:
			continue
		var occupied := false
		for other: Dictionary in people:
			if other.get("stop") == spot:
				occupied = true
				break
		if not occupied:
			available.append(spot)
	if available.is_empty():
		return
	var child: bool = person.kind == "kid"
	var long_chance: float = (0.52 if child else 0.16) + (float(person.interest) - 1.0) * 0.3
	var long_visit: bool = _random.next() < long_chance
	person.stop = available[int(_random.next() * available.size())]
	person.phase = "approaching"
	person.watch_duration = _between(40.0, 90.0) if child and long_visit else _between(6.0, 15.0) if child else _between(25.0, 60.0) if long_visit else _between(4.0, 11.0)
	person.watch_remaining = person.watch_duration


func _notice_feeding(boost: float) -> void:
	_scene_interest = minf(1.15, _scene_interest + boost)
	for person: Dictionary in people:
		person.interest = minf(1.15, float(person.interest) + boost)
		_invite_to_watch(person)


func _arrive(progress: float = 0.0, given_kind: String = "") -> void:
	if people.size() >= MAX_VISITORS:
		return
	var kind: String = given_kind if not given_kind.is_empty() else "kid" if _random.next() < 0.35 else "adult"
	var direction: int = 1 if _random.next() < 0.5 else -1
	var x: float = lerpf(PATH_START, PATH_END, progress) if direction == 1 else lerpf(PATH_END, PATH_START, progress)
	var lane: float = PATH_LANES[int(_random.next() * PATH_LANES.size())]
	var available: Array[int] = []
	for look: int in range(6):
		var in_use := false
		for other: Dictionary in people:
			if other.kind == kind and int(other.look) == look:
				in_use = true
				break
		if not in_use:
			available.append(look)
	if available.is_empty():
		available.assign([0, 1, 2, 3, 4, 5])
	var chosen_look: int = available[int(_random.next() * available.size())]
	var position := Vector2(x, _path_y(x, lane))
	var person: Dictionary = {"id": _next_person_id, "design": "observer-%s-%d" % [kind, chosen_look],
		"kind": kind, "phase": "walking", "pos": position, "previous_pos": position, "lane": lane,
		"direction": direction, "stop": null, "speed": _between(37.0, 51.0) if kind == "kid" else _between(32.0, 46.0),
		"velocity": 0.0, "look": chosen_look, "scale": _between(0.92, 1.1), "cycles": _random.next(),
		"distance_walked": 0.0, "height": 0.0, "watch_duration": 0.0, "watch_remaining": 0.0,
		"watch_elapsed": 0.0, "interest": _scene_interest, "quiet_after": _between(5.0, 10.0),
		"stop_roll": _random.next(), "has_watched": false}
	_next_person_id += 1
	_invite_to_watch(person)
	if progress > 0.0 and person.stop != null and _random.next() < 0.45:
		person.pos = person.stop
		person.previous_pos = person.pos
		person.phase = "watching"
		person.has_watched = true
		person.watch_remaining *= _between(0.3, 1.0)
	if progress > 0.0 and person.phase != "watching":
		person.velocity = person.speed
	person.height = _person_height(person)
	people.append(person)


func _person_height(person: Dictionary) -> float:
	var base: float = DEFAULT_HEIGHTS[person.kind][person.look]
	var looks: Dictionary = _data.get("observer_looks", {})
	if looks.has(person.kind) and int(person.look) < looks[person.kind].size():
		base = float(looks[person.kind][person.look].get("height", base))
	return base * float(person.scale) * (1.0 + (person.pos.y - 760.0) * 0.0008)


func _person_cycle_distance(person: Dictionary) -> float:
	var fallback: float = DEFAULT_GAITS[person.kind][person.look]
	var gait: Dictionary = _data.get("walking_gait", {}).get(person.design, {})
	return float(gait.get("distance", fallback)) * float(person.height)


func _step_people(dt: float) -> void:
	var quiet_for: float = elapsed - _last_throw_at
	if quiet_for > 7.5:
		_scene_interest = maxf(0.8, _scene_interest - dt * 0.018)
	for person: Dictionary in people:
		person.previous_pos = person.pos
		if quiet_for > float(person.quiet_after):
			person.interest = maxf(0.8, float(person.interest) - dt * 0.018)
		if person.phase == "watching":
			person.velocity = 0.0
			person.watch_elapsed += dt
			person.watch_remaining = maxf(0.0, float(person.watch_remaining) - dt * (1.0 + (1.0 - float(person.interest)) * 0.6))
			if float(person.watch_remaining) <= 0.0:
				person.phase = "leaving"
				person.cycles = 0.25
			continue
		if person.phase == "approaching" and person.stop != null and absf(person.pos.x - person.stop.x) > 80.0 and float(person.stop_roll) >= _stop_chance(person):
			person.phase = "walking"
			person.stop = null
			person.watch_duration = 0.0
			person.watch_remaining = 0.0
		var remaining: float = absf(person.stop.x - person.pos.x) if person.phase == "approaching" and person.stop != null else INF
		var walk: Dictionary = _walking_advance(float(person.velocity), float(person.speed), remaining, 130.0 if person.kind == "kid" else 100.0, dt)
		person.velocity = walk.velocity
		var position: Vector2 = person.pos
		position.x += int(person.direction) * float(walk.distance)
		if person.phase == "approaching" and person.stop != null:
			if (person.stop.x - position.x) * int(person.direction) <= 0.0:
				position = person.stop
				person.phase = "watching"
				person.has_watched = true
				person.velocity = 0.0
			else:
				var approach: float = _path_blend(1.0 - absf(position.x - person.stop.x) / 80.0)
				position.y = lerpf(_path_y(position.x, float(person.lane)), person.stop.y, approach)
		elif person.phase == "leaving" and person.stop != null:
			var departure: float = _path_blend(absf(position.x - person.stop.x) / 80.0)
			position.y = lerpf(person.stop.y, _path_y(position.x, float(person.lane)), departure)
			if departure >= 1.0:
				person.phase = "walking"
				person.stop = null
		else:
			position.y = _path_y(position.x, float(person.lane))
		var travel: float = position.distance_to(person.pos)
		person.pos = position
		person.height = _person_height(person)
		person.distance_walked += travel
		person.cycles += travel / maxf(1.0, _person_cycle_distance(person))
	var remaining_people: Array[Dictionary] = []
	for person: Dictionary in people:
		if person.pos.x >= PATH_START and person.pos.x <= PATH_END:
			remaining_people.append(person)
	people = remaining_people
	_arrival_in -= dt
	if _arrival_in <= 0.0:
		var count: int = people.size()
		var chance: float = 0.0 if count >= MAX_VISITORS else 0.25 if count >= 6 else 0.6 if count >= 5 else 1.0
		if _random.next() < chance:
			_arrive()
		_arrival_in = _next_arrival()


func _phase_duration(phase: String) -> float:
	var defaults := {"opening": 0.9, "lifting": 0.8, "pouring": 3.0, "closing": 0.9}
	return float(_data.get("restock_timing", {}).get(phase, defaults.get(phase, 1.0)))


func _work_position() -> Vector2:
	var from_data: Dictionary = _data.get("employee_work_position", {})
	return Vector2(float(from_data.get("x", 346.25)), float(from_data.get("y", 722.8421052631579)))


func _enter_employee(phase: String) -> void:
	employee.phase = phase
	employee.phase_time = 0.0
	employee.velocity = 0.0
	employee.walking = phase == "arriving" or phase == "leaving"
	employee.direction = -1 if phase == "leaving" else 1
	if employee.walking:
		employee.distance_walked = 0.0
		employee.cycles = 0.25


func _step_employee(dt: float, machine: Dictionary) -> void:
	employee.previous_pos = employee.pos
	var capacity: int = int(_data.get("vending", {}).get("machine_capacity", 25))
	var restock_threshold: int = int(_data.get("vending", {}).get("restock_threshold", 5))
	if employee.phase == "away":
		# Match the browser: summon below five servings, refill up to twenty-five.
		if int(machine.get("stock", capacity)) >= restock_threshold or machine.get("restocking", false):
			return
		employee.pos = EMPLOYEE_ENTRANCE
		employee.previous_pos = EMPLOYEE_ENTRANCE
		_enter_employee("arriving")
	if employee.walking:
		var target: Vector2 = _work_position() if employee.phase == "arriving" else EMPLOYEE_ENTRANCE
		var remaining: float = employee.pos.distance_to(target)
		var walk: Dictionary = _walking_advance(float(employee.velocity), EMPLOYEE_SPEED, remaining, 100.0, dt)
		employee.velocity = walk.velocity
		employee.pos = employee.pos.move_toward(target, float(walk.distance))
		employee.distance_walked += float(walk.distance)
		var gait: Dictionary = _data.get("walking_gait", {}).get("employee", {})
		employee.cycles = 0.25 + float(employee.distance_walked) / (float(gait.get("distance", 0.773859)) * float(employee.height))
		if remaining <= float(walk.distance):
			_enter_employee("waiting" if employee.phase == "arriving" else "away")
		_update_lid()
		return
	if employee.phase == "waiting":
		if int(machine.get("stock", capacity)) >= capacity:
			_enter_employee("leaving")
		elif machine.get("phase", "ready") == "ready" and not machine.get("restocking", false):
			machine.restocking = true
			machine.refill_progress = 0.0
			_enter_employee("opening")
		_update_lid()
		return
	employee.phase_time += dt
	var phase: String = employee.phase
	if phase == "opening" and float(employee.phase_time) >= _phase_duration(phase):
		_enter_employee("lifting")
	elif phase == "lifting" and float(employee.phase_time) >= _phase_duration(phase):
		_enter_employee("pouring")
	elif phase == "pouring":
		machine.refill_progress = maxf(float(machine.get("refill_progress", 0.0)), clampf(float(employee.phase_time) / _phase_duration(phase), 0.0, 1.0))
		if float(employee.phase_time) >= _phase_duration(phase):
			_enter_employee("closing")
	elif phase == "closing" and float(employee.phase_time) >= _phase_duration(phase):
		if machine.get("restocking", false) and float(machine.get("refill_progress", 0.0)) >= 1.0:
			machine.stock = capacity
			machine.restocking = false
			machine.refill_progress = 0.0
			machine.restocks = int(machine.get("restocks", 0)) + 1
		_enter_employee("leaving")
	_update_lid()


func _update_lid() -> void:
	match employee.phase:
		"opening":
			employee.lid_open = minf(1.0, float(employee.phase_time) / _phase_duration("opening"))
		"lifting", "pouring":
			employee.lid_open = 1.0
		"closing":
			employee.lid_open = maxf(0.0, 1.0 - float(employee.phase_time) / _phase_duration("closing"))
		_:
			employee.lid_open = 0.0
