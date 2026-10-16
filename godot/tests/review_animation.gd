extends SceneTree
## Enlarged, actual renderer poses for reviewing wing and feeding transitions.

const Simulation = preload("res://godot/scripts/pond_simulation.gd")
const Renderer = preload("res://godot/scripts/pond_renderer.gd")

func _initialize() -> void:
	_run.call_deferred()

func label_at(text: String, at: Vector2, parent: Node) -> void:
	var label := Label.new()
	label.text = text
	label.position = at
	label.add_theme_font_size_override("font_size", 17)
	label.add_theme_color_override("font_color", Color("304c3f"))
	parent.add_child(label)

func _run() -> void:
	root.size = Vector2i(1400, 850)
	var model := Simulation.new(42)
	var renderer := Renderer.new()
	root.add_child(renderer)
	renderer.setup(model)
	renderer.set_process(false)
	renderer.visible = false
	var gallery := Control.new()
	root.add_child(gallery)
	var background := ColorRect.new()
	background.color = Color("f6f3eb")
	background.size = Vector2(1400, 850)
	gallery.add_child(background)
	label_at("Native wing poses · eight phases from the actual flight renderer", Vector2(25, 15), gallery)
	for row in range(3):
		var species: String = ["duck", "gull", "coot"][row]
		var animal: Dictionary
		for candidate: Dictionary in model.animals:
			if candidate.profile.id == species:
				animal = candidate.duplicate(true)
				break
		animal.pos = Vector2.ZERO
		animal.previous_pos = Vector2.ZERO
		animal.heading = 0.0
		animal.previous_heading = 0.0
		animal.altitude = 0.0
		animal.previous_altitude = 0.0
		animal.moving = true
		animal.flight = {"elapsed": 1.0, "duration": 2.0}
		animal.profile.size = 110.0
		label_at(species, Vector2(25, 55 + row * 180), gallery)
		for column in range(8):
			animal.animation_phase = float(column) / 8.0
			renderer._update_animal(animal, 1.0, 1.0)
			var source = renderer._animals[animal.id].sprite
			for part in [source.mesh, source.flight_body]:
				var mesh: Polygon2D = part.duplicate()
				if part.material != null:
					mesh.material = part.material.duplicate()
				mesh.position = Vector2(100 + column * 170, 135 + row * 180)
				gallery.add_child(mesh)
			label_at("%.3f" % animal.animation_phase, Vector2(80 + column * 170, 204 + row * 180), gallery)
	label_at("Fish at first bite · body and raised lips in eight directions", Vector2(25, 610), gallery)
	var fish: Dictionary = model.animals[0].duplicate(true)
	fish.pos = Vector2.ZERO
	fish.previous_pos = Vector2.ZERO
	fish.profile.size = 120.0
	fish.state = "chewing"
	fish.meal_duration = 2.0
	for column in range(8):
		fish.heading = float(column) * PI / 4.0
		fish.previous_heading = fish.heading
		fish.chew_left = 1.8
		renderer._update_animal(fish, 1.0, 2.0)
		for part in ["body", "mouth"]:
			var source = renderer._animals[fish.id][part]
			var mesh: Polygon2D = source.mesh.duplicate()
			mesh.position = Vector2(100 + column * 170, 725)
			gallery.add_child(mesh)
	for frame in range(3):
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://godot/test-results/animation-poses.png")
	print("Saved native review: animation-poses")
	gallery.queue_free()
	await process_frame
	await directions(model, renderer)
	renderer.queue_free()
	await process_frame
	quit()

func directions(model, renderer) -> void:
	var gallery := Control.new()
	root.add_child(gallery)
	var background := ColorRect.new()
	background.color = Color("f6f3eb")
	background.size = Vector2(1400, 850)
	gallery.add_child(background)
	label_at("Native flight crossover · eight registered headings", Vector2(25, 15), gallery)
	for row in range(3):
		var species: String = ["duck", "gull", "coot"][row]
		var animal: Dictionary
		for candidate: Dictionary in model.animals:
			if candidate.profile.id == species:
				animal = candidate.duplicate(true)
				break
		animal.pos = Vector2.ZERO
		animal.previous_pos = Vector2.ZERO
		animal.altitude = 0.0
		animal.previous_altitude = 0.0
		animal.moving = true
		animal.flight = {"elapsed": 1.0, "duration": 2.0}
		animal.profile.size = 110.0
		animal.animation_phase = 0.25
		label_at(species, Vector2(25, 60 + row * 250), gallery)
		for column in range(8):
			animal.heading = float(column) * PI / 4.0
			animal.previous_heading = animal.heading
			renderer._update_animal(animal, 1.0, 1.0)
			var source = renderer._animals[animal.id].sprite
			for part in [source.mesh, source.flight_body]:
				var mesh: Polygon2D = part.duplicate()
				if part.material != null:
					mesh.material = part.material.duplicate()
				mesh.position = Vector2(100 + column * 170, 155 + row * 250)
				gallery.add_child(mesh)
			label_at(["E", "SE", "S", "SW", "W", "NW", "N", "NE"][column], Vector2(95 + column * 170, 240 + row * 250), gallery)
	for frame in range(3):
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://godot/test-results/flight-directions.png")
	print("Saved native review: flight-directions")
	gallery.queue_free()
	await process_frame
