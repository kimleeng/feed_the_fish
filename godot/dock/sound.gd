class_name GardenSound
extends Node

var _voices: Dictionary[StringName, AudioStreamPlayer] = {}
var enabled := false:
	set(value):
		enabled = value
		if not value:
			for voice: AudioStreamPlayer in _voices.values():
				voice.stop()


func _ready() -> void:
	if AudioServer.get_driver_name() == "Dummy" and Engine.get_write_movie_path().is_empty():
		return
	_add_voice(&"coin", 960, 780, 0.095)
	_add_voice(&"crank", 230, 148, 0.15)
	_add_voice(&"collect", 490, 740, 0.19)
	_add_voice(&"toss", 400, 230, 0.11)
	_add_voice(&"fish", 740, 610, 0.08)
	_add_voice(&"bird", 360, 270, 0.08)
	_add_voice(&"lucky", 880, 1320, 0.34)


func _add_voice(id: StringName, start: float, finish: float, duration: float) -> void:
	var voice := AudioStreamPlayer.new()
	voice.stream = _note(start, finish, duration)
	voice.max_polyphony = 2
	add_child(voice)
	_voices[id] = voice


func cue(id: StringName) -> void:
	if enabled and _voices.has(id):
		_voices[id].play()


func _note(start_hz: float, end_hz: float, duration: float) -> AudioStreamWAV:
	const RATE := 22050
	var sample := AudioStreamWAV.new()
	sample.format = AudioStreamWAV.FORMAT_16_BITS
	sample.mix_rate = RATE
	var count := ceili(duration * RATE)
	var bytes := PackedByteArray()
	bytes.resize(count * 2)
	var phase := 0.0
	for i in range(count):
		var time := float(i) / count
		phase += TAU * lerpf(start_hz, end_hz, time) / RATE
		var envelope := minf(1.0, i / 70.0) * pow(1.0 - time, 2.0)
		var sample_value := sin(phase) + 0.18 * sin(phase * 2)
		bytes.encode_s16(i * 2, roundi(sample_value * envelope * 2400))
	sample.data = bytes
	return sample


func _exit_tree() -> void:
	for voice: AudioStreamPlayer in _voices.values():
		voice.stop()
		voice.stream = null
