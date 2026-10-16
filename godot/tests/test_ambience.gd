extends SceneTree

const Ambience = preload("res://godot/scripts/ambience.gd")
const Music = preload("res://godot/scripts/ambience_music.gd")
const Audio = preload("res://godot/scripts/pond_audio.gd")

var _checks := 0
var _failures := 0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_wind()
	_test_crowd()
	_test_interest()
	_test_walking()
	_test_employee()
	_test_music()
	await _test_sound_controls()
	# Let the audio server retire stopped playbacks before the test process exits.
	await create_timer(0.1).timeout
	print("Native ambience/audio: %d checks, %d failures" % [_checks, _failures])
	quit(0 if _failures == 0 else 1)


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures += 1
		push_error(message)


func _machine(stock: int = 25) -> Dictionary:
	return {"phase": "ready", "stock": stock, "restocking": false, "refill_progress": 0.0, "restocks": 0}


func _test_wind() -> void:
	var first = Ambience.new(41)
	var second = Ambience.new(41)
	var other = Ambience.new(42)
	var initial: Dictionary = first.wind.duplicate()
	var machine: Dictionary = _machine()
	_check(initial == second.wind, "Weather reproduces the same seeded initial state.")
	_check(initial != other.wind, "Different seeds have different weather.")
	for index: int in range(125):
		first.step(0.1, machine)
		second.notice_throw()
		second.notice_eating(1.0)
		second.step(0.1, machine)
	_check(first.wind == second.wind, "Visitor/feeding randomness never alters wind.")
	_check(first.wind_history.size() == 13, "Weather records one sample per completed simulation second.")
	_check(first.wind_history[0] == initial, "Recorded weather history is immutable.")
	_check(first.sample_wind(4.0) == first.wind_history[4], "Historical samples reproduce from the seed.")
	_check(first.sample_wind(0.0) == initial, "Sampling the past does not advance weather.")
	_check(is_equal_approx(Vector2(first.wind.x, first.wind.y).length(), first.wind.strength), "Wind vector agrees with its scalar strength.")
	var paused: float = first.elapsed
	first.step(0.0, machine)
	first.step(-1.0, machine)
	_check(first.elapsed == paused, "Zero and negative time do not advance ambient systems.")
	for sample: Dictionary in first.wind_history:
		_check(sample.strength >= 0.14 and sample.strength <= 0.68 and sample.direction >= 0.0 and sample.direction < TAU, "Wind remains bounded and its direction normalized.")


func _test_crowd() -> void:
	var total := 0.0
	var samples := 0
	var maximum := 0
	var saw_kid := false
	var saw_adult := false
	var seen_designs: Dictionary = {}
	var machine: Dictionary = _machine()
	for seed_value: int in range(12):
		var ambience = Ambience.new(seed_value)
		_check(ambience.people.size() >= 2 and ambience.people.size() <= 4, "A new visit begins with two to four people.")
		for tick: int in range(3600):
			ambience.step(0.1, machine)
			maximum = maxi(maximum, ambience.people.size())
			if tick > 600 and tick % 10 == 0:
				total += ambience.people.size()
				samples += 1
			for person: Dictionary in ambience.people:
				seen_designs[person.design] = true
				saw_kid = saw_kid or person.kind == "kid"
				saw_adult = saw_adult or person.kind == "adult"
	var average: float = total / samples
	_check(average >= 2.0 and average <= 4.0, "Quiet visitor population averages two to four; actual %.3f." % average)
	_check(maximum <= 8, "Long visits never exceed eight observers.")
	_check(saw_kid and saw_adult, "Both children and adults visit.")
	_check(seen_designs.size() == 12, "All twelve browser visitor appearances remain available.")
	var a = Ambience.new(81)
	var b = Ambience.new(81)
	_check(a.people == b.people, "Visitors reproduce deterministically from their own seed.")


