class_name PondInterface
extends Control
## Native, responsive interface for the pond. Every action is a signal so UI
## animation can never change simulation timing or feeding rules.

signal purchase_requested
signal restart_requested
signal sound_changed(enabled: bool)
signal assist_changed(enabled: bool)
signal debug_changed(enabled: bool)
signal guide_visibility_changed(open: bool)
signal scatter_requested
signal machine_visibility_changed(open: bool)

const MachineIllustration = preload("res://godot/scripts/ui_machine.gd")
const PondFrame = preload("res://godot/scripts/ui_pond_frame.gd")
const INK := Color("304c3f")
const GREEN := Color("315b49")
const MUTED := Color("7d8575")
const PAPER := Color("f6f3eb")
const LINE := Color("e0e2d4")
const GOLD := Color("c89757")
const PREFS_PATH := "user://preferences.cfg"

var pond_host: Control
var debug_enabled := false
var assist_enabled := false
var sound_enabled := false
var machine_open := false
var guide_open := false
var best_score := 0

var _world
var _art
var _font: Font
var _bold: Font
var _serif: Font
var _prefs := ConfigFile.new()
var _scroll: ScrollContainer
var _page: Control
var _header: Control
var _header_line: ColorRect
var _brand: Label
var _brand_fish: TextureRect
var _assist_button: Button
var _sound_button: Button
var _guide_button: Button
var _intro: Control
var _intro_heading: Label
var _intro_eyebrow: Label
var _intro_copy: Label
var _pond_card: Panel
var _hud: Control
var _food_card: Panel
var _food_icon: TextureRect
var _food_count: Label
var _food_caption: Label
var _food_label: Label
var _food_track: ProgressBar
var _score_card: Panel
var _score_count: Label
var _score_caption: Label
var _score_label: Label
var _fish_count: Label
var _best_label: Label
var _lucky_label: Label
var _location: Label
var _instruction: Panel
var _instruction_text: Label
var _actions: Control
var _machine_button: Button
var _scatter_button: Button
var _debug_button: Button
var _restart_button: Button
var _share_label: Label
var _share_meter: ProgressBar
var _share_value: Label
var _visit_line: Control
var _visit_note: Label
var _spend_note: Label
var _tips: Control
var _tip_panels: Array[Control] = []
var _footer: Label
var _debug_panel: Panel
var _debug_title: Label
var _debug_clock: Label
var _debug_note: Label
var _debug_metrics: Array[Label] = []
var _debug_table: Tree
var _debug_rows: Dictionary = {}
var _debug_timer := 0.0
var _overlay: ColorRect
var _machine_card: Panel
var _machine_visual: Control
var _machine_close: Button
var _machine_back: Button
var _coin_button: Button
var _coin_unit: Label
var _machine_title: Label
var _machine_description: Label
var _machine_offer: Label
var _machine_status: Label
var _machine_receipt: Label
var _machine_eyebrow: Label
var _guide_card: Panel
var _guide_close: Button
var _guide_title: Label
var _guide_eyebrow: Label
var _guide_scroll: ScrollContainer
var _guide_content: Control
var _guide_species: Array[Panel] = []
var _guide_portraits: Array[TextureRect] = []
var _guide_data: Array[Dictionary] = []
var _modal_tween: Tween
var _food_tween: Tween
var _score_tween: Tween
var _last_food := -1
var _last_score := -1
var _hand_key := ""
var _hand_deck: Array[int] = []
var _lucky_deck: Array[int] = []
var _last_hand_frame := -1
var _built := false


func setup(world, art) -> void:
	_world = world
	_art = art
	_load_preferences()
	_create_theme()
	_build_page()
	_build_machine()
	_build_guide()
	_built = true
	resized.connect(_layout)
	_layout()
	_apply_preferences()
	update_state(world, 0.0)


func bind_world(world) -> void:
	_world = world
	_last_food = -1
	_last_score = -1
	_hand_key = ""
	_debug_rows.clear()
	_debug_table.clear()
	_debug_table.create_item()
	close_guide()
	_hide_modal_immediately()
	update_state(world, 0.0)


func is_modal_open() -> bool:
	return machine_open or guide_open


func _load_preferences() -> void:
	_prefs.load(PREFS_PATH)
	assist_enabled = bool(_prefs.get_value("interface", "assist", false))
	debug_enabled = bool(_prefs.get_value("interface", "debug", false))
	sound_enabled = bool(_prefs.get_value("interface", "sound", false))
	best_score = int(_prefs.get_value("visit", "best_score", 0))


func _save_preferences() -> void:
	_prefs.set_value("interface", "assist", assist_enabled)
	_prefs.set_value("interface", "debug", debug_enabled)
	_prefs.set_value("interface", "sound", sound_enabled)
	_prefs.set_value("visit", "best_score", best_score)
	_prefs.save(PREFS_PATH)


func _create_theme() -> void:
	_font = load("res://godot/assets/fonts/Interface.ttf") if ResourceLoader.exists("res://godot/assets/fonts/Interface.ttf") else ThemeDB.fallback_font
	_bold = load("res://godot/assets/fonts/InterfaceBold.ttf") if ResourceLoader.exists("res://godot/assets/fonts/InterfaceBold.ttf") else _font
	_serif = load("res://godot/assets/fonts/Editorial.ttf") if ResourceLoader.exists("res://godot/assets/fonts/Editorial.ttf") else _font
	var native_theme := Theme.new()
	native_theme.default_font = _font
	native_theme.default_font_size = 13
	native_theme.set_color("font_color", "Label", INK)
	native_theme.set_color("font_color", "Button", INK)
	native_theme.set_color("font_hover_color", "Button", GREEN)
	native_theme.set_color("font_focus_color", "Button", INK)
	native_theme.set_color("font_pressed_color", "Button", PAPER)
	native_theme.set_color("font_disabled_color", "Button", Color("a4aa99"))
	native_theme.set_stylebox("normal", "Button", _box(Color("e8eade"), LINE, 7, 12))
	native_theme.set_stylebox("hover", "Button", _box(Color("dfe6d4"), Color("bdcbb2"), 7, 12))
	native_theme.set_stylebox("pressed", "Button", _box(GREEN, GREEN, 7, 12))
	native_theme.set_stylebox("disabled", "Button", _box(Color("eeeee5"), Color("e5e6db"), 7, 12))
	var focus := _box(Color.TRANSPARENT, GOLD, 8, 2)
	focus.set_border_width_all(2)
	native_theme.set_stylebox("focus", "Button", focus)
	native_theme.set_stylebox("panel", "TooltipPanel", _box(Color("fffcef"), LINE, 7, 10))
	native_theme.set_color("font_color", "TooltipLabel", INK)
	native_theme.set_font_size("font_size", "TooltipLabel", 12)
	native_theme.set_color("font_color", "Tree", INK)
	native_theme.set_color("font_selected_color", "Tree", INK)
	native_theme.set_font_size("font_size", "Tree", 12)
	native_theme.set_stylebox("panel", "Tree", _box(Color("f5f5eb"), Color("d6ddca"), 6, 6))
	native_theme.set_constant("v_separation", "Tree", 8)
	theme = native_theme
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _box(fill: Color, border: Color, radius: int, inset: int = 0) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = border
	box.set_border_width_all(1 if border.a > 0.0 else 0)
	box.set_corner_radius_all(radius)
	box.content_margin_left = inset
	box.content_margin_right = inset
	box.content_margin_top = inset
	box.content_margin_bottom = inset
	return box


