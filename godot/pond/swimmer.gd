class_name PondSwimmer
extends Node2D

const VIEWS: Array[StringName] = [&"e", &"se", &"s", &"sw", &"w", &"nw", &"n", &"ne"]
const SECTOR := TAU / 8.0

@onready var body: AnimatedSprite2D = $Body
var profile: PondSpecies
var school := -1
var school_offset: Vector2
var heading: float
var speed := 0.0
var phase: float
var destination: Vector2
var chew_left := 0.0
var target: PondPellet
var _view := -1
var _sense_in: float
var _wake_travel := 0.0
var _separation := Vector2.ZERO


func place(species: PondSpecies, at: Vector2, facing: float, offset: float) -> void:
	profile = species
	position = at
	heading = facing
	phase = offset
	_sense_in = phase / TAU * 0.14
	_wake_travel = phase
	body.sprite_frames = profile.frames
	if not profile.bird:
		body.self_modulate = Color(0.81, 0.96, 0.87, 0.87 + 0.04 * sin(phase))
	update_view()
	body.set_frame_and_progress(int(phase / TAU * 8.0) % 8, fmod(phase, 1.0))
	reset_physics_interpolation()


func advance(delta: float, pond: GardenPond) -> void:
	chew_left = maxf(0.0, chew_left - delta)
	_sense_in -= delta
	if _sense_in <= 0.0:
		_sense_in += 0.14
		_separation = pond.personal_space(self)
		target = pond.nearest_food(self) if chew_left == 0.0 else null
	if is_instance_valid(target) and not target.available_to(profile.bird):
		target = null
	var foraging := is_instance_valid(target) and chew_left == 0.0
	var bend := 0.0
	var pace := 0.0
	var goal := destination
	if foraging:
		goal = target.target if target.airborne else target.position
		pace = 1.0
		var reach := 3.4 + profile.bite_units * 0.026
		var snout := Vector2.from_angle(heading) * Vector2(1.0, 0.72) * profile.snout
		if profile.bird:
			snout.y -= 2.0
		if target.within_reach(position + snout, reach) or target.within_reach(position, reach * 0.75):
			pond.take_bite(self, target)
			chew_left = profile.chew_seconds
			target = null
			pace = 0.0
	elif chew_left == 0.0:
		var t := pond.elapsed
		match profile.gait:
			PondSpecies.Gait.SHOAL:
				var group := pond.schools[school]
				goal = group.center + school_offset + Vector2.from_angle(t * 0.8 + phase) * 2.0
				pace = 0.32 + 0.52 * group.pulse
			PondSpecies.Gait.SWEEP:
				var angle := t * 0.1 + phase
				goal = GardenPond.CENTER + Vector2(cos(angle) * 156.0, sin(angle) * 64.0)
				pace = 0.62
			_:
				if position.distance_squared_to(destination) < 55.0:
					destination = pond.roam_point(profile)
				goal = destination
				match profile.gait:
					PondSpecies.Gait.GLIDE:
						pace = 0.40
					PondSpecies.Gait.MEANDER:
						pace = 0.43
						bend = 0.45 * sin(t * 0.76 + phase)
					PondSpecies.Gait.PADDLE:
						pace = 0.38 + 0.09 * sin(t * 2.7 + phase)
						bend = 0.22 * sin(t * 1.12 + phase)
					PondSpecies.Gait.DRIFT:
						pace = 0.09 + 0.31 * maxf(0.0, sin(t * 0.93 + phase))
						bend = 0.12 * sin(t + phase)
	var offset := goal - position
	if offset.length_squared() > 1.0 and pace > 0.0:
		var steer := offset.normalized() + _separation * (0.52 if foraging else 1.05)
		var desired := steer.angle() + bend
		heading = rotate_toward(heading, desired, profile.turning * (1.8 if foraging else 1.0) * delta)
	speed = move_toward(speed, pace * profile.speed, profile.speed * 1.65 * delta)
	var forward := Vector2.from_angle(heading)
	var next := position + forward * minf(speed * delta, offset.length())
	position = GardenPond.confine(next, 0.998)
	update_view()
	body.speed_scale = profile.stroke_rate * (0.46 + 1.3 * speed / profile.speed)
	if profile.bird:
		_wake_travel += speed * delta
		if _wake_travel >= 7.0:
			_wake_travel = 0.0
			pond.marks.add_wake(position - forward * 5.0 + Vector2.DOWN * 4.0, forward)


func update_view() -> void:
	# Keep the stroke phase through a turn. The overlap prevents a direction
	# change on every tick when steering along the boundary of two views.
	if _view >= 0 and absf(angle_difference(_view * SECTOR, heading)) < SECTOR * 0.5 + 0.085:
		return
	var frame := body.frame
	var progress := body.frame_progress
	_view = posmod(roundi(heading / SECTOR), 8)
	body.play(VIEWS[_view])
	body.set_frame_and_progress(frame, progress)
