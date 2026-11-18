class_name GardenVisit
extends Control

enum Page { POND, MACHINE, GUIDE, PAUSE }

const PRICE := 5
const SERVING := 20

@onready var board: Control = $PondWindow
@onready var pond: GardenPond = $PondWindow/Pond
@onready var journal: VisitJournal = $Journal
@onready var counter: PelletCounter = $Modal/Counter
@onready var guide: PondGuide = $Modal/Guide
@onready var sound: GardenSound = $Sound
@onready var save_timer: Timer = $SaveTimer

var record_path := "user://garden.cfg"
var page := Page.MACHINE
var guide_return := Page.POND
var aim := GardenPond.CENTER
var spending := 0
var fish_units := 0
var bird_units := 0
var lucky_points := 0
var fed: Dictionary[int, bool] = {}
var best := 0
var _dirty := false
var _loaded := false
var _hint_left := 0.0
var _last_window_size := Vector2i.ZERO


func _ready() -> void:
	_load_record()
	board.gui_input.connect(_pond_input)
	board.mouse_exited.connect(func(): pond.get_node("Aim").hide())
	pond.meal.connect(_on_meal)
	pond.machine_requested.connect(_show_page.bind(Page.MACHINE))
	pond.thrown.connect(sound.cue.bind(&"toss"))
	pond.hand.palm_changed.connect(_show_hint)
	%GuideButton.pressed.connect(_open_guide)
	%SoundButton.pressed.connect(_toggle_sound)
	%PauseButton.pressed.connect(_show_page.bind(Page.PAUSE))
	journal.get_node("%Throw").pressed.connect(_throw_from_button)
	journal.get_node("%Machine").pressed.connect(_show_page.bind(Page.MACHINE))
	counter.coin_inserted.connect(_on_coin)
	counter.crank_turned.connect(sound.cue.bind(&"crank"))
	counter.serving_collected.connect(_on_serving)
	counter.dismissed.connect(_show_page.bind(Page.POND))
	guide.dismissed.connect(_close_guide)
	%Resume.pressed.connect(_show_page.bind(Page.POND))
	%PauseGuide.pressed.connect(_open_guide)
	%NewVisit.pressed.connect(_new_visit)
	save_timer.timeout.connect(_save_record)
	get_window().focus_exited.connect(_focus_lost)
	_layout()
	_update_journal()
	_show_page(Page.MACHINE)
	_loaded = true


func _layout() -> void:
	var window := get_window()
	var physical := window.size
	_last_window_size = physical
	var portrait := physical.x < physical.y
	var native := Vector2i(640, 360)
	if portrait:
		var width_scale := physical.x / 480.0
		var scale_factor := floorf(width_scale) if width_scale >= 1.0 else width_scale
		native = Vector2i(480, clampi(floori(physical.y / maxf(scale_factor, 0.01)), 528, 1280))
	if window.content_scale_size != native:
		window.content_scale_size = native
	var small := physical.x < native.x or physical.y < native.y
	window.content_scale_stretch = Window.CONTENT_SCALE_STRETCH_FRACTIONAL if small else Window.CONTENT_SCALE_STRETCH_INTEGER
	journal.layout(portrait, native.y)


func _show_page(next: Page) -> void:
	if page == Page.MACHINE and counter.busy:
		return
	page = next
	$Modal.visible = page != Page.POND
	counter.visible = page == Page.MACHINE
	$Modal/PauseCard.visible = page == Page.PAUSE
	if page != Page.GUIDE:
		guide.close()
	get_tree().paused = page == Page.PAUSE or page == Page.GUIDE
	var focus_rule := Control.FOCUS_BEHAVIOR_INHERITED if page == Page.POND else Control.FOCUS_BEHAVIOR_DISABLED
	$Header.focus_behavior_recursive = focus_rule
	journal.focus_behavior_recursive = focus_rule
	board.focus_behavior_recursive = focus_rule
	pond.get_node("Aim").hide()
	match page:
		Page.POND:
			board.grab_focus()
		Page.MACHINE:
			counter.open(spending, PRICE, SERVING)
		Page.GUIDE:
			guide.open()
		Page.PAUSE:
			%VisitTotal.text = "%d kindness   •   %d fish fed   •   %d kr spent" % [score(), fed.size(), spending]
			%Resume.grab_focus()
	_show_hint()


func _open_guide() -> void:
	if page == Page.POND or page == Page.PAUSE:
		guide_return = page
		_show_page(Page.GUIDE)


func _close_guide() -> void:
	_show_page(guide_return)


func _new_visit() -> void:
	fish_units = 0
	bird_units = 0
	lucky_points = 0
	spending = 0
	fed.clear()
	aim = GardenPond.CENTER
	_hint_left = 0.0
	pond.reset_visit()
	_update_journal()
	_show_page(Page.MACHINE)


func _pond_input(event: InputEvent) -> void:
	if page != Page.POND:
		return
	if event is InputEventMouseMotion:
		if GardenPond.in_water(event.position):
			_set_aim(event.position)
		else:
			pond.get_node("Aim").hide()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		board.grab_focus()
		if GardenPond.in_water(event.position):
			_set_aim(event.position)
			_throw_at(aim)
		else:
			_hint_left = 2.0
			journal.get_node("%Hint").text = "Aim for the open water."
		board.accept_event()


