extends SceneTree

# Run with --headless --fixed-fps 60 --script res://tests/visit.gd.
# Drive the shipped scene and its AnimationPlayers with an isolated save file.
const SCENE := preload("res://garden.tscn")
var game: GardenVisit
var record := "user://visit-test-%s.cfg" % OS.get_process_id()
var failures: Array[String] = []
var launches: Array[StringName] = []
var origins: Array[Vector2] = []
var checks := 0


func _initialize() -> void:
	run.call_deferred()


func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		printerr("FAIL  ", description)


func ticks(count: int) -> void:
	for i in range(count):
		await physics_frame


func open_game() -> void:
	game = SCENE.instantiate()
	game.record_path = record
	game.get_node("PondWindow/Pond").rng.seed = 137
	game.get_node("PondWindow/Pond/Hand").rng.seed = 95
	root.add_child(game)
	game.pond.hand.released.connect(func(at: Vector2, _aim: Vector2, motion: StringName, _gold: bool):
		launches.append(motion)
		origins.append(game.pond.to_local(at))
	)


func click(control: Control, local := Vector2(-1, -1)) -> void:
	var point := control.get_global_transform_with_canvas() * (control.size * 0.5 if local.x < 0 else local)
	var move := InputEventMouseMotion.new()
	move.position = point
	move.global_position = point
	root.push_input(move, true)
	for down in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = point
		event.global_position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.button_mask = MOUSE_BUTTON_MASK_LEFT if down else 0
		event.pressed = down
		root.push_input(event, true)


