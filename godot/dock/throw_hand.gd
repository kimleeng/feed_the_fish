class_name ThrowingHand
extends Node2D

signal released(from: Vector2, target: Vector2, motion: StringName, lucky: bool)
signal palm_changed

class Order:
	var aim: Vector2
	var motion: StringName
	var lucky: bool
	var launched := false

@onready var player: AnimationPlayer = $AnimationPlayer
@onready var handful: PalmPellets = $Swing/Handful
var rng := RandomNumberGenerator.new()
var stock := 0
var next_lucky := false
var active: Order
var waiting: Array[Order] = []


func _ready() -> void:
	player.animation_finished.connect(_finished)


func reset() -> void:
	player.stop()
	waiting.clear()
	active = null
	stock = 0
	next_lucky = false
	$Swing.position = Vector2.ZERO
	$Swing/Sleeve.frame = 3
	_update_palm()


func refill(count: int) -> void:
	if stock == 0:
		next_lucky = rng.randf() < 0.02
	stock += count
	_update_palm()


func reserve(aim: Vector2) -> bool:
	if stock <= 0:
		return false
	var order := Order.new()
	var pick := rng.randf()
	if pick < 0.6:
		order.motion = &"toss"
	elif pick < 0.9:
		order.motion = &"sweep"
	else:
		order.motion = &"lob"
	order.aim = aim
	order.lucky = next_lucky
	stock -= 1
	next_lucky = stock > 0 and rng.randf() < 0.02
	waiting.append(order)
	if not active:
		_begin()
	return true


func _begin() -> void:
	if waiting.is_empty():
		active = null
	else:
		active = waiting.pop_front()
		player.play(active.motion)
		player.advance(0)
	_update_palm()


# Called by a method key at the palm's forward crossing in each animation.
func release_pellets() -> void:
	if not active or active.launched:
		return
	active.launched = true
	released.emit($ReleasePoint.global_position, active.aim, active.motion, active.lucky)
	_update_palm()


func _finished(_animation: StringName) -> void:
	_begin()


func lucky_in_hand() -> bool:
	if active:
		return active.lucky and not active.launched
	return stock > 0 and next_lucky


func _update_palm() -> void:
	handful.visible = not active.launched if active else stock > 0
	handful.golden = lucky_in_hand()
	handful.queue_redraw()
	palm_changed.emit()
