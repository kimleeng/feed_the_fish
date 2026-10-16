extends SceneTree
## Exercises the real scene, signals, native layout and presentation together.

var checks := 0
var failures := 0
var app
var prefs_existed := false
var original_prefs := ""

func _initialize() -> void:
	_run.call_deferred()

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error(message)

func settle() -> void:
	for frame in range(4):
		await process_frame

func click(button: Control) -> void:
	var point := button.get_global_rect().get_center()
	var motion := InputEventMouseMotion.new()
	motion.position = point
	Input.parse_input_event(motion)
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		Input.parse_input_event(event)
		await process_frame

func advance(seconds: float) -> void:
	for tick in range(ceili(seconds * 60.0)):
		app._physics_process(1.0 / 60.0)
	app.ui.update_state(app.world, 0.0)
	app.pond_view.render_alpha = 1.0
	app.pond_view.advance_draw()

func _run() -> void:
	prefs_existed = FileAccess.file_exists("user://preferences.cfg")
	if prefs_existed:
		original_prefs = FileAccess.get_file_as_string("user://preferences.cfg")
	root.size = Vector2i(1280, 1040)
	app = load("res://godot/scenes/main.tscn").instantiate()
	root.add_child(app)
	app.set_physics_process(false)
	await settle()
	app._application_inactive = false
	app.ui.close_guide()
	app.ui.close_machine()
	app._sync_pause()
	check(app.world.animals.size() == 62, "Full population reaches the scene")
	check(app.pond_view._animals.size() == 62, "Every animal has native presentation")
	check(app.ui.pond_host.size.x > 1000.0, "Desktop pond fills its card")
	check(app.pond_view._thrower.mesh.texture != null, "Thrower artwork imports")
	check(app.pond_view._machine.mesh.texture != null, "Machine artwork imports")
	check(app.pond_view._thrower.mesh.polygon.size() == 48, "Articulated mesh is present")

	app._throw_at(Vector2(600, 389))
	check(app.ui.machine_open, "Empty-hand water action opens vending")
	await settle()
	await click(app.ui._coin_button)
	check(app.world.machine.phase == "inserting", "Native coin button starts purchase")
	app.ui._coin_button.pressed.emit()
	check(app.world.machine.coins_used == 1, "Repeated input never charges a second coin")
	advance(3.0)
	check(app.world.handfuls == 10, "Paid cycle grants ten throws")
	check(app.world.machine.stock == 24, "Paid cycle consumes one stock serving")
	app.ui.close_machine()
	await settle()
	app.ui._scatter_button.pressed.emit()
	advance(0.7)
	check(app.world.handfuls == 9, "Native throw action spends one handful")
	check(not app.world.food.is_empty(), "Throw releases actual pellets")
	advance(8.0)
	check(app.world.eaten_food() > 0.0, "Native scene feeds animals")
	var before_touch: int = app.world.handfuls
	var touch := InputEventScreenTouch.new()
	touch.pressed = true
	touch.position = app.ui.pond_host.get_global_transform().affine_inverse() * app.pond_view.get_global_transform() * Vector2(600, 389)
	app._pond_input(touch)
	check(app.world.handfuls == before_touch - 1, "Touch coordinates reach the intended pond point")
	var emulated_mouse := InputEventMouseButton.new()
	emulated_mouse.button_index = MOUSE_BUTTON_LEFT
	emulated_mouse.pressed = true
	emulated_mouse.device = InputEvent.DEVICE_ID_EMULATION
	app._pond_input(emulated_mouse)
	check(app.world.handfuls == before_touch - 1 and not app.ui.machine_open, "Emulated mouse never duplicates a touch throw")

	app.ui.open_guide()
	check(app.world.paused, "Field guide pauses world through signal")
	var paused_at: float = app.world.elapsed
	advance(2.0)
	check(is_equal_approx(app.world.elapsed, paused_at), "Guide freezes the pond clock")
	var handfuls_before: int = app.world.handfuls
	app._throw_at(Vector2(500, 350))
	check(app.world.handfuls == handfuls_before, "Guide intercepts gameplay input")
	app.ui.close_guide()
	check(not app.world.paused, "Closing guide resumes the pond")
	app._application_inactive = true
	app._sync_pause()
	check(app.world.paused, "Background focus suspends pond")
	app._application_inactive = false
	app._sync_pause()

	app.ui.debug_enabled = false
	app.ui._toggle_debug()
	check(app.pond_view.debug_enabled, "Debug signal enables animal meters")
	check(app.ui._debug_panel.visible, "Debug reveals native metrics panel")
	app.ui._update_debug()
	check(app.ui._debug_rows.size() == 62, "Debug includes each animal")
	var turtle: Dictionary = app.world.animals.back()
	check(app.pond_view._animals[turtle.id].sprite.visible, "Debug reveals submerged turtle")
	app.ui._toggle_debug()
	check(not app.pond_view._boosts.visible, "Normal play hides boost meters")
	check(not app.pond_view._animals[turtle.id].sprite.visible, "Normal play hides resting turtle")

	for viewport_size: Vector2i in [Vector2i(360, 640), Vector2i(390, 844), Vector2i(768, 1040), Vector2i(1280, 720), Vector2i(1280, 1040)]:
		var width := viewport_size.x
		root.size = viewport_size
		await settle()
		check(is_equal_approx(app.ui.size.x, float(width)), "Native UI uses window width %d" % width)
		for button in [app.ui._machine_button, app.ui._scatter_button, app.ui._debug_button, app.ui._restart_button]:
			var rect: Rect2 = button.get_global_rect()
			check(rect.position.x >= 0.0 and rect.end.x <= width + 1.0, "Action fits at width %d: %s" % [width, button.name])
		app.ui.open_machine()
		await settle()
		check(root.get_visible_rect().encloses(app.ui._machine_card.get_global_rect()), "Machine modal fits at width %d" % width)
		app.ui.close_machine()
		app.ui.open_guide()
		await settle()
		check(root.get_visible_rect().encloses(app.ui._guide_card.get_global_rect()), "Guide modal fits at width %d" % width)
		app.ui.close_guide()

	var best_before: int = app.ui.best_score
	app.ui._restart_button.pressed.emit()
	check(app.world.handfuls == 0 and app.world.score() == 0, "New visit resets gameplay")
	check(app.world.machine.stock == 25, "New visit refills machine")
	check(app.ui.best_score == best_before, "New visit preserves best score")
	check(app.pond_view.world == app.world, "New visit rebinds renderer")
	app.queue_free()
	await settle()
	if prefs_existed:
		var file := FileAccess.open("user://preferences.cfg", FileAccess.WRITE)
		file.store_string(original_prefs)
		file.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path("user://preferences.cfg"))
	print("Native integration: %d checks, %d failures" % [checks, failures])
	quit(1 if failures else 0)
