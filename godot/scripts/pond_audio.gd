class_name PondAudio
extends Node
## Opt-in native synthesis. Sound effects never accumulate while paused.

const MusicRenderer = preload("res://godot/scripts/ambience_music.gd")
const MIX_RATE := 22050.0
const MAX_CUES := 12

var enabled := false
var suspended := false
var _music_player: AudioStreamPlayer
var _music_playback: AudioStreamGeneratorPlayback
var _music_renderer: RefCounted
var _cue_players: Array[AudioStreamPlayer] = []
var _cue_cache: Dictionary = {}
var _last_bite_ms := -1000
var _music_gain := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_process(false)


func _exit_tree() -> void:
	if _music_player != null:
		_music_player.stream_paused = false
		_music_player.stop()
		_music_player.stream = null
	_music_playback = null
	for player: AudioStreamPlayer in _cue_players:
		player.stop()
		player.stream = null


func set_enabled(value: bool) -> void:
	enabled = value
	_sync_playback()


func set_suspended(value: bool) -> void:
	suspended = value
	_sync_playback()


func reset_visit() -> void:
	_last_bite_ms = -1000
	for player: AudioStreamPlayer in _cue_players:
		player.stop()


func handle_events(events: Array) -> void:
	if not enabled or suspended:
		return
	for event: Dictionary in events:
		match str(event.get("type", "")):
			"throw":
				_play_tone(480.0, 0.16)
			"coin":
				_play_tone(1000.0, 0.08)
			"dispensed":
				_play_tone(660.0, 0.2)
			"bite":
				# A busy shoal should remain quiet, rather than summing dozens of cues.
				var now: int = Time.get_ticks_msec()
				if now - _last_bite_ms >= 45:
					_play_tone(320.0 if event.get("kind", "fish") == "bird" else 750.0, 0.08)
					_last_bite_ms = now
			"lucky":
				_play_tone(1046.0, 0.22)
			"splash", "bird_splash":
				_play_tone(180.0, 0.06, 0.002)


func _sync_playback() -> void:
	var playing: bool = enabled and not suspended
	if playing:
		_ensure_players()
		_music_player.stream_paused = false
		set_process(true)
	else:
		if _music_player != null:
			_music_player.stream_paused = true
		for player: AudioStreamPlayer in _cue_players:
			player.stop()
		set_process(false)


func _ensure_players() -> void:
	if _music_player != null:
		return
	_music_renderer = MusicRenderer.new()
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = MIX_RATE
	generator.buffer_length = 0.15
	_music_player = AudioStreamPlayer.new()
	_music_player.name = "PondMusic"
	_music_player.stream = generator
	add_child(_music_player)
	_music_player.play()
	_music_playback = _music_player.get_stream_playback() as AudioStreamGeneratorPlayback
	for index: int in range(MAX_CUES):
		var player := AudioStreamPlayer.new()
		player.name = "PondCue%d" % index
		add_child(player)
		_cue_players.append(player)
	_fill_music(0.0)


func _process(delta: float) -> void:
	_fill_music(delta)


func _fill_music(delta: float) -> void:
	if _music_playback == null or _music_renderer == null:
		return
	_music_gain = move_toward(_music_gain, 0.25, maxf(delta, 0.01) * 1.67)
	var available: int = _music_playback.get_frames_available()
	var frames := PackedVector2Array()
	frames.resize(available)
	for index: int in range(available):
		var sample: float = _music_renderer.next_sample() * _music_gain
		frames[index] = Vector2(sample, sample)
	_music_playback.push_buffer(frames)


func _play_tone(frequency: float, duration: float, gain: float = 0.01) -> void:
	_ensure_players()
	var cache_key: String = "%s:%s:%s" % [frequency, duration, gain]
	if not _cue_cache.has(cache_key):
		_cue_cache[cache_key] = make_tone(frequency, duration, gain)
	for player: AudioStreamPlayer in _cue_players:
		if not player.playing:
			player.stream = _cue_cache[cache_key]
			player.play()
			return


static func make_tone(frequency: float, duration: float, gain: float = 0.01) -> AudioStreamWAV:
	var count: int = maxi(1, int(ceil(duration * MIX_RATE)))
	var bytes := PackedByteArray()
	bytes.resize(count * 2)
	var phase := 0.0
	for index: int in range(count):
		var time: float = float(index) / MIX_RATE
		var progress: float = time / duration
		var pitch: float = frequency * pow(0.8, progress)
		var envelope: float = gain * pow(0.1, progress) * minf(1.0, time / 0.004) * minf(1.0, (duration - time) / 0.008)
		var sample: float = sin(phase) * maxf(0.0, envelope)
		bytes.encode_s16(index * 2, int(clampf(sample, -1.0, 1.0) * 32767.0))
		phase += TAU * pitch / MIX_RATE
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = int(MIX_RATE)
	stream.stereo = false
	stream.data = bytes
	return stream