func _label(parent: Node, text: String, font_size: int = 13, color: Color = INK, editorial: bool = false) -> Label:
	var label := Label.new()
	label.text = text
	label.clip_text = true
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", _serif if editorial else _font)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label


func _button(parent: Node, text: String, node_name: String, callback: Callable, quiet: bool = false) -> Button:
	var button := Button.new()
	button.text = text
	button.name = node_name
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.focus_mode = Control.FOCUS_ALL
	button.custom_minimum_size.y = 44.0
	button.add_theme_font_size_override("font_size", 12)
	if quiet:
		button.add_theme_stylebox_override("normal", _box(Color.TRANSPARENT, Color.TRANSPARENT, 7, 8))
		button.add_theme_stylebox_override("hover", _box(Color("e8ebdf"), Color.TRANSPARENT, 7, 8))
	button.pressed.connect(callback)
	parent.add_child(button)
	button.mouse_entered.connect(func():
		if button.disabled:
			return
		var hover := button.create_tween()
		hover.tween_property(button, "self_modulate", Color(1.03, 1.03, 1.00), 0.12)
	)
	button.mouse_exited.connect(func():
		var hover := button.create_tween()
		hover.tween_property(button, "self_modulate", Color.WHITE, 0.16)
	)
	return button


func _panel(parent: Node, fill: Color, border: Color, radius: int) -> Panel:
	var panel := Panel.new()
	panel.add_theme_stylebox_override("panel", _box(fill, border, radius))
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(panel)
	return panel


func _texture(parent: Node, texture: Texture2D) -> TextureRect:
	var picture := TextureRect.new()
	picture.texture = texture
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(picture)
	return picture


func _portrait(atlas: String, frame_name: String) -> Texture2D:
	var source := _art.frame(atlas, frame_name) as AtlasTexture
	if source == null:
		return null
	# Animation canvases preserve body registration in the pond. Static guide
	# portraits need the artwork itself, without that surrounding blank space.
	var portrait := source.duplicate() as AtlasTexture
	portrait.margin = Rect2()
	return portrait


