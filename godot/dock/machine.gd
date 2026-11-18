class_name PelletCounter
extends Panel

signal coin_inserted
signal serving_collected
signal dismissed
signal crank_turned

@onready var player: AnimationPlayer = $AnimationPlayer
var busy := false


func _ready() -> void:
	%Buy.pressed.connect(insert_coin)
	%Watch.pressed.connect(close)
	$Art.gui_input.connect(_art_input)
	player.animation_finished.connect(_finished)


func open(spending: int, price: int, serving: int) -> void:
	show()
	busy = false
	player.stop()
	$Art/Coin.position = Vector2(119, 129)
	$Art/Coin.show()
	$Art/Crank.frame = 0
	$Art/Collect.position = Vector2(83, 231)
	$Art/Stream.progress = -1.0
	$Art/Collect/Pile.hide()
	%Offer.text = "%d throws" % serving
	$Cost.text = "One %d kr garden coin per serving." % price
	%Buy.text = "Insert %d kr" % price
	%Status.text = "Unused throws carry over."
	set_receipt(spending)
	%Buy.disabled = false
	%Watch.disabled = false
	%Buy.grab_focus()


func set_receipt(spending: int) -> void:
	%Receipt.text = "Spent this visit   %d kr" % spending


func close() -> void:
	if not busy:
		dismissed.emit()


func insert_coin() -> void:
	if busy or not is_visible_in_tree():
		return
	busy = true
	%Buy.disabled = true
	%Watch.disabled = true
	coin_inserted.emit()
	stage(0)
	player.play(&"dispense")


func stage(index: int) -> void:
	const STAGES := ["Inserting your coin…", "Turning the handle…", "Pellets are falling…", "Collecting your handful…"]
	%Status.text = STAGES[index]
	if index == 1:
		crank_turned.emit()


func _art_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		insert_coin()
		$Art.accept_event()


func _finished(animation: StringName) -> void:
	if animation == &"dispense" and busy:
		busy = false
		serving_collected.emit()
