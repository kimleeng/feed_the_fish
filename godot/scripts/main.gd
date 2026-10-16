extends Control
## Native entry point. The fixed-step model is separate from render/UI clocks.

const Simulation = preload("res://godot/scripts/pond_simulation.gd")
const ArtLibrary = preload("res://godot/scripts/art_library.gd")
const Renderer = preload("res://godot/scripts/pond_renderer.gd")
const Interface = preload("res://godot/scripts/interface.gd")
const Audio = preload("res://godot/scripts/pond_audio.gd")

var world
var art
var pond_view
var ui
var sound
var _application_inactive := false
var _last_aim := Vector2(600, 389)

func _ready() -> void:
	world = Simulation.new(int(Time.get_unix_time_from_system()) ^ Time.get_ticks_msec())
	art = ArtLibrary.new()
	ui = Interface.new()
	ui.name = "Interface"
	add_child(ui)
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.setup(world, art)
	pond_view = Renderer.new()
	pond_view.name = "Pond"
	ui.pond_host.add_child(pond_view)
	pond_view.setup(world)
	pond_view.set_debug_enabled(ui.debug_enabled)
	sound = Audio.new()
	sound.name = "PondAudio"
	add_child(sound)
	sound.set_enabled(ui.sound_enabled)
	ui.purchase_requested.connect(_purchase)
	ui.restart_requested.connect(restart_visit)
	ui.sound_changed.connect(sound.set_enabled)
	ui.debug_changed.connect(pond_view.set_debug_enabled)
	ui.guide_visibility_changed.connect(_guide_visibility_changed)
	ui.scatter_requested.connect(func(): _throw_at(Vector2(600, 389)))
	ui.pond_host.gui_input.connect(_pond_input)
	ui.pond_host.resized.connect(_fit_pond)
	_fit_pond.call_deferred()
	ui.update_state(world, 0.0)
	# Godot's user:// directory is the only location used for player preferences.
	get_window().title = "Feed the fish · A little stillness"

func _physics_process(delta: float) -> void:
	if world == null:
		return
	world.step(delta)
	var events: Array = world.consume_events()
	if not events.is_empty():
		pond_view.handle_events(events)
		sound.handle_events(events)
		ui.handle_events(events)

func _process(delta: float) -> void:
	if world == null:
		return
	pond_view.render_alpha = 1.0 if world.paused else Engine.get_physics_interpolation_fraction()
	ui.update_state(world, delta)

func _fit_pond() -> void:
	if pond_view == null or not is_instance_valid(ui.pond_host):
		return
	var host_size: Vector2 = ui.pond_host.size
	var cover: float = maxf(host_size.x / 1200.0, host_size.y / 800.0)
	pond_view.scale = Vector2.ONE * cover
	pond_view.position = (host_size - Vector2(1200, 800) * cover) * 0.5

func _pond_input(event: InputEvent) -> void:
	if world == null or ui.is_modal_open():
		return
	# Controls keep Godot's normal touch-to-mouse emulation, while the water
	# handles the original touch only so one tap reserves exactly one throw.
	if event is InputEventMouseButton and event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	if event is InputEventMouseMotion:
		var aim := pond_view.to_local(ui.pond_host.get_global_mouse_position()) as Vector2
		if world.in_pond(aim):
			_last_aim = aim
	var pressed: bool = event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed
	pressed = pressed or (event is InputEventScreenTouch and event.pressed)
	if not pressed:
		return
	var point: Vector2 = pond_view.to_local(ui.pond_host.get_global_mouse_position())
	if event is InputEventScreenTouch:
		point = pond_view.get_global_transform().affine_inverse() * ui.pond_host.get_global_transform() * event.position
	if Rect2(372, 580, 76, 176).has_point(point):
		ui.open_machine()
	else:
		_last_aim = point
		_throw_at(point)
	ui.pond_host.accept_event()

func _throw_at(point: Vector2) -> void:
	if world.paused or ui.is_modal_open() or not world.in_pond(point):
		return
	if world.handfuls <= 0:
		ui.open_machine()
		return
	world.scatter(point)

func _purchase() -> void:
	world.buy_pellets()
	ui.update_state(world, 0.0)

func restart_visit() -> void:
	world = Simulation.new(int(Time.get_unix_time_from_system()) ^ Time.get_ticks_usec())
	world.paused = _application_inactive
	pond_view.reset_world(world)
	pond_view.set_debug_enabled(ui.debug_enabled)
	ui.bind_world(world)
	sound.reset_visit()
	sound.set_suspended(world.paused)

func _guide_visibility_changed(_open: bool) -> void:
	_sync_pause()

func _sync_pause() -> void:
	if world == null or ui == null:
		return
	world.paused = _application_inactive or ui.guide_open
	if sound != null:
		sound.set_suspended(world.paused)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_application_inactive = true
		_sync_pause()
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		_application_inactive = false
		_sync_pause()

func _unhandled_key_input(event: InputEvent) -> void:
	if world == null or not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode == KEY_SPACE and not ui.is_modal_open():
		var focus = get_viewport().gui_get_focus_owner()
		if focus != null and (focus is BaseButton or focus is LineEdit or focus is TextEdit or focus is Tree):
			return
		_throw_at(_last_aim)
		get_viewport().set_input_as_handled()