func _progress(parent: Node, fill: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.min_value = 0.0
	bar.max_value = 1.0
	bar.show_percentage = false
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("background", _box(Color("e0dfca"), Color.TRANSPARENT, 3))
	bar.add_theme_stylebox_override("fill", _box(fill, Color.TRANSPARENT, 3))
	parent.add_child(bar)
	return bar


func _build_page() -> void:
	var background := ColorRect.new()
	background.color = PAPER
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_scroll = ScrollContainer.new()
	_scroll.name = "PageScroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_scroll.follow_focus = true
	_scroll.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(_scroll)
	_scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_page = Control.new()
	_page.name = "Page"
	_page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_page.mouse_filter = Control.MOUSE_FILTER_PASS
	_scroll.add_child(_page)
	_header = Control.new()
	_header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_page.add_child(_header)
	_header_line = ColorRect.new()
	_header_line.color = LINE
	_header_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_header.add_child(_header_line)
	_brand_fish = _texture(_header, _portrait("fish-swimmers", "koi-e-0"))
	_brand = _label(_header, "feed the fish.", 28, INK, true)
	_assist_button = _button(_header, "○  Assist mode", "AssistButton", _toggle_assist, true)
	_assist_button.tooltip_text = "Show pond tips, feeding details, and the field guide."
	_guide_button = _button(_header, "Field guide", "GuideButton", open_guide, true)
	_sound_button = _button(_header, "Sound off", "SoundButton", _toggle_sound, true)
	_sound_button.tooltip_text = "Turn pond music and gentle sound effects on or off."
	_intro = Control.new()
	_intro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_page.add_child(_intro)
	_intro_eyebrow = _label(_intro, "✳  A LITTLE POND. A MOMENT TO YOURSELF.", 10, MUTED)
	_intro_heading = _label(_intro, "A little stillness.", 47, INK, true)
	_intro_copy = _label(_intro, "The pond has all afternoon.\nA few pellets. A few ripples. Just be here.", 13, MUTED)
	_pond_card = _panel(_page, Color("33756e"), Color.TRANSPARENT, 16)
	_pond_card.name = "PondCard"
	var card_style := _pond_card.get_theme_stylebox("panel").duplicate() as StyleBoxFlat
	card_style.shadow_color = Color(0.12, 0.24, 0.17, 0.10)
	card_style.shadow_size = 12
	card_style.shadow_offset = Vector2(0.0, 5.0)
	_pond_card.add_theme_stylebox_override("panel", card_style)
	pond_host = Control.new()
	pond_host.name = "PondHost"
	pond_host.clip_contents = true
	pond_host.mouse_filter = Control.MOUSE_FILTER_STOP
	pond_host.mouse_default_cursor_shape = Control.CURSOR_CROSS
	pond_host.focus_mode = Control.FOCUS_CLICK
	_pond_card.add_child(pond_host)
	pond_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_hud = Control.new()
	_hud.name = "PondHUD"
	_hud.z_index = 1000
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_pond_card.add_child(_hud)
	_hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var rounded_frame := PondFrame.new()
	rounded_frame.name = "PondCorners"
	rounded_frame.z_index = 1001
	_pond_card.add_child(rounded_frame)
	rounded_frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_food_card = _panel(_hud, Color("fffbedf5"), Color("fff9e8"), 10)
	_food_label = _label(_food_card, "IN YOUR HAND", 9, MUTED)
	_food_icon = _texture(_food_card, _art.hand_icon(12))
	_food_count = _label(_food_card, "0", 31, INK, true)
	_food_count.name = "HandCount"
	_food_caption = _label(_food_card, "throws left", 11, MUTED)
	_food_track = _progress(_food_card, Color("9dba84"))
	_score_card = _panel(_hud, Color("fffbedf5"), Color("fff9e8"), 10)
	_score_label = _label(_score_card, "A LITTLE KINDNESS", 9, MUTED)
	_score_count = _label(_score_card, "0", 31, INK, true)
	_score_count.name = "Score"
	_score_caption = _label(_score_card, "points", 11, MUTED)
	_fish_count = _label(_score_card, "0 different fish fed", 10, MUTED)
	_best_label = _label(_score_card, "A lovely place to begin", 9, MUTED)
	_lucky_label = _label(_score_card, "", 10, Color("9b773b"))
	_location = _label(_hud, "●  A TIVOLI AFTERNOON     COPENHAGEN", 9, Color("fff9e3"))
	_location.add_theme_color_override("font_shadow_color", Color("294b3a"))
	_location.add_theme_constant_override("shadow_offset_y", 1)
	_instruction = _panel(_hud, Color("fffbedef"), Color("fff9e8"), 8)
	_instruction_text = _label(_instruction, "Click the water or press Space to throw.", 11, INK)
	_instruction_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_actions = Control.new()
	_actions.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_page.add_child(_actions)
	_share_label = _label(_actions, "WHO GOT THE PELLETS?", 9, MUTED)
	_share_meter = _progress(_actions, Color("90a979"))
	_share_value = _label(_actions, "— to the fish", 11, MUTED)
	_machine_button = _button(_actions, "Pellet machine    5 kr", "MachineButton", open_machine)
	_scatter_button = _button(_actions, "Throw pellets  ↗", "ThrowButton", func(): scatter_requested.emit())
	_debug_button = _button(_actions, "Debug", "DebugButton", _toggle_debug)
	_debug_button.tooltip_text = "Show boost meters, animal metrics, and the underwater turtle."
	_restart_button = _button(_actions, "↻", "RestartButton", func(): restart_requested.emit(), true)
	_restart_button.tooltip_text = "Begin a new visit."
	_restart_button.add_theme_font_size_override("font_size", 24)
	_restart_button.add_theme_stylebox_override("normal", _box(Color.TRANSPARENT, Color.TRANSPARENT, 7, 0))
	_restart_button.add_theme_stylebox_override("hover", _box(Color("e8ebdf"), Color.TRANSPARENT, 7, 0))
	_visit_line = Control.new()
	_visit_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_page.add_child(_visit_line)
	_visit_note = _label(_visit_line, "Use the red pellet machine to fill your hand.", 11, MUTED)
	_visit_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_spend_note = _label(_visit_line, "This visit   0 kr", 11, MUTED)
	_spend_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_build_debug()
	_build_tips()
	_footer = _label(_page, "Made for small moments of joy.                     Inspired by an afternoon in Tivoli  ✳", 11, MUTED)


func _build_tips() -> void:
	_tips = Control.new()
	_tips.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_page.add_child(_tips)
	var headings := ["Watch it travel.", "Let everyone linger.", "A little more, whenever."]
	var descriptions := ["Birds notice the arc through the air. Fish wait for that little splash.", "Carp meander. Their young shoal. Each creature takes its own time to chew.", "The red machine beside the dock brings ten more throws for one coin."]
	for index in range(3):
		var article := Control.new()
		article.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_tips.add_child(article)
		_tip_panels.append(article)
		_label(article, "%02d" % (index + 1), 11, Color("aaa48e"))
		_label(article, headings[index], 20, Color("52654c"), true)
		var copy := _label(article, descriptions[index], 12, MUTED)
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART


func _build_debug() -> void:
	_debug_panel = _panel(_page, Color("eef0e5"), Color("d7ddcc"), 10)
	_debug_panel.name = "DebugPanel"
	_debug_title = _label(_debug_panel, "Debug mode", 24, INK, true)
	_debug_clock = _label(_debug_panel, "", 11, MUTED)
	_debug_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_debug_note = _label(_debug_panel, "Boosts: gold while active, green when hungry, blue after a recent meal. The underwater turtle is visible.", 11, MUTED)
	_debug_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	for heading in ["Energy", "Airborne birds", "Pellets", "Food eaten", "Wind", "Machine"]:
		var metric := _label(_debug_panel, heading + "\n—", 12, INK)
		metric.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_debug_metrics.append(metric)
	_debug_table = Tree.new()
	_debug_table.name = "AnimalMetrics"
	_debug_table.columns = 7
	_debug_table.column_titles_visible = true
	_debug_table.hide_root = true
	_debug_table.select_mode = Tree.SELECT_ROW
	_debug_table.focus_mode = Control.FOCUS_ALL
	_debug_table.create_item()
	var titles := ["Animal", "Action", "Hunger", "Boost", "Last meal", "Eaten", "Base pace"]
	var widths := [145, 110, 110, 100, 105, 68, 95]
	for index in range(titles.size()):
		_debug_table.set_column_title(index, titles[index])
		_debug_table.set_column_custom_minimum_width(index, widths[index])
		_debug_table.set_column_expand(index, false)
	_debug_panel.add_child(_debug_table)


func _build_machine() -> void:
	_overlay = ColorRect.new()
	_overlay.name = "ModalBackdrop"
	_overlay.z_index = 2000
	_overlay.color = Color(0.11, 0.19, 0.14, 0.42)
	_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_overlay.visible = false
	add_child(_overlay)
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			if guide_open:
				close_guide()
			else:
				close_machine()
	)
	_machine_card = _panel(_overlay, Color("faf8ee"), Color("fefbef"), 16)
	_machine_card.name = "MachineDialog"
	_machine_card.mouse_filter = Control.MOUSE_FILTER_STOP
	_machine_card.visible = false
	_machine_eyebrow = _label(_machine_card, "THE PELLET MACHINE", 10, MUTED)
	_machine_close = _button(_machine_card, "×", "CloseMachineButton", close_machine, true)
	_machine_close.add_theme_font_size_override("font_size", 26)
	_machine_close.tooltip_text = "Close pellet machine."
	_machine_visual = MachineIllustration.new()
	_machine_visual.name = "VendingIllustration"
	_machine_card.add_child(_machine_visual)
	_machine_visual.setup(_art)
	_coin_button = _button(_machine_card, "5", "InsertCoinButton", _purchase)
	_coin_button.tooltip_text = "Insert 5 kr coin for ten throws."
	_coin_button.add_theme_font_override("font", _serif)
	_coin_button.add_theme_font_size_override("font_size", 23)
	_coin_button.add_theme_color_override("font_color", Color("72552c"))
	_coin_button.add_theme_stylebox_override("normal", _box(Color("e8c67a"), Color("c59c46"), 30, 4))
	_coin_button.add_theme_stylebox_override("hover", _box(Color("f2d78e"), Color("b38c3d"), 30, 4))
	var coin_focus := _box(Color.TRANSPARENT, GOLD, 30, 0)
	coin_focus.set_border_width_all(2)
	_coin_button.add_theme_stylebox_override("focus", coin_focus)
	_coin_unit = _label(_coin_button, "kr", 9, Color("92642d"))
	_coin_unit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_machine_title = _label(_machine_card, "Fish pellets", 40, INK, true)
	_machine_description = _label(_machine_card, "Insert a coin to turn the handle\nand collect a handful of pellets.", 13, MUTED)
	_machine_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_machine_offer = _label(_machine_card, "5 kr    for 10 throws", 24, Color("607e51"), true)
	_machine_status = _label(_machine_card, "Insert a coin.", 16, Color("768f62"), true)
	_machine_status.name = "MachineStatus"
	_machine_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_machine_receipt = _label(_machine_card, "Coins this visit   0\nTotal                  0 kr", 12, MUTED)
	_machine_back = _button(_machine_card, "Back to pond", "BackToPondButton", close_machine, true)


