extends SceneTree
## Native, renderer-free parity checks. Run from the repository root:
## godot --headless --path . --script godot/tests/test_simulation.gd

const Simulation = preload("res://godot/scripts/pond_simulation.gd")
const Energy = preload("res://godot/scripts/simulation_energy.gd")
const RandomStream = preload("res://godot/scripts/simulation_random.gd")

var checks := 0
var failures := 0


func _initialize() -> void:
	_test_roster_and_rng()
	_test_vending_and_pause()
	_test_throw_queue()
	_test_weighted_throws_and_streams()
	_test_flight_probability()
	_test_parabolic_flight()
	_test_feeding_and_lucky()
	_test_energy()
	_test_swimming_boosts()
	_test_collision_layers()
	_test_restock()
	print("Godot simulation: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)


func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error(message)


func close(actual: float, expected: float, message: String, tolerance: float = 0.00001) -> void:
	check(absf(actual - expected) <= tolerance, "%s: %.9f versus %.9f" % [message, actual, expected])


func advance(pond: RefCounted, seconds: float, interval: float = 1.0 / 60.0) -> void:
	var passed := 0.0
	while passed < seconds - 0.000000001:
		var delta := minf(interval, seconds - passed)
		pond.step(delta)
		passed += delta


func resident(pond: RefCounted, species: String, position: Vector2 = Vector2(500, 389)) -> Dictionary:
	for animal: Dictionary in pond.animals:
		if animal.profile.id == species:
			animal.pos = position
			animal.previous_pos = position
			animal.destination = position + Vector2(100, 0)
			animal.heading = 0.0
			animal.previous_heading = 0.0
			return animal
	push_error("Missing resident: " + species)
	return {}


func pellet(position: Vector2, throw_id: int = 10, amount: float = 1.0) -> Dictionary:
	return {"id": throw_id, "throw_id": throw_id, "pos": position, "previous_pos": position,
		"origin": position, "target": position, "launch_height": 0.0, "amount": amount, "age": 0.0,
		"phase": "water", "flight_time": 1.0, "flight_duration": 1.0, "height": 0.0,
		"release_at": 0.0, "arc_scale": 1.0, "lucky": false, "bonus_claimed": false}


func airborne(position: Vector2, throw_id: int = 10) -> Dictionary:
	var value := pellet(position, throw_id)
	value.phase = "air"
	value.origin = position + Vector2(-160, 200)
	value.flight_time = 0.0
	value.flight_duration = 3.0
	value.height = 100.0
	return value


func energy(charge: float = 1.0) -> Dictionary:
	return {"last_ate_at": null, "total_eaten": 0.0, "boost_charge": charge, "boosting": false}


func _test_roster_and_rng() -> void:
	var pond := Simulation.new(41)
	var counts := {"fish": 0, "bird": 0, "turtle": 0}
	for animal: Dictionary in pond.animals:
		counts[animal.profile.kind] += 1
		check(Simulation.in_pond(animal.pos), "Every animal spawns within the pond")
		check(animal.last_ate_at == null and animal.total_eaten == 0.0 and animal.boost_charge == 1.0, "Fresh visits reset history and reserves")
	check(counts == {"fish": 46, "bird": 15, "turtle": 1}, "Species counts retain the quiet turtle")
	check(pond.data.species.size() == 6, "Turtle stays outside the six-species guide")
	var random := RandomStream.new(41)
	for expected: float in [0.8510142471641302, 0.5088475255761296, 0.6344115899410099, 0.5411878905724734, 0.8519706330262125]:
		close(random.next(), expected, "Native seeded stream matches browser", 0.00000000001)


func _test_vending_and_pause() -> void:
	var pond := Simulation.new(41)
	check(pond.buy_pellets(), "Ready machine accepts one coin")
	check(not pond.buy_pellets(), "Machine prevents a second coin during a paid cycle")
	check(pond.machine.coins_used == 1 and pond.machine.stock == 25, "Stock remains until the dispenser opens")
	advance(pond, 1.34)
	check(pond.machine.stock == 25 and pond.handfuls == 0, "Turning does not prematurely dispense")
	advance(pond, 0.02)
	check(pond.machine.stock == 24 and pond.machine.phase == "dispensing", "One serving leaves the globe at dispensing")
	advance(pond, 1.58)
	check(pond.handfuls == 0, "Collection completes before crediting ten throws")
	advance(pond, 0.02)
	check(pond.machine.phase == "ready" and pond.handfuls == 10 and pond.machine.servings == 1, "Exactly ten throws per five-krone coin")
	var before: Array[Dictionary] = pond.animals.duplicate(true)
	var before_time: float = pond.elapsed
	pond.paused = true
	check(pond.buy_pellets(), "Purchases remain possible through the paused machine overlay")
	advance(pond, 3.0)
	check(pond.handfuls == 20 and pond.machine.coins_used == 2, "Paused purchase finishes exactly once")
	check(pond.elapsed == before_time and pond.animals == before, "Pause freezes movement, feeding, hunger and animation clocks")
	check(not pond.scatter(Vector2(600, 389)), "Paused pond rejects throws")
	var events: Array[Dictionary] = pond.consume_events()
	var coins := 0
	var dispensed := 0
	for event: Dictionary in events:
		coins += int(event.type == "coin")
		dispensed += int(event.type == "dispensed")
	check(coins == 2 and dispensed == 2 and pond.consume_events().is_empty(), "Events drain once without repeating")


func _test_throw_queue() -> void:
	var pond := Simulation.new(41)
	check(not pond.scatter(Vector2(600, 389)), "Empty hands cannot throw")
	pond.handfuls = 3
	pond.next_throw = {"animation": "toss", "lucky": false}
	check(not pond.scatter(Vector2.ZERO) and pond.handfuls == 3, "A throw outside the pond consumes nothing")
	check(pond.scatter(Vector2(350, 389)), "Left-hand toss queues")
	pond.next_throw = {"animation": "overhand", "lucky": true}
	check(pond.scatter(Vector2(850, 389)), "Opposite-hand overhand queues")
	pond.next_throw = {"animation": "spread", "lucky": false}
	check(pond.scatter(Vector2(600, 389)), "A center throw keeps the queued facing")
	check(pond.food.size() == 12 and pond.pending_throws() == 3 and pond.handfuls == 0, "Four pellets per queued handful")
	close(pond.food[4].release_at, 0.84 + 0.44, "Second throw waits for the complete first gesture")
	close(pond.food[8].release_at, 0.84 + 1.08 + 0.32, "Third throw preserves the full queue")
	check(pond.food[0].origin == pond.release_origin("toss", -1), "Left pellets originate at the calibrated releasing hand")
	check(pond.food[4].origin == pond.release_origin("overhand", 1), "Right pellets originate at the mirrored releasing hand")
	check(pond.food[8].origin == pond.release_origin("spread", 1), "Center aim inherits the previous queued facing")
	check(pond.food[4].lucky and not pond.food[5].lucky, "Only one pellet in a lucky handful receives the bonus")
	var starting: Vector2 = pond.food[4].pos
	advance(pond, 0.5)
	check(pond.food[4].pos == starting and pond.food[4].flight_time == 0.0, "Queued pellets remain in their hand until release")
	check(pond.throw_facing == -1, "Future throws do not turn the current thrower")
	advance(pond, 0.4)
	check(pond.throw_facing == 1 and pond.current_throw().animation == "overhand", "Facing changes when the queued gesture starts")
	var duration: float = pond.food[0].flight_duration
	check(duration > 0.6 and duration < 1.4, "Ordinary pellet timing retains the original duration")
	pond.animals.clear()
	advance(pond, 4.0)
	check(pond.pending_throws() == 0 and pond.food.all(func(value: Dictionary) -> bool: return value.phase == "water"), "All queued gestures release and land")
	var thrown := 0
	var splashed := 0
	for event: Dictionary in pond.consume_events():
		thrown += int(event.type == "throw")
		splashed += int(event.type == "splash")
	check(thrown == 3 and splashed == 12, "Every gesture and landing emits one event")
	advance(pond, 14.0)
	check(pond.food.is_empty(), "Uneaten pellets sink and expire")
	var nearby := Simulation.new(41)
	nearby.handfuls = 1
	nearby.next_throw = {"animation": "spread", "lucky": false}
	var near_hand := nearby.release_origin("spread", -1) + Vector2(0.5, 0.0)
	check(nearby.scatter(near_hand), "A near-hand aim inside the pond remains valid")
	for value: Dictionary in nearby.food:
		check(absf(value.target.y - near_hand.y) <= 25.5, "Sub-pixel spread aim retains the browser's reduced fan width")


func _test_weighted_throws_and_streams() -> void:
	var pond := Simulation.new(61)
	var counts := {"toss": 0, "overhand": 0, "spread": 0}
	var lucky := 0
	for index in range(10000):
		var plan: Dictionary = pond.plan_throw()
		counts[plan.animation] += 1
		lucky += int(plan.lucky)
	close(float(counts.toss) / 10000.0, 0.6, "Toss weight remains sixty percent", 0.02)
	close(float(counts.overhand) / 10000.0, 0.3, "Overhand weight remains thirty percent", 0.02)
	close(float(counts.spread) / 10000.0, 0.1, "Spread weight remains ten percent", 0.02)
	close(float(lucky) / 10000.0, 0.02, "Lucky chance remains two percent", 0.008)
	var first := Simulation.new(73)
	var second := Simulation.new(73)
	for index in range(50):
		first._behavior_roll()
		first.random_point()
		check(first.plan_throw() == second.plan_throw(), "Flight and movement rolls do not change lucky throws")


func _test_flight_probability() -> void:
	for roll: float in [0.0, 0.4999, 0.5, 0.99]:
		var pond := Simulation.new(41)
		var bird := resident(pond, "duck", Vector2(300, 389))
		pond.animals.assign([bird])
		var calls := [0]
		pond.behavior_random_override = func() -> float:
			calls[0] += 1
			return roll
		for index in range(4):
			pond.food.append(airborne(Vector2(500 + index, 389), 77))
		pond.step(0.05)
		check(not bird.flight.is_empty() if roll < 0.5 else bird.flight.is_empty(), "Takeoff uses the fifty-percent boundary")
		check(calls[0] == 1 and bird.flight_choices[77] == (roll < 0.5), "Sibling pellets share one per-bird flight decision")
		advance(pond, 0.2)
		check(calls[0] == 1, "Declined flights do not roll again on subsequent frames")
		pond.food.clear()
		pond.step(0.05)
		check(bird.flight_choices.is_empty(), "Expired throws release their cached flight choices")
	var frequency := Simulation.new(59)
	var flying := 0
	for index in range(10000):
		flying += int(frequency._behavior_roll() < 0.5)
	close(float(flying) / 10000.0, 0.5, "Seeded takeoff rolls are balanced", 0.02)
	for species: String in ["duck", "gull", "coot"]:
		var pond := Simulation.new(41)
		var bird := resident(pond, species, Vector2(300, 389))
		pond.animals.assign([bird])
		pond.behavior_random_override = func() -> float: return 0.0
		var minimum: float = bird.profile.flight.minDistance
		pond.food.assign([airborne(Vector2(300 + minimum + 10, 389))])
		pond.step(0.05)
		check(not bird.flight.is_empty(), "Each species respects its flight distance band: " + species)
	var late := Simulation.new(41)
	var duck := resident(late, "duck", Vector2(300, 389))
	late.animals.assign([duck])
	late.behavior_random_override = func() -> float: return 0.0
	var scrap := pellet(Vector2(500, 389))
	scrap.age = 1.5
	late.food.assign([scrap])
	late.step(0.05)
	check(duck.flight.is_empty() and duck.flight_choices.is_empty(), "A bird ignores a flight it cannot finish before sinking")


func _test_parabolic_flight() -> void:
	var pond := Simulation.new(41)
	var bird := resident(pond, "gull", Vector2(300, 389))
	pond.animals.assign([bird])
	pond.behavior_random_override = func() -> float: return 0.0
	pond.food.assign([airborne(Vector2(540, 389))])
	pond.step(0.05)
	check(not bird.flight.is_empty(), "Eligible gull starts a flight")
	var origin: Vector2 = bird.flight.origin
	var destination: Vector2 = bird.flight.destination
	var duration: float = bird.flight.duration
	pond.food.clear()
	for index in range(10):
		var progress: float = bird.flight.elapsed / duration
		check(bird.pos.distance_to(origin.lerp(destination, progress)) < 0.001, "Flight advances steadily across one continuous arc")
		close(bird.altitude, 4.0 * progress * (1.0 - progress) * float(bird.profile.flight.height), "Flight altitude follows a parabola", 0.001)
		pond.step(0.05)
	var freeze: Dictionary = bird.duplicate(true)
	var time: float = pond.elapsed
	pond.paused = true
	advance(pond, 1.0)
	check(bird == freeze and pond.elapsed == time, "Pause freezes flights and their visual interpolation state")
	pond.paused = false
	advance(pond, duration)
	check(bird.flight.is_empty() and bird.altitude == 0.0, "Flight lands even when its pellet disappears")
	var takeoffs := 0
	var landings := 0
	for event: Dictionary in pond.consume_events():
		if event.type == "bird_splash":
			takeoffs += int(event.phase == "takeoff")
			landings += int(event.phase == "landing")
	check(takeoffs == 1 and landings == 1, "Flight creates one takeoff and one landing splash")


func _test_feeding_and_lucky() -> void:
	for species: String in ["koi", "carp", "minnow", "duck", "gull", "coot", "musk-turtle"]:
		var pond := Simulation.new(42)
		var animal := resident(pond, species, Vector2(600, 389))
		pond.animals.assign([animal])
		var amount: float = animal.profile.bite * 0.5
		pond.food.assign([pellet(animal.pos, 1, amount)])
		pond.step(0.05)
		close(pond.eaten_food(), amount, "Food conservation for " + species)
		close(animal.total_eaten, amount, "Persistent total records the actual bite for " + species)
		close(animal.chew_left, float(animal.profile.chew) * 0.775, "Small meals retain bite/swallow time for " + species)
		check(animal.last_ate_at == pond.elapsed and animal.state == "chewing", "Each real bite updates the latest meal clock")
		if species == "musk-turtle":
			check(animal.surface_left >= 5.0, "Turtle peeks through its entire meal")
		advance(pond, 7.0)
		check(animal.meal_duration == 0.0 and animal.last_ate_at == 0.05 and animal.total_eaten == amount, "Feeding history survives the meal animation")
	var pond := Simulation.new(42)
	var bird := resident(pond, "coot", Vector2(600, 389))
	var fish := resident(pond, "minnow", Vector2(600, 389))
	var other_fish := resident(pond, "carp", Vector2(600, 389))
	var lucky := pellet(Vector2(600, 389))
	lucky.lucky = true
	pond.animals.assign([bird])
	pond.food.assign([lucky])
	pond.step(0.05)
	check(pond.lucky_bonus == 0 and not lucky.bonus_claimed, "Birds do not claim the lucky fish bonus")
	pond.animals.assign([fish])
	pond.step(0.05)
	check(pond.lucky_bonus == 50 and lucky.bonus_claimed, "The first fish bite claims fifty points")
	pond.animals.assign([other_fish])
	pond.step(0.05)
	check(pond.lucky_bonus == 50 and pond.fed_fish.size() == 2, "Remaining scraps cannot claim the same bonus twice")
	close(pond.eaten_food(), 1.0, "Shared lucky pellet conserves all food")
	close(pond.fish_share(), 0.55, "Fish share excludes the bird's portion")
	check(pond.score() == 56, "Score rounds eaten fish food and includes the lucky bonus")
	var ignored := Simulation.new(42)
	var submerged := resident(ignored, "koi", Vector2(600, 389))
	ignored.animals.assign([submerged])
	ignored.food.assign([airborne(Vector2(600, 389))])
	ignored.step(0.05)
	check(ignored.fish_food == 0.0 and submerged.state != "chewing", "Fish cannot eat airborne pellets")


func _test_energy() -> void:
	for frame: float in [1.0 / 30.0, 1.0 / 60.0, 1.0 / 144.0]:
		var animal := energy()
		var time := 0.0
		var traveled := 0.0
		while time < 2.0 - 0.000000001:
			var delta := minf(frame, 2.0 - time)
			time += delta
			traveled += Energy.step_boost(animal, time, delta, true) * delta
		close(traveled, 2.8, "Full boost gives forty percent for two seconds")
		close(animal.boost_charge, 0.0, "Full burst empties its reserve")
		check(not animal.boosting, "Depleted boosts stop")
	var hungry := energy(0.0)
	Energy.step_boost(hungry, 15.0, 15.0, false)
	close(hungry.boost_charge, 1.0, "Hungry reserve recharges in fifteen seconds")
	var fed := energy(0.0)
	for second in range(30):
		Energy.record_feeding(fed, 0.1, float(second))
		Energy.step_boost(fed, second + 1.0, 1.0, false)
		close(fed.boost_charge, float(second + 1) / 30.0, "Recently fed recharge uses the slower thirty-second rate")
	var boundary := energy(0.0)
	Energy.record_feeding(boundary, 0.3, 0.0)
	check(Energy.has_eaten_recently(boundary, 19.999) and not Energy.has_eaten_recently(boundary, 20.0), "Recent feeding expires exactly twenty seconds after the latest bite")
	Energy.step_boost(boundary, 20.05, 0.1, false)
	close(boundary.boost_charge, 0.05 / 30.0 + 0.05 / 15.0, "A frame crossing hunger expiry splits recharge correctly")
	boundary.boost_charge = 0.0
	Energy.step_boost(boundary, 20.0, 20.0, false)
	Energy.step_boost(boundary, 25.0, 5.0, false)
	close(boundary.boost_charge, 1.0, "Recharge accelerates after the recent-meal window expires")
	var interrupted := energy()
	Energy.step_boost(interrupted, 1.0, 1.0, true)
	Energy.step_boost(interrupted, 2.0, 1.0, false)
	close(interrupted.boost_charge, 0.5 + 1.0 / 15.0, "Interrupted chase retains its remaining reserve")
	close(Energy.step_boost(interrupted, 3.0, 1.0, true), 1.0, "A partial reserve refills before another burst")
	check(not interrupted.boosting, "Recharging reserves do not flutter on and off")


func _test_swimming_boosts() -> void:
	for species: String in ["carp", "duck", "musk-turtle"]:
		var pond := Simulation.new(42)
		var animal := resident(pond, species)
		pond.animals.assign([animal])
		pond.food.assign([pellet(Vector2(600, 389))])
		pond.step(0.05)
		var boosted := species != "musk-turtle"
		check(animal.boosting == boosted, "Boosts apply to fish and paddling birds, leaving the turtle's calm pace")
		close(animal.pos.distance_to(Vector2(500, 389)), float(animal.profile.speed) * 0.05 * (1.4 if boosted else 1.0), "Chase speed includes exactly the intended multiplier", 0.001)
		check(animal.previous_pos == Vector2(500, 389), "Interpolation retains the previous fixed-step position")
	var pond := Simulation.new(42)
	var bird := resident(pond, "duck", Vector2(600, 389))
	pond.animals.assign([bird])
	var value := airborne(Vector2(600, 389))
	value.origin = Vector2(600, 389)
	value.flight_time = 1.0
	value.flight_duration = 10.0
	pond.food.assign([value])
	pond.step(0.05)
	check(not bird.boosting, "Waiting below an airborne pellet conserves the reserve")
	pond.food.clear()
	pond.step(0.05)
	check(not bird.boosting and bird.state == "roaming", "Idle roaming does not consume boosts")


func _test_collision_layers() -> void:
	var pond := Simulation.new(42)
	var first := resident(pond, "koi", Vector2(600, 389))
	var second := resident(pond, "carp", Vector2(600, 389))
	var bird := resident(pond, "duck", Vector2(600, 389))
	var turtle := resident(pond, "musk-turtle", Vector2(600, 389))
	check(Simulation.share_collision_layer(first, second) and Simulation.share_collision_layer(first, turtle), "Fish and turtle share the submerged collision layer")
	check(not Simulation.share_collision_layer(first, bird), "Surface birds can pass over fish")
	pond.animals.assign([first, second])
	pond.separate_animals()
	check(first.pos.distance_to(second.pos) >= Simulation.collision_radius(first) + Simulation.collision_radius(second) - 0.01, "Coincident animals separate with stable deterministic normals")
	first.pos = Vector2(1097, 389)
	pond.animals.assign([first])
	pond.separate_animals()
	check(first.pos.x + Simulation.collision_radius(first) < 1098.0, "Collision bodies stay within the curved shoreline")
	bird.flight = {"origin": bird.pos, "destination": Vector2(700, 389), "elapsed": 0.0, "duration": 1.0}
	check(not Simulation.share_collision_layer(bird, turtle), "Flying birds ignore ground body separation")


func _test_restock() -> void:
	var pond := Simulation.new(42)
	pond.animals.clear()
	pond.machine.stock = 4
	advance(pond, 35.0, 0.1)
	check(pond.machine.stock == 25 and pond.machine.restocks == 1 and not pond.machine.restocking, "Employee completes a low-stock refill")
	check(pond.buy_pellets(), "A refilled machine accepts another serving")
