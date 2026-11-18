class_name PondSpecies
extends Resource

enum Gait { GLIDE, MEANDER, SHOAL, PADDLE, SWEEP, DRIFT }

@export var display_name: String
@export_multiline var field_note: String
@export var bird: bool
@export var gait: Gait
@export var count: int
@export var speed: float
@export var vision: float
@export var turning: float
@export var bite_units: int
@export var chew_seconds: float
@export var snout: float
@export var stroke_rate: float
@export var frames: SpriteFrames