func _build_guide() -> void:
	_guide_card = _panel(_overlay, Color("faf8ee"), Color("fefbef"), 16)
	_guide_card.name = "GuideDialog"
	_guide_card.mouse_filter = Control.MOUSE_FILTER_STOP
	_guide_card.visible = false
	_guide_eyebrow = _label(_guide_card, "GET TO KNOW THE NEIGHBORS", 10, MUTED)
	_guide_title = _label(_guide_card, "Field guide", 39, INK, true)
	_guide_close = _button(_guide_card, "×", "CloseGuideButton", close_guide, true)
	_guide_close.add_theme_font_size_override("font_size", 26)
	_guide_close.tooltip_text = "Close field guide and return to the pond."
	_guide_scroll = ScrollContainer.new()
	_guide_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_guide_scroll.follow_focus = true
	_guide_card.add_child(_guide_scroll)
	_guide_content = Control.new()
	_guide_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_guide_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_guide_scroll.add_child(_guide_content)
	var seen: Dictionary = {}
	for animal in _array(_world, "animals"):
		var profile: Dictionary = _value(animal, "profile", {})
		var id := str(profile.get("id", ""))
		if profile.get("kind", "") == "turtle" or seen.has(id):
			continue
		seen[id] = true
		_guide_data.append(profile)
		var article := _panel(_guide_content, Color("f0f1e5"), Color("e1e5d4"), 10)
		_guide_species.append(article)
		var atlas := "fish-swimmers" if profile.get("kind", "fish") == "fish" else "bird-swimmers"
		var texture := _portrait(atlas, str(profile.get("texture", id)) + "-e-0")
		_guide_portraits.append(_texture(article, texture))
		_label(article, "LISTENS FOR THE SPLASH" if profile.get("kind", "fish") == "fish" else "WATCHES THE THROW", 9, MUTED)
		_label(article, str(profile.get("name", id)), 25, INK, true)
		var description := _label(article, str(profile.get("description", "")), 12, MUTED)
		description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var speed := float(profile.get("speed", 40.0))
		var pace := "Unhurried" if speed < 40.0 else "Very quick" if speed > 70.0 else "Steady"
		_label(article, "PACE  %s      CHEW  %ss" % [pace, _amount(float(profile.get("chew", 1.0)))], 10, Color("647d52"))


func _rect(control: Control, x: float, y: float, width: float, height: float) -> void:
	control.position = Vector2(x, y)
	control.size = Vector2(maxf(width, 0.0), maxf(height, 0.0))