func key(code: Key) -> void:
	for down in [true, false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = down
		root.push_input(event, true)


func run() -> void:
	open_game()
	await ticks(3)
	var pond := game.pond
	var hand := pond.hand
	check(game.page == GardenVisit.Page.MACHINE and hand.stock == 0, "first visit opens the counter")
	check(pond.swimmers.size() == 61 and pond.schools.size() == 4, "six species and four small shoals")
	for species in GardenPond.PROFILES:
		for facing in PondSwimmer.VIEWS:
			check(species.frames.get_frame_count(facing) == 8, "%s has a full %s stroke" % [species.display_name, facing])
		check(species.frames.get_frame_texture(&"plate", 0).get_width() == 104, "field guide uses its own native scale")
	var fish := pond.swimmers[0]
	fish.body.set_frame_and_progress(4, 0.36)
	fish.heading += PI
	fish.update_view()
	check(fish.body.frame == 4 and is_equal_approx(fish.body.frame_progress, 0.36), "turning preserves the stroke phase")
	click(game.counter.get_node("%Watch"))
	click(game.board, Vector2(5, 7))
	check(game.page == GardenVisit.Page.POND and game.spending == 0, "dry land never spends a coin")
	click(game.board, GardenPond.CENTER)
	check(game.page == GardenVisit.Page.MACHINE, "empty hand can refill from the water")
	click(game.counter.get_node("%Buy"))
	game.counter.insert_coin()
	key(KEY_ESCAPE)
	check(game.counter.busy and game.spending == 5 and hand.stock == 0, "one charge and no early credit during the crank cycle")
	await ticks(175)
	check(game.page == GardenVisit.Page.POND and hand.stock == 20, "collection grants one serving")
	hand.next_lucky = true
	click(game.board, GardenPond.CENTER)
	key(KEY_SPACE)
	key(KEY_SPACE)
	check(hand.stock == 17 and hand.waiting.size() == 2 and pond.food.is_empty(), "rapid mouse and keyboard orders reserve stock before release")
	check(hand.lucky_in_hand(), "reserved golden pellet appears in the palm")
	await ticks(6)
	key(KEY_P)
	var stopped := pond.elapsed
	var pose := hand.player.current_animation_position
	var frame := fish.body.frame
	var location := fish.position
	await ticks(25)
	check(pond.elapsed == stopped and fish.position == location and fish.body.frame == frame, "pause freezes simulation and stroke")
	check(hand.player.current_animation_position == pose and launches.is_empty(), "pause freezes the hand and queued releases")
	key(KEY_G)
	for i in range(6):
		check(game.guide.get_node("%Name").text == GardenPond.PROFILES[i].display_name, "guide identifies resident %d" % i)
		key(KEY_RIGHT)
	key(KEY_ESCAPE)
	check(game.page == GardenVisit.Page.PAUSE and paused, "closing the guide restores the earlier pause")
	key(KEY_P)
	await ticks(250)
	check(launches.size() == 3 and hand.waiting.is_empty() and not hand.active, "every reserved order reaches its animation marker exactly once")
	var release_point := hand.position
	check(origins.all(func(at): return at.is_equal_approx(release_point)), "every flight starts at the dock marker")
	click(game.board, Vector2(163, 270))
	check(game.page == GardenVisit.Page.MACHINE and hand.stock == 17, "the garden post opens the machine without throwing")
	game.counter.insert_coin()
	await ticks(175)
	check(hand.stock == 37 and game.spending == 10, "unused throws carry over on a second purchase")
	for i in range(24):
		var aim := Vector2(448, 157) if i % 2 else GardenPond.CENTER
		click(game.board, aim)
	await ticks(1450)
	check(launches.size() == 27 and hand.stock == 13, "sustained input preserves the full queue")
	check(launches.has(&"toss") and launches.has(&"sweep") and launches.has(&"lob"), "all three native motion clips release")
	check(pond.swimmers.all(func(resident): return GardenPond.in_water(resident.position)), "steering keeps all residents in the water")
	check(game.fish_units > 0 and game.bird_units > 0 and game.fish_units + game.bird_units <= 27 * 400, "both kinds feed and food is conserved")
	var previous_best := game.best
	click(game.board, GardenPond.CENTER)
	click(game.board, GardenPond.CENTER)
	key(KEY_P)
	click(game.get_node("%NewVisit"))
	check(game.page == GardenVisit.Page.MACHINE and not paused and game.best == previous_best, "new visit retains the best score")
	check(game.score() == 0 and game.fed.is_empty() and game.spending == 0 and hand.stock == 0, "new visit clears the journal and inventory")
	check(pond.food.is_empty() and hand.waiting.is_empty() and not hand.active, "new visit clears active and reserved throws")
	check_food_rules()
	key(KEY_S)
	await ticks(75)
	var saved := game.best
	game.queue_free()
	await process_frame
	await process_frame
	open_game()
	check(game.best == saved and game.sound.enabled, "a fresh game reloads best kindness and sound")
	if DisplayServer.get_name() != "headless":
		await check_window_input()
	game.queue_free()
	await process_frame
	await process_frame
	DirAccess.remove_absolute(ProjectSettings.globalize_path(record))
	print("%d native checks, %d failures" % [checks, failures.size()])
	quit(1 if failures else 0)


func check_food_rules() -> void:
	var pond := game.pond
	var start := Vector2(240, 284)
	var spot := Vector2(240, 155)
	var golden := PondPellet.new()
	pond.get_node("Pellets").add_child(golden)
	pond.food.append(golden)
	golden.launch(start, spot, &"toss", true, 0.0)
	var fry := pond.swimmers[26]
	var coot := pond.swimmers[-1]
	fry.position = spot
	coot.position = spot
	golden.advance(golden.duration * 0.5)
	check(pond.nearest_food(fry) == null and pond.nearest_food(coot) == golden, "only birds see an airborne landing")
	check(not golden.within_reach(spot, 7), "a swimming bird cannot take a high throw")
	golden.advance(golden.duration * 0.499)
	coot.target = golden
	coot.advance(0.001, pond)
	check(golden.airborne and golden.remaining == 55 and game.bird_units == 45 and game.score() == 0, "coot can intercept a low lucky pellet without claiming its bonus")
	golden.advance(golden.duration)
	fry.target = golden
	fry.advance(0.001, pond)
	check(not golden.airborne and golden.remaining == 25 and game.score() == 53, "first fish nibble grants exactly one +50 bonus")
	fry.advance(0.1, pond)
	check(golden.remaining == 25, "chewing blocks a second immediate bite")
	golden.advance(PondPellet.FLOAT_TIME + 0.02)
	check(pond.nearest_food(coot) == null and pond.nearest_food(fry) == golden, "sunken food remains only for fish")
	var second := pond.swimmers[27]
	second.position = golden.position
	second.target = golden
	second.advance(0.001, pond)
	check(game.score() == 56 and game.lucky_points == 50 and golden.remaining == 0, "the next fish shares the remainder without a second bonus")
	check(game.fish_units + game.bird_units == 100 and game.fed.size() == 2, "one shared pellet accounts for exactly one hundred units")


func check_window_input() -> void:
	# Integer stretch can keep the same viewport size through an OS resize.
	# Exercise physical window changes and hit-test the reflowed UI.
	var before := root.size
	root.size = Vector2i(390, 844)
	await ticks(8)
	check(root.content_scale_size.x == 480 and game.journal.position.x == 0, "narrow window moves the journal beneath the pond")
	check(root.content_scale_stretch == Window.CONTENT_SCALE_STRETCH_FRACTIONAL, "small screen fits every control")
	click(game.counter.get_node("%Watch"))
	check(game.page == GardenVisit.Page.POND, "portrait counter can be dismissed")
	click(game.journal.get_node("%Machine"))
	check(game.page == GardenVisit.Page.MACHINE, "portrait machine button accepts input at its displayed position")
	root.size = before
	await ticks(8)
	check(root.content_scale_size == Vector2i(640, 360) and game.journal.position.x == 480, "landscape restores the pond and side journal")