func _set_aim(point: Vector2) -> void:
	aim = point
	var reticle: Node2D = pond.get_node("Aim")
	reticle.position = aim.round()
	reticle.show()


func _throw_from_button() -> void:
	if page == Page.POND:
		_throw_at(aim)
		if page == Page.POND:
			board.grab_focus()


func _throw_at(point: Vector2) -> void:
	if page != Page.POND or not GardenPond.in_water(point):
		return
	if pond.hand.stock == 0:
		_show_page(Page.MACHINE)
	elif pond.hand.reserve(point):
		_hint_left = 0.0
		_update_journal()


func _input(event: InputEvent) -> void:
	if not _loaded or not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.is_action_pressed(&"ui_cancel"):
		match page:
			Page.MACHINE: counter.close()
			Page.GUIDE: _close_guide()
			Page.PAUSE: _show_page(Page.POND)
			Page.POND: _show_page(Page.PAUSE)
	elif event.is_action_pressed(&"visit_pause") and page in [Page.POND, Page.PAUSE]:
		_show_page(Page.PAUSE if page == Page.POND else Page.POND)
	elif event.is_action_pressed(&"field_guide"):
		if page == Page.GUIDE:
			_close_guide()
		else:
			_open_guide()
	elif event.is_action_pressed(&"pellet_machine") and page in [Page.POND, Page.MACHINE]:
		if page == Page.MACHINE:
			counter.close()
		else:
			_show_page(Page.MACHINE)
	elif event.is_action_pressed(&"toggle_sound"):
		_toggle_sound()
	elif page == Page.GUIDE and (event.is_action_pressed(&"ui_left") or event.is_action_pressed(&"ui_right")):
		guide.change_page(-1 if event.is_action_pressed(&"ui_left") else 1)
	elif page == Page.POND and get_viewport().gui_get_focus_owner() == board:
		if event.is_action_pressed(&"feed"):
			_throw_at(aim)
		elif event.keycode not in [KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN]:
			return
		# Leave keyboard focus on the water when using the arrows to aim.
	else:
		return
	get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	# A fixed-resolution Viewport can retain its size through an OS window resize.
	if get_window().size != _last_window_size:
		_layout()
	if page != Page.POND:
		return
	if _hint_left > 0:
		_hint_left -= delta
		if _hint_left <= 0:
			_show_hint()
	if get_viewport().gui_get_focus_owner() == board:
		var direction := Input.get_vector(&"ui_left", &"ui_right", &"ui_up", &"ui_down")
		if direction != Vector2.ZERO:
			_set_aim(GardenPond.confine(aim + direction * 96.0 * delta, 0.998))


func _on_coin() -> void:
	spending += PRICE
	counter.set_receipt(spending)
	sound.cue(&"coin")
	_update_journal()


func _on_serving() -> void:
	pond.hand.refill(SERVING)
	sound.cue(&"collect")
	_show_page(Page.POND)
	_update_journal()


func _on_meal(swimmer: PondSwimmer, units: int, bonus: int) -> void:
	if swimmer.profile.bird:
		bird_units += units
		sound.cue(&"bird")
	else:
		fish_units += units
		fed[swimmer.get_instance_id()] = true
		lucky_points += bonus
		sound.cue(&"lucky" if bonus else &"fish")
		if score() > best:
			best = score()
			_mark_dirty()
	_update_journal()


func score() -> int:
	return roundi(fish_units / 10.0) + lucky_points


func _update_journal() -> void:
	journal.update_values(pond.hand.stock, score(), fed.size(), pond.fish_population, best, fish_units, bird_units, spending)
	_show_hint()


func _show_hint() -> void:
	if _hint_left > 0:
		return
	var hint: Label = journal.get_node("%Hint")
	if pond.hand.lucky_in_hand():
		hint.text = "Lucky pellet in hand!\nA fish’s first bite earns +50."
	elif pond.hand.stock == 0:
		hint.text = "Visit the red machine beside the dock for more pellets."
	else:
		hint.text = "Click the water to feed.\nArrows aim. Space throws."


func _toggle_sound() -> void:
	sound.enabled = not sound.enabled
	%SoundButton.text = "Sound on" if sound.enabled else "Sound off"
	if sound.enabled:
		sound.cue(&"collect")
	_mark_dirty()


func _focus_lost() -> void:
	if _loaded and page == Page.POND:
		_show_page(Page.PAUSE)
	if _dirty:
		_save_record()


func _mark_dirty() -> void:
	_dirty = true
	if save_timer.is_stopped():
		save_timer.start()


func _load_record() -> void:
	var config := ConfigFile.new()
	if config.load(record_path) == OK:
		best = maxi(0, int(config.get_value("visit", "best", 0)))
		sound.enabled = bool(config.get_value("audio", "enabled", false))
	%SoundButton.text = "Sound on" if sound.enabled else "Sound off"


func _save_record() -> void:
	var config := ConfigFile.new()
	config.set_value("visit", "best", best)
	config.set_value("audio", "enabled", sound.enabled)
	_dirty = config.save(record_path) != OK


func _exit_tree() -> void:
	if _loaded and _dirty:
		_save_record()