func _layout() -> void:
	if not _built:
		return
	var viewport := size
	var phone := viewport.x < 650.0
	var narrow := viewport.x < 420.0
	var padding := 16.0 if phone else 40.0
	var width := minf(1200.0, viewport.x - padding * 2.0)
	# Compact desktop play keeps the complete scene and actions in one view.
	# Scaling the whole card preserves the promenade and dock along its base.
	if not phone and not assist_enabled:
		width = minf(width, maxf(720.0, (viewport.y - 247.0) * 1.5))
	var left := maxf(padding, (viewport.x - width) * 0.5)
	var header_height := 76.0 if phone else 92.0
	_rect(_header, left, 0.0, width, header_height)
	_rect(_header_line, 0.0, header_height - 1.0, width, 1.0)
	_rect(_brand_fish, 0.0, 22.0 if phone else 27.0, 35.0 if phone else 44.0, 35.0 if phone else 44.0)
	_rect(_brand, 38.0 if phone else 48.0, 20.0 if phone else 26.0, 205.0, 40.0)
	_brand.add_theme_font_size_override("font_size", 24 if phone else 29)
	var sound_width := 77.0 if phone else 101.0
	var assist_width := 70.0 if phone else 118.0
	_sound_button.text = ("Sound on" if sound_enabled else "Sound off")
	_assist_button.text = ("● Assist" if assist_enabled else "○ Assist") if phone else ("●  Assist mode" if assist_enabled else "○  Assist mode")
	if narrow:
		_brand.text = "feed the fish."
		_brand.add_theme_font_size_override("font_size", 21)
		_rect(_brand_fish, 0.0, 24.0, 30.0, 30.0)
		_rect(_brand, 33.0, 22.0, 155.0, 34.0)
	var tools_y := 22.0 if phone else 27.0
	_rect(_sound_button, width - sound_width, tools_y, sound_width, 36.0)
	_rect(_assist_button, width - sound_width - assist_width - (2.0 if phone else 13.0), tools_y, assist_width, 36.0)
	_rect(_guide_button, width - sound_width - assist_width - 140.0, tools_y, 120.0, 36.0)
	_guide_button.visible = assist_enabled
	if phone:
		_rect(_guide_button, 0.0, header_height + 100.0, 115.0, 30.0)
	var top := header_height + (18.0 if phone else 24.0)
	_intro.visible = assist_enabled
	if assist_enabled:
		var intro_height := 130.0 if phone else 125.0
		_rect(_intro, left, top, width, intro_height)
		_rect(_intro_eyebrow, 0.0, 0.0, width, 19.0)
		_intro_eyebrow.add_theme_font_size_override("font_size", 8 if phone else 10)
		_rect(_intro_heading, 0.0, 23.0, width, 60.0)
		_intro_heading.add_theme_font_size_override("font_size", 37 if phone else 49)
		_intro_copy.visible = not phone
		_rect(_intro_copy, width - 295.0, 45.0, 295.0, 58.0)
		top += intro_height
	var pond_height := width * 2.0 / 3.0
	if phone:
		pond_height = maxf(width, minf(viewport.y * 0.5, 420.0))
	_rect(_pond_card, left, top, width, pond_height)
	_layout_hud(width, pond_height, phone)
	top += pond_height + 17.0
	var actions_height := 90.0 if phone and assist_enabled else 49.0
	_rect(_actions, left, top, width, actions_height)
	var button_gap := 7.0 if phone else 13.0
	var machine_width := 138.0 if phone else 166.0
	var throw_width := 116.0 if phone else 137.0
	var debug_width := 55.0 if phone else 65.0
	var restart_width := 31.0
	var group_width := machine_width + throw_width + debug_width + restart_width + button_gap * 3.0
	# At small phone widths, put the reset on the second line instead of
	# shrinking the three primary touch targets below a comfortable size.
	var reset_wrap := group_width > width
	var row_y := 46.0 if phone and assist_enabled else 0.0
	if reset_wrap:
		machine_width = maxf(115.0, width * 0.39)
		throw_width = maxf(96.0, width * 0.33)
		debug_width = maxf(49.0, width - machine_width - throw_width - button_gap * 2.0)
		group_width = width
		_restart_button.visible = false
	else:
		_restart_button.visible = true
	var action_x := width - group_width
	_rect(_machine_button, action_x, row_y, machine_width, 44.0)
	_rect(_scatter_button, action_x + machine_width + button_gap, row_y, throw_width, 44.0)
	_rect(_debug_button, action_x + machine_width + throw_width + button_gap * 2.0, row_y, debug_width, 44.0)
	_rect(_restart_button, width - restart_width, row_y, restart_width, 44.0)
	_machine_button.add_theme_font_size_override("font_size", 10 if phone else 12)
	_scatter_button.add_theme_font_size_override("font_size", 10 if phone else 12)
	_debug_button.add_theme_font_size_override("font_size", 10 if phone else 12)
	_share_label.visible = assist_enabled
	_share_meter.visible = assist_enabled
	_share_value.visible = assist_enabled
	_rect(_share_label, 0.0, 10.0, 146.0, 18.0)
	_rect(_share_meter, 155.0 if not phone else 142.0, 17.0, 100.0 if not phone else 70.0, 5.0)
	_rect(_share_value, 267.0 if not phone else 223.0, 10.0, 120.0, 19.0)
	if assist_enabled and not phone and width < 1070.0:
		_rect(_actions, left, top, width, 90.0)
		for button in [_machine_button, _scatter_button, _debug_button, _restart_button]:
			button.position.y = 46.0
		actions_height = 90.0
	top += actions_height + 2.0
	_rect(_visit_line, left, top, width, 40.0 if phone else 30.0)
	_visit_note.visible = assist_enabled
	_rect(_visit_note, 0.0, 4.0, maxf(width - 145.0, 140.0), 38.0)
	_rect(_spend_note, maxf(0.0, width - 142.0), 4.0, 142.0, 22.0)
	if reset_wrap:
		_restart_button.visible = true
		_restart_button.reparent(_visit_line)
		_rect(_restart_button, 0.0, 0.0, 44.0, 44.0)
		if assist_enabled:
			_visit_note.position.x = 42.0
			_visit_note.size.x = maxf(110.0, width - 190.0)
	elif _restart_button.get_parent() != _actions:
		_restart_button.reparent(_actions)
		_rect(_restart_button, width - restart_width, row_y, restart_width, 44.0)
	top += 45.0 if phone else 39.0
	_debug_panel.visible = debug_enabled
	if debug_enabled:
		_layout_debug(left, top, width, phone)
		top += 538.0 if phone else 450.0
	_tips.visible = assist_enabled
	_footer.visible = assist_enabled
	if assist_enabled:
		var tips_height := 254.0 if phone else 123.0
		_rect(_tips, left, top + 7.0, width, tips_height)
		for index in range(_tip_panels.size()):
			var article := _tip_panels[index]
			var article_width := width if phone else (width - 58.0) / 3.0
			_rect(article, 0.0 if phone else float(index) * (article_width + 29.0), float(index) * 81.0 if phone else 0.0, article_width, 105.0)
			_rect(article.get_child(0), 0.0, 4.0, 25.0, 20.0)
			_rect(article.get_child(1), 33.0, 0.0, article_width - 33.0, 29.0)
			_rect(article.get_child(2), 33.0, 32.0, article_width - 40.0, 66.0)
		top += tips_height + 20.0
		_footer.text = "Made for small moments of joy.\nInspired by an afternoon in Tivoli  ✳" if phone else "Made for small moments of joy.                     Inspired by an afternoon in Tivoli  ✳"
		_rect(_footer, left, top, width, 55.0)
		top += 65.0
	_page.custom_minimum_size = Vector2(0.0, top + 12.0)
	_layout_modals(phone)


func _layout_hud(width: float, height: float, phone: bool) -> void:
	var inset := 11.0 if phone else 20.0
	var food_width := (165.0 if phone else 219.0) if assist_enabled else (155.0 if phone else 177.0)
	var score_width := (125.0 if phone else 184.0) if assist_enabled else (86.0 if phone else 107.0)
	var food_height := (100.0 if phone else 121.0) if assist_enabled else 62.0
	var score_height := (128.0 if phone else 140.0) if assist_enabled else 62.0
	_rect(_food_card, inset, inset, food_width, food_height)
	_rect(_score_card, width - score_width - inset, inset, score_width, score_height)
	_food_label.visible = assist_enabled
	_score_label.visible = assist_enabled
	_food_track.visible = assist_enabled
	_fish_count.visible = assist_enabled
	_best_label.visible = assist_enabled
	_location.visible = assist_enabled and not phone
	_instruction.visible = assist_enabled
	_rect(_food_label, 12.0, 9.0, food_width - 24.0, 16.0)
	_rect(_score_label, 13.0, 9.0, score_width - 20.0, 16.0)
	var row_y := 27.0 if assist_enabled else 7.0
	var icon_size := 43.0 if phone else 49.0
	_rect(_food_icon, 8.0, row_y - 1.0, icon_size, icon_size)
	_rect(_food_count, icon_size + 14.0, row_y + 2.0, 49.0, 37.0)
	var caption_x := icon_size + 15.0 + (34.0 if phone else 39.0)
	_rect(_food_caption, caption_x, row_y + 14.0, food_width - caption_x - 6.0, 18.0)
	_food_caption.add_theme_font_size_override("font_size", 9 if phone else 11)
	_rect(_food_track, 15.0, food_height - 16.0, food_width - 30.0, 3.0)
	_rect(_score_count, 13.0, row_y + 2.0, score_width - 25.0, 37.0)
	_rect(_score_caption, 14.0, row_y + 32.0 if assist_enabled else row_y + 32.0, score_width - 24.0, 15.0)
	_score_caption.add_theme_font_size_override("font_size", 9 if phone else 10)
	_score_count.add_theme_font_size_override("font_size", 28 if phone else 32)
	_food_count.add_theme_font_size_override("font_size", 28 if phone else 32)
	_rect(_fish_count, 13.0, row_y + 54.0, score_width - 24.0, 18.0)
	_fish_count.add_theme_font_size_override("font_size", 8 if phone else 10)
	_rect(_best_label, 13.0, score_height - 23.0, score_width - 24.0, 17.0)
	_best_label.add_theme_font_size_override("font_size", 7 if phone else 9)
	_rect(_lucky_label, score_width - 162.0, score_height + 4.0, 160.0, 22.0)
	_lucky_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_rect(_location, inset, height - 37.0, 430.0, 20.0)
	var instruction_width := minf(321.0, width - inset * 2.0)
	_rect(_instruction, width - instruction_width - inset, height - (55.0 if not phone else 47.0), instruction_width, 37.0)
	_rect(_instruction_text, 12.0, 7.0, instruction_width - 24.0, 27.0)
	_instruction_text.add_theme_font_size_override("font_size", 9 if phone else 11)


