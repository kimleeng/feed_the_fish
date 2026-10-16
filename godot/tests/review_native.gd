extends SceneTree
## Real-renderer review. Run without --headless; works with Xvfb/software GL.

var app
var output := "res://godot/test-results"
var prefs_existed := false
var original_prefs := ""

func _initialize() -> void:
	_run.call_deferred()

func frames(count: int = 4) -> void:
	for frame in range(count):
		await process_frame

func snapshot(title: String) -> void:
	await create_timer(0.36).timeout
	await frames()
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	image.save_png(output.path_join(title + ".png"))
	print("Saved native review: ", title)

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
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	root.size = Vector2i(1280, 1040)
	app = load("res://godot/scenes/main.tscn").instantiate()
	root.add_child(app)
	app.set_physics_process(false)
	await frames()
	app._application_inactive = false
	app.ui.sound_enabled = false
	app.sound.set_enabled(false)
	app.ui.assist_enabled = false
	app.ui.debug_enabled = false
	app.ui._apply_preferences()
	app.ui._layout()
	app.pond_view.set_debug_enabled(false)
	app._sync_pause()
	advance(5.0)
	await snapshot("desktop-pond")
	app.ui.open_machine()
	await snapshot("desktop-machine")
	app.ui._coin_button.pressed.emit()
	advance(1.6)
	await snapshot("desktop-dispensing")
	advance(1.5)
	app.ui.close_machine()
	app._throw_at(Vector2(870, 350))
	advance(0.9)
	await snapshot("desktop-flight")
	advance(4.0)
	await snapshot("desktop-feeding")
	app.ui.debug_enabled = true
	app.ui._apply_preferences()
	app.ui._layout()
	app.pond_view.set_debug_enabled(true)
	app.ui._update_debug()
	await frames()
	app.ui._scroll.scroll_vertical = int(app.ui._debug_panel.position.y) - 20
	await snapshot("desktop-debug")
	app.ui._scroll.scroll_vertical = 0
	app.ui.debug_enabled = false
	app.ui.assist_enabled = true
	app.ui._apply_preferences()
	app.ui._layout()
	app.pond_view.set_debug_enabled(false)
	await snapshot("desktop-assist")
	app.ui.open_guide()
	await snapshot("desktop-guide")
	app.ui.close_guide()
	app.ui.assist_enabled = false
	app.ui._apply_preferences()
	app.ui._layout()
	app.world.machine.stock = 4
	for tick in range(1500):
		app._physics_process(1.0 / 60.0)
		if app.world.ambience.employee.phase == "pouring":
			break
	advance(0.6)
	await snapshot("desktop-restocking")
	advance(18.0)
	var index := 0
	for animal: Dictionary in app.world.animals:
		if animal.profile.id in ["koi", "carp", "minnow"] and animal.id in [0, 12, 26]:
			animal.pos = Vector2(430 + index * 150, 370)
			animal.previous_pos = animal.pos
			animal.heading = -PI * 0.5
			animal.previous_heading = animal.heading
			animal.state = "chewing"
			animal.meal_duration = float(animal.profile.chew)
			animal.chew_left = animal.meal_duration - 0.25
			index += 1
	var turtle: Dictionary = app.world.animals.back()
	turtle.pos = Vector2(850, 390)
	turtle.previous_pos = turtle.pos
	turtle.surface_left = 4.5
	app.pond_view.render_alpha = 1.0
	app.pond_view.advance_draw()
	await snapshot("desktop-surface-feeding")
	root.size = Vector2i(390, 844)
	await frames()
	app.ui.assist_enabled = false
	app.ui._apply_preferences()
	app.ui._layout()
	await snapshot("phone-pond")
	app.ui.open_machine()
	await snapshot("phone-machine")
	app.ui.close_machine()
	app.ui.assist_enabled = true
	app.ui._apply_preferences()
	app.ui._layout()
	await snapshot("phone-assist")
	app.ui.open_guide()
	await snapshot("phone-guide")
	app.ui.close_guide()
	app.ui.assist_enabled = false
	app.ui.debug_enabled = true
	app.ui._apply_preferences()
	app.ui._layout()
	app.pond_view.set_debug_enabled(true)
	app.ui._update_debug()
	await frames()
	app.ui._scroll.scroll_vertical = int(app.ui._debug_panel.position.y) - 20
	await snapshot("phone-debug")
	app.queue_free()
	await frames()
	if prefs_existed:
		var file := FileAccess.open("user://preferences.cfg", FileAccess.WRITE)
		file.store_string(original_prefs)
		file.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path("user://preferences.cfg"))
	quit()
