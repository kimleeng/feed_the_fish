extends SceneTree
## Diagnostic only: measure the real scene without asserting hardware FPS.

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	root.size = Vector2i(1280, 960)
	var app = load("res://godot/scenes/main.tscn").instantiate()
	root.add_child(app)
	for frame in range(20):
		await process_frame
	app._application_inactive = false
	app._sync_pause()
	app.set_physics_process(false)
	app.set_process(false)
	app.pond_view.set_process(false)
	var process_total := 0.0
	var physics_total := 0.0
	var started := Time.get_ticks_usec()
	for frame in range(60):
		var physics_started := Time.get_ticks_usec()
		app._physics_process(1.0 / 60.0)
		physics_total += float(Time.get_ticks_usec() - physics_started) / 1000000.0
		var presentation_started := Time.get_ticks_usec()
		app.pond_view.render_alpha = 1.0
		app.pond_view.advance_draw()
		app.ui.update_state(app.world, 1.0 / 60.0)
		process_total += float(Time.get_ticks_usec() - presentation_started) / 1000000.0
		await process_frame
	var elapsed := float(Time.get_ticks_usec() - started) / 1000000.0
	print("Native performance: ", JSON.stringify({
		"renderer": RenderingServer.get_video_adapter_name(),
		"average_fps": 60.0 / elapsed,
		"presentation_script_ms": process_total / 60.0 * 1000.0,
		"physics_ms": physics_total / 60.0 * 1000.0,
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"texture_mb": Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0,
	}))
	app.queue_free()
	await process_frame
	quit()