func _layout_debug(left: float, top: float, width: float, phone: bool) -> void:
	var panel_height := 519.0 if phone else 430.0
	_rect(_debug_panel, left, top, width, panel_height)
	_rect(_debug_title, 18.0, 13.0, width - 175.0, 34.0)
	_rect(_debug_clock, width - 150.0, 20.0, 132.0, 20.0)
	_rect(_debug_note, 18.0, 52.0, width - 36.0, 51.0 if phone else 34.0)
	var columns := 2 if phone else 3
	var cell_width := (width - 36.0) / float(columns)
	var metrics_y := 110.0 if phone else 90.0
	for index in range(_debug_metrics.size()):
		_rect(_debug_metrics[index], 18.0 + float(index % columns) * cell_width, metrics_y + float(index / columns) * 54.0, cell_width - 10.0, 51.0)
	var table_y := 280.0 if phone else 205.0
	_rect(_debug_table, 15.0, table_y, width - 30.0, panel_height - table_y - 15.0)


func _layout_modals(phone: bool) -> void:
	var margin := 14.0 if phone else 35.0
	var card_width := minf(760.0, size.x - margin * 2.0)
	var compact := card_width < 580.0
	var card_height := minf(size.y - margin * 2.0, 680.0 if compact else 525.0)
	_rect(_machine_card, (size.x - card_width) * 0.5, (size.y - card_height) * 0.5, card_width, card_height)
	_rect(_machine_close, card_width - 48.0, 10.0, 37.0, 37.0)
	_rect(_machine_eyebrow, 25.0, 21.0, card_width - 90.0, 20.0)
	_machine_eyebrow.visible = assist_enabled and not compact
	_machine_description.visible = assist_enabled and not compact
	if compact:
		var illustration_height := clampf(card_height - 235.0, 230.0, 370.0)
		var visual_width := illustration_height * 300.0 / 420.0
		_rect(_machine_visual, (card_width - visual_width) * 0.5, 25.0, visual_width, illustration_height)
		var scale_factor := illustration_height / 420.0
		var coin_y := 25.0 + 347.0 * scale_factor
		_rect(_coin_button, (card_width - 54.0) * 0.5, coin_y, 54.0, 54.0)
		var copy_y := illustration_height + 27.0
		_rect(_machine_title, 16.0, copy_y, card_width - 32.0, 43.0)
		_machine_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_machine_title.add_theme_font_size_override("font_size", 31)
		_rect(_machine_offer, 16.0, copy_y + 46.0, card_width - 32.0, 31.0)
		_machine_offer.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_machine_offer.add_theme_font_size_override("font_size", 22)
		_rect(_machine_status, 22.0, copy_y + 82.0, card_width - 44.0, 42.0)
		_machine_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_rect(_machine_receipt, 22.0, copy_y + 123.0, card_width - 44.0, 43.0)
		_machine_receipt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_rect(_machine_back, (card_width - 150.0) * 0.5, card_height - 47.0, 150.0, 35.0)
	else:
		_rect(_machine_visual, 29.0, 48.0, 300.0, 420.0)
		_rect(_coin_button, 150.0, 411.0, 60.0, 60.0)
		var copy_x := 366.0
		var copy_width := card_width - copy_x - 31.0
		_rect(_machine_title, copy_x, 110.0, copy_width, 55.0)
		_machine_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		_machine_title.add_theme_font_size_override("font_size", 40)
		_rect(_machine_description, copy_x, 173.0, copy_width, 65.0)
		_rect(_machine_offer, copy_x, 255.0, copy_width, 38.0)
		_machine_offer.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		_machine_offer.add_theme_font_size_override("font_size", 25)
		_rect(_machine_status, copy_x, 311.0, copy_width, 50.0)
		_machine_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		_rect(_machine_receipt, copy_x, 377.0, copy_width, 52.0)
		_machine_receipt.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		_rect(_machine_back, copy_x - 9.0, 447.0, 155.0, 35.0)
	_rect(_coin_unit, 0.0, _coin_button.size.y - 17.0, _coin_button.size.x, 13.0)
	var guide_width := minf(950.0, size.x - margin * 2.0)
	var guide_height := minf(760.0, size.y - margin * 2.0)
	_rect(_guide_card, (size.x - guide_width) * 0.5, (size.y - guide_height) * 0.5, guide_width, guide_height)
	_rect(_guide_eyebrow, 24.0, 22.0, guide_width - 85.0, 19.0)
	_rect(_guide_title, 24.0, 48.0, guide_width - 80.0, 55.0)
	_rect(_guide_close, guide_width - 48.0, 13.0, 37.0, 37.0)
	_rect(_guide_scroll, 19.0, 117.0, guide_width - 38.0, guide_height - 135.0)
	var columns := 1 if guide_width < 580.0 else 2 if guide_width < 830.0 else 3
	var cell_width := (guide_width - 38.0 - float(columns - 1) * 13.0) / float(columns)
	for index in range(_guide_species.size()):
		var article := _guide_species[index]
		_rect(article, float(index % columns) * (cell_width + 13.0), float(index / columns) * 300.0, cell_width, 286.0)
		_rect(article.get_child(0), 17.0, 11.0, cell_width - 34.0, 83.0)
		_rect(article.get_child(1), 17.0, 103.0, cell_width - 34.0, 18.0)
		_rect(article.get_child(2), 17.0, 127.0, cell_width - 34.0, 37.0)
		_rect(article.get_child(3), 17.0, 172.0, cell_width - 34.0, 66.0)
		_rect(article.get_child(4), 17.0, 253.0, cell_width - 34.0, 20.0)
	_guide_content.custom_minimum_size = Vector2(0.0, ceilf(float(_guide_species.size()) / float(columns)) * 300.0)


func _apply_preferences() -> void:
	_assist_button.button_pressed = assist_enabled
	_debug_button.button_pressed = debug_enabled
	_sound_button.button_pressed = sound_enabled
	_debug_button.add_theme_stylebox_override("normal", _box(GREEN if debug_enabled else Color("e8eade"), GREEN if debug_enabled else LINE, 7, 12))
	_debug_button.add_theme_color_override("font_color", PAPER if debug_enabled else INK)
	_layout()