func _test_interest() -> void:
	var quiet = Ambience.new(90)
	var fed = Ambience.new(90)
	var machine: Dictionary = _machine()
	for ambience in [quiet, fed]:
		ambience.people.clear()
		ambience._arrive(0.0, "kid")
		var person: Dictionary = ambience.people[0]
		person.phase = "watching"
		person.has_watched = true
		person.stop = Vector2(490, 740)
		person.pos = person.stop
		person.watch_remaining = 60.0
		person.interest = 1.0
	for tick: int in range(300):
		quiet.step(0.1, machine)
		fed.step(0.1, machine)
		if tick % 10 == 0:
			fed.notice_throw()
			fed.notice_eating(1.0)
	_check(float(fed.people[0].interest) > float(quiet.people[0].interest), "Feeding sustains visitor interest.")
	_check(float(fed.people[0].watch_remaining) > float(quiet.people[0].watch_remaining), "Interested visitors watch longer.")
	var capped: float = fed.people[0].interest
	fed.notice_eating(-5.0)
	_check(float(fed.people[0].interest) == capped, "Invalid negative eating amounts do not lower interest.")
	for index: int in range(100):
		fed.notice_eating(1.0)
	_check(float(fed.people[0].interest) <= 1.15, "Feeding interest remains capped.")


func _test_walking() -> void:
	var ambience = Ambience.new(12)
	var machine: Dictionary = _machine()
	ambience.people.clear()
	ambience._arrive(0.0, "adult")
	var person: Dictionary = ambience.people[0]
	person.pos = Vector2(220, 760)
	person.previous_pos = person.pos
	person.direction = 1
	person.stop = Vector2(270, 738)
	person.phase = "approaching"
	person.stop_roll = 0.0
	person.velocity = 0.0
	person.cycles = 0.25
	person.watch_remaining = 60.0
	var start_cycles: float = person.cycles
	var previous_velocity := 0.0
	var has_accelerated := false
	var has_braked := false
	for tick: int in range(300):
		var before: Vector2 = person.pos
		ambience.step(0.05, machine)
		_check(person.previous_pos == before, "Visitor interpolation retains the preceding position.")
		var velocity: float = person.velocity
		has_accelerated = has_accelerated or velocity > previous_velocity
		has_braked = has_braked or velocity < previous_velocity
		previous_velocity = velocity
		if person.phase == "watching":
			break
	_check(person.pos == Vector2(270, 738) and person.velocity == 0.0, "Visitors stop exactly at their chosen watching spot.")
	_check(has_accelerated and has_braked, "Walking accelerates and brakes smoothly.")
	_check(float(person.cycles) > start_cycles and float(person.distance_walked) > 50.0, "Gait advances with the actual curved distance walked.")
	var planted: Vector2 = person.pos
	var planted_cycle: float = person.cycles
	ambience.step(0.1, machine)
	_check(person.pos == planted and float(person.cycles) == planted_cycle, "Watching feet remain planted.")
	_check(ambience.observer_frame(person) == "%s-watch" % person.design, "Watching uses the rear-facing browser pose.")
	person.watch_remaining = 0.01
	ambience.step(0.1, machine)
	_check(person.phase == "leaving" and person.cycles == 0.25, "Departure starts with the feet together.")


func _test_employee() -> void:
	var ambience = Ambience.new(71)
	var machine: Dictionary = _machine(5)
	ambience.step(0.1, machine)
	_check(ambience.employee.phase == "away", "Five servings do not summon the attendant.")
	machine.stock = 4
	machine.phase = "collecting"
	for tick: int in range(130):
		ambience.step(0.1, machine)
	_check(ambience.employee.phase == "waiting" and not machine.restocking, "The attendant arrives but waits for a paid serving to finish.")
	_check(ambience.employee.pos.distance_to(Vector2(346.25, 722.8421052631579)) < 0.001, "Sack opening lines up with the hopper.")
	machine.phase = "ready"
	ambience.step(0.1, machine)
	_check(machine.restocking and ambience.employee.phase == "opening", "Only an idle machine starts restocking.")
	var phases: Dictionary = {"opening": true}
	var previous_progress := 0.0
	for tick: int in range(300):
		ambience.step(0.05, machine)
		phases[ambience.employee.phase] = true
		_check(float(ambience.employee.lid_open) >= 0.0 and float(ambience.employee.lid_open) <= 1.0, "Lid openness is always normalized.")
		if machine.restocking:
			_check(float(machine.refill_progress) >= previous_progress, "Refilling never runs backwards.")
			previous_progress = machine.refill_progress
		if machine.restocks == 1:
			break
	_check(phases.has("lifting") and phases.has("pouring") and phases.has("closing") and phases.has("leaving"), "Attendant preserves the complete browser restocking sequence.")
	_check(machine.stock == 25 and not machine.restocking and machine.refill_progress == 0.0 and machine.restocks == 1, "Refill is credited once after closing.")
	for tick: int in range(200):
		ambience.step(0.1, machine)
	_check(ambience.employee.phase == "away" and machine.restocks == 1, "A fully stocked machine lets its attendant leave without a duplicate refill.")