func _toggle_assist() -> void:
	assist_enabled = not assist_enabled
	_apply_preferences()
	_save_preferences()
	assist_changed.emit(assist_enabled)


func _toggle_debug() -> void:
	debug_enabled = not debug_enabled
	_apply_preferences()
	_save_preferences()
	_debug_timer = 0.0
	debug_changed.emit(debug_enabled)


func _toggle_sound() -> void:
	sound_enabled = not sound_enabled
	_apply_preferences()
	_save_preferences()
	sound_changed.emit(sound_enabled)


func _purchase() -> void:
	if not _machine_busy() and not bool(_machine().get("restocking", false)) and int(_machine().get("stock", 0)) > 0:
		purchase_requested.emit()


func open_machine() -> void:
	if machine_open:
		return
	if guide_open:
		close_guide()
	machine_open = true
	guide_open = false
	_show_modal(_machine_card)
	machine_visibility_changed.emit(true)
	_coin_button.grab_focus()


func close_machine() -> void:
	if not machine_open or _machine_busy():
		return
	machine_open = false
	machine_visibility_changed.emit(false)
	_hide_modal(_machine_card)
	pond_host.grab_focus()


func open_guide() -> void:
	if guide_open or _machine_busy():
		return
	if machine_open:
		close_machine()
	guide_open = true
	machine_open = false
	_show_modal(_guide_card)
	guide_visibility_changed.emit(true)
	_guide_close.grab_focus()


func close_guide() -> void:
	if not guide_open:
		return
	guide_open = false
	guide_visibility_changed.emit(false)
	_hide_modal(_guide_card)
	pond_host.grab_focus()


func _show_modal(card: Panel) -> void:
	if _modal_tween != null and _modal_tween.is_valid():
		_modal_tween.kill()
	_overlay.visible = true
	_overlay.modulate.a = 0.0
	_machine_card.visible = card == _machine_card
	_guide_card.visible = card == _guide_card
	_layout_modals(size.x < 650.0)
	var final_position := card.position
	card.position.y += 14.0
	_modal_tween = create_tween().set_parallel(true)
	_modal_tween.tween_property(_overlay, "modulate:a", 1.0, 0.18)
	_modal_tween.tween_property(card, "position", final_position, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_limit_modal_focus(card)


func _hide_modal(card: Panel) -> void:
	if _modal_tween != null and _modal_tween.is_valid():
		_modal_tween.kill()
	_modal_tween = create_tween().set_parallel(true)
	_modal_tween.tween_property(_overlay, "modulate:a", 0.0, 0.15)
	_modal_tween.tween_property(card, "position:y", card.position.y + 8.0, 0.15)
	_modal_tween.chain().tween_callback(func():
		if not is_modal_open():
			_overlay.visible = false
			card.visible = false
	)


func _hide_modal_immediately() -> void:
	if _modal_tween != null and _modal_tween.is_valid():
		_modal_tween.kill()
	if machine_open:
		machine_visibility_changed.emit(false)
	machine_open = false
	_overlay.visible = false
	_machine_card.visible = false
	_guide_card.visible = false


func _limit_modal_focus(card: Panel) -> void:
	var buttons: Array = [_guide_close] if card == _guide_card else [_coin_button, _machine_back, _machine_close]
	for index in range(buttons.size()):
		buttons[index].focus_next = buttons[index].get_path_to(buttons[(index + 1) % buttons.size()])
		buttons[index].focus_previous = buttons[index].get_path_to(buttons[(index + buttons.size() - 1) % buttons.size()])


func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and is_modal_open():
		if guide_open:
			close_guide()
		else:
			close_machine()
		get_viewport().set_input_as_handled()


func update_state(world, delta: float) -> void:
	if not _built:
		return
	_world = world
	var handfuls := int(_value(world, "handfuls", 0))
	var score := int(world.score())
	_food_count.text = str(handfuls)
	_score_count.text = str(score)
	_fit_counter(_food_count)
	_fit_counter(_score_count)
	_food_track.value = minf(float(handfuls) / 10.0, 1.0)
	_fish_count.text = "%d different fish fed" % _dictionary(world, "fed_fish").size()
	_best_label.text = "Most kindness: %d points" % best_score if best_score > 0 else "A lovely place to begin"
	var lucky := int(_value(world, "lucky_bonus", 0))
	_lucky_label.text = "✦ Lucky kindness +%d" % lucky if lucky > 0 else ""
	_lucky_label.visible = lucky > 0
	var machine := _machine()
	var coins := int(machine.get("coins_used", 0))
	_spend_note.text = "This visit   %d kr" % (coins * 5)
	_machine_receipt.text = "Coins this visit   %d\nTotal                  %d kr" % [coins, coins * 5]
	var fish_food := float(_value(world, "fish_food", 0.0))
	var total_food := fish_food + float(_value(world, "bird_food", 0.0)) + float(_value(world, "turtle_food", 0.0))
	var share := float(world.fish_share())
	_share_meter.value = share
	_share_value.text = "%d%% to the fish" % roundi(share * 100.0) if total_food > 0.0 else "— to the fish"
	var paused := bool(_value(world, "paused", false))
	_scatter_button.disabled = paused or _machine_busy() or handfuls == 0
	_coin_button.disabled = _machine_busy() or bool(machine.get("restocking", false)) or int(machine.get("stock", 0)) <= 0
	_coin_button.visible = str(machine.get("phase", "ready")) == "ready"
	_machine_close.disabled = _machine_busy()
	_machine_back.disabled = _machine_busy()
	_machine_status.text = _machine_status_text(machine)
	_machine_visual.update_machine(machine, delta)
	_update_hand(handfuls)
	_visit_note.text = "Use the red pellet machine to fill your hand." if handfuls == 0 else "Click the water or press Space to throw from the dock."
	if score > best_score:
		best_score = score
		_save_preferences()
	if _last_food >= 0 and handfuls != _last_food:
		_pulse(_food_count, true)
	if _last_score >= 0 and score > _last_score:
		_pulse(_score_count, false)
	_last_food = handfuls
	_last_score = score
	_debug_timer -= delta
	if debug_enabled and _debug_timer <= 0.0:
		_update_debug()
		_debug_timer = 0.2


func _update_hand(handfuls: int) -> void:
	var next_throw := _dictionary(_world, "next_throw")
	var lucky := bool(next_throw.get("lucky", false))
	var key := "%d:%s:%s" % [int(next_throw.get("id", int(_dictionary(_world, "last_throw").get("id", -1)) + 1)), str(lucky), str(handfuls > 0)]
	if key == _hand_key:
		return
	_hand_key = key
	var frame := 12
	if handfuls > 0:
		var deck: Array[int] = _lucky_deck if lucky else _hand_deck
		if deck.is_empty():
			if lucky:
				deck.assign([10, 11])
			else:
				for index in range(10):
					deck.append(index)
			deck.shuffle()
			if deck.size() > 1 and deck.back() == _last_hand_frame:
				var first := deck[0]
				deck[0] = deck.back()
				deck[deck.size() - 1] = first
		frame = deck.pop_back()
	_last_hand_frame = frame
	_food_icon.texture = _art.hand_icon(frame)
	_food_icon.modulate = Color("fff0c5") if lucky and handfuls > 0 else Color.WHITE


func _pulse(label: Label, food: bool) -> void:
	var old_tween := _food_tween if food else _score_tween
	if old_tween != null and old_tween.is_valid():
		old_tween.kill()
	label.pivot_offset = label.size * 0.5
	label.scale = Vector2.ONE * 1.10
	var tween := create_tween()
	tween.tween_property(label, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	if food:
		_food_tween = tween
	else:
		_score_tween = tween


func _fit_counter(label: Label) -> void:
	var font_size := 28 if size.x < 650.0 else 32
	while font_size > 16 and _serif.get_string_size(label.text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size).x > label.size.x:
		font_size -= 1
	if label.get_theme_font_size("font_size") != font_size:
		label.add_theme_font_size_override("font_size", font_size)


func _update_debug() -> void:
	var elapsed := float(_value(_world, "elapsed", 0.0))
	_debug_clock.text = "%s · %.1fs" % ["Paused" if bool(_value(_world, "paused", false)) else "Live", elapsed]
	var hungry := 0
	var recently_fed := 0
	var boosting := 0
	var airborne := 0
	var active_ids: Dictionary = {}
	for animal in _array(_world, "animals"):
		var profile: Dictionary = _value(animal, "profile", {})
		var id := int(_value(animal, "id", 0))
		active_ids[id] = true
		var last_meal = _value(animal, "last_ate_at", null)
		var seconds_since := elapsed - float(last_meal) if last_meal != null else -1.0
		var fed := seconds_since >= 0.0 and seconds_since < 20.0
		if fed:
			recently_fed += 1
		else:
			hungry += 1
		if bool(_value(animal, "boosting", false)):
			boosting += 1
		if not _dictionary(animal, "flight").is_empty():
			airborne += 1
		var row: TreeItem = _debug_rows.get(id)
		if row == null:
			row = _debug_table.create_item(_debug_table.get_root())
			_debug_rows[id] = row
		var values := ["%s #%d" % [str(profile.get("name", "Animal")), id + 1], str(_value(animal, "state", "roaming")).replace("-", " "), "Recently fed" if fed else "Hungry", "—" if profile.get("kind", "") == "turtle" else "%d%%%s" % [roundi(float(_value(animal, "boost_charge", 1.0)) * 100.0), " · active" if bool(_value(animal, "boosting", false)) else ""], "Never" if seconds_since < 0.0 else "%.1fs ago" % seconds_since, _amount(float(_value(animal, "total_eaten", 0.0))), "%s px/s" % _amount(float(profile.get("speed", 0.0)))]
		for column in range(values.size()):
			row.set_text(column, values[column])
			row.set_custom_color(column, Color("8c702e") if bool(_value(animal, "boosting", false)) else INK)
	for id in _debug_rows.keys():
		if not active_ids.has(id):
			_debug_rows[id].free()
			_debug_rows.erase(id)
	var pellet_counts := [0, 0, 0, 0]
	for food in _array(_world, "food"):
		if float(_value(food, "release_at", 0.0)) > elapsed:
			pellet_counts[0] += 1
		elif str(_value(food, "phase", "water")) == "air":
			pellet_counts[1] += 1
		elif float(_value(food, "age", 0.0)) <= 1.7:
			pellet_counts[2] += 1
		else:
			pellet_counts[3] += 1
	var ambience = _value(_world, "ambience", {})
	var wind := _dictionary(ambience, "wind")
	var employee := _dictionary(ambience, "employee")
	var direction := posmod(roundi(rad_to_deg(float(wind.get("direction", 0.0)))), 360)
	var values := ["Energy\n%d hungry · %d fed · %d boosting" % [hungry, recently_fed, boosting], "Airborne birds\n%d" % airborne, "Pellets\n%d queued · %d air · %d floating · %d under" % pellet_counts, "Food eaten\n%s fish · %s bird · %s turtle" % [_amount(float(_value(_world, "fish_food", 0.0))), _amount(float(_value(_world, "bird_food", 0.0))), _amount(float(_value(_world, "turtle_food", 0.0)))], "Wind\n%d° · %d%% strength" % [direction, roundi(float(wind.get("strength", 0.0)) * 100.0)], "Machine\n%d servings · employee %s" % [int(_machine().get("stock", 0)), str(employee.get("phase", "away"))]]
	for index in range(values.size()):
		_debug_metrics[index].text = values[index]


func handle_events(events: Array) -> void:
	for event in events:
		match str(_value(event, "type", "")):
			"dispensed":
				# The simulation has completed collection and credited the hand.
				if machine_open:
					machine_open = false
					machine_visibility_changed.emit(false)
					_hide_modal(_machine_card)
					pond_host.grab_focus()
			"needs_food":
				open_machine()
			"lucky":
				_pulse(_score_count, false)


func _machine_status_text(machine: Dictionary) -> String:
	match str(machine.get("phase", "ready")):
		"inserting": return "Inserting coin…"
		"turning": return "Turning handle…"
		"dispensing": return "Dispensing pellets…"
		"collecting": return "Collecting pellets…"
	if bool(machine.get("restocking", false)):
		return "Refilling…"
	if int(machine.get("stock", 0)) <= 0:
		return "Sold out. More pellets are on the way."
	var employee := _dictionary(_value(_world, "ambience", {}), "employee")
	if str(employee.get("phase", "")) in ["arriving", "waiting"]:
		return "More pellets are on the way."
	return "Insert a coin."


func _machine_busy() -> bool:
	return str(_machine().get("phase", "ready")) != "ready"


func _machine() -> Dictionary:
	return _dictionary(_world, "machine")


func _value(subject, key: String, fallback = null):
	if subject is Dictionary:
		return subject.get(key, fallback)
	if subject is Object:
		var value = subject.get(key)
		return fallback if value == null else value
	return fallback


func _dictionary(subject, key: String) -> Dictionary:
	var value = _value(subject, key, {})
	return value if value is Dictionary else {}


func _array(subject, key: String) -> Array:
	var value = _value(subject, key, [])
	return value if value is Array else []


func _amount(value: float) -> String:
	return ("%.2f" % value).trim_suffix("0").trim_suffix("0").trim_suffix(".")