func _test_music() -> void:
	var music = Music.new()
	_check(is_equal_approx(Music.MUSIC_DURATION, 90.0), "The original forty-eight-bar music loop lasts ninety seconds.")
	_check(music.score.size() > 300, "The full three-voice composition is present.")
	var midi: Array[int] = []
	for note: Dictionary in music.score:
		_check(float(note.start) >= 0.0 and float(note.start) + float(note.duration) < Music.MUSIC_DURATION, "Music notes and release tails fit inside the loop.")
		if note.voice == "lead" and midi.size() < 5:
			midi.append(int(note.midi))
	_check(midi == [74, 69, 74, 77, 76], "Native melody starts with the browser's original D Dorian phrase.")
	var peak := 0.0
	var energy := 0.0
	for index: int in range(22050):
		var value: float = music.next_sample()
		peak = maxf(peak, absf(value))
		energy += value * value
	_check(peak > 0.01 and peak < 0.25 and energy > 0.01, "Native synthesis is audible, bounded and safely below clipping.")
	music.sample_cursor = int(ceil(Music.MUSIC_DURATION * Music.SAMPLE_RATE))
	var first_loop_sample: float = music.next_sample()
	_check(music.sample_cursor == 1 and is_finite(first_loop_sample), "The stream loops without losing its score cursor.")


func _test_sound_controls() -> void:
	var audio = Audio.new()
	root.add_child(audio)
	_check(not audio.enabled and not audio.suspended, "Sound is opt-in.")
	audio.handle_events([{"type": "throw"}])
	_check(audio._music_renderer == null and audio._cue_players.is_empty(), "Muted events allocate no audio and cannot be replayed later.")
	audio.set_suspended(true)
	audio.reset_visit()
	_check(audio.suspended and not audio.enabled, "Visit reset does not change the player's sound preference or pause state.")
	audio.set_enabled(true)
	_check(audio._music_renderer == null, "Enabling sound during a pause defers all playback.")
	audio.set_suspended(false)
	_check(audio._music_player.playing and not audio._music_player.stream_paused, "Resuming starts one native music stream.")
	audio.handle_events([{"type": "throw"}, {"type": "coin"}, {"type": "bite", "kind": "bird"}, {"type": "lucky"}, {"type": "dispensed"}])
	_check(audio._cue_cache.size() == 5, "Throw, coin, bite, lucky and dispensing cues play through their native cache.")
	await create_timer(0.1).timeout
	var cursor: int = audio._music_renderer.sample_cursor
	var cached_cues: int = audio._cue_cache.size()
	audio.set_suspended(true)
	audio.handle_events([{"type": "bite", "kind": "fish"}])
	var cues_stopped := true
	for player: AudioStreamPlayer in audio._cue_players:
		cues_stopped = cues_stopped and not player.playing
	_check(audio._music_player.stream_paused and cues_stopped, "Pausing suspends music and stops outstanding effects.")
	_check(audio._music_renderer.sample_cursor == cursor and audio._cue_cache.size() == cached_cues, "Paused events neither advance nor queue audio.")
	audio.set_suspended(false)
	_check(not audio._music_player.stream_paused and audio._music_renderer.sample_cursor == cursor, "Music resumes at its held position.")
	audio.set_enabled(false)
	_check(audio._music_player.stream_paused and not audio.is_processing(), "Turning sound off stops synthesis work.")
	var tone: AudioStreamWAV = Audio.make_tone(480.0, 0.16)
	_check(tone.mix_rate == 22050 and tone.format == AudioStreamWAV.FORMAT_16_BITS and not tone.stereo, "Quiet cues use portable sixteen-bit mono PCM.")
	var peak := 0
	for offset: int in range(0, tone.data.size(), 2):
		peak = maxi(peak, absi(tone.data.decode_s16(offset)))
	_check(peak > 100 and peak <= 328, "Sound effects preserve the browser's quiet gain.")
	_check(tone.data.decode_s16(0) == 0 and absi(tone.data.decode_s16(tone.data.size() - 2)) <= 1, "Cue attack and release avoid clicks.")
	audio.free()
