extends RefCounted
## Native streaming rendition of the browser's original 6/8 composition.
## Only a few active voices are mixed; a ninety-second PCM buffer is unnecessary.

const SAMPLE_RATE := 22050.0
const EIGHTH_SECONDS := 60.0 / 64.0 / 3.0
const MUSIC_DURATION := 48.0 * 6.0 * EIGHTH_SECONDS
const A := [
	[[74, 2], [69, 1], [74, 1], [77, 1], [76, 1]],
	[[74, 3], [72, 1], [69, 1], [0, 1]],
	[[77, 2], [76, 1], [74, 2], [69, 1]],
	[[72, 2], [74, 1], [76, 2], [0, 1]],
	[[79, 2], [77, 1], [76, 1], [71, 1], [74, 1]],
	[[77, 3], [81, 1], [79, 1], [77, 1]],
	[[76, 2], [72, 1], [69, 1], [72, 1], [76, 1]],
	[[74, 4], [0, 2]],
]
const A2 := [
	[[69, 1], [74, 2], [77, 1], [76, 1], [74, 1]],
	[[72, 2], [71, 1], [69, 2], [0, 1]],
	[[74, 1], [77, 2], [81, 1], [79, 1], [77, 1]],
	[[76, 3], [74, 1], [72, 1], [0, 1]],
	[[71, 1], [74, 1], [79, 1], [77, 2], [76, 1]],
	[[77, 2], [74, 1], [69, 2], [74, 1]],
	[[72, 2], [76, 1], [74, 1], [72, 1], [69, 1]],
	[[74, 3], [0, 3]],
]
const B := [
	[[81, 2], [79, 1], [77, 2], [76, 1]],
	[[79, 3], [76, 1], [74, 1], [72, 1]],
	[[77, 2], [81, 1], [84, 2], [81, 1]],
	[[79, 2], [77, 1], [76, 2], [0, 1]],
	[[79, 1], [81, 1], [79, 1], [74, 2], [71, 1]],
	[[77, 3], [76, 1], [74, 1], [72, 1]],
	[[76, 2], [74, 1], [72, 1], [69, 1], [72, 1]],
	[[74, 3], [0, 3]],
]
const HARMONY_A := [[50, 65, 69], [48, 64, 67], [53, 65, 69], [48, 64, 67], [43, 62, 71], [50, 65, 69], [45, 60, 64], [50, 65, 69]]
const HARMONY_B := [[53, 65, 69], [48, 64, 67], [53, 65, 69], [45, 60, 64], [43, 62, 71], [53, 65, 69], [45, 60, 64], [50, 65, 69]]

var score: Array[Dictionary] = []
var sample_cursor := 0
var _score_cursor := 0
var _voices: Array[Dictionary] = []
var _delay: PackedFloat32Array
var _delay_samples := int(round(EIGHTH_SECONDS * 1.5 * SAMPLE_RATE))
var _delay_cursor := 0
var _filtered := 0.0
var _smoothing := 1.0 - exp(-TAU * 2200.0 / SAMPLE_RATE)
var _lead_decay := exp(-5.0 / SAMPLE_RATE)
var _bell_decay := exp(-8.0 / SAMPLE_RATE)


func _init() -> void:
	_delay.resize(_delay_samples * 2 + 1)
	var sections: Array = [A, A2, B, B, A, A2]
	for section: int in range(sections.size()):
		for bar: int in range(8):
			var start: float = (section * 8 + bar) * 6.0 * EIGHTH_SECONDS
			var chord: Array = HARMONY_B[bar] if section == 2 or section == 3 else HARMONY_A[bar]
			var quiet: bool = section == 3 or section == 5
			var offset := 0
			for note: Array in sections[section][bar]:
				if int(note[0]) != 0:
					_add_note("lead", int(note[0]) - (12 if section == 3 else 0), start + offset * EIGHTH_SECONDS, float(note[1]) * EIGHTH_SECONDS * 0.9, 0.055 if quiet else 0.07)
				offset += int(note[1])
			for beat: int in [0, 3]:
				if bar == 7 and beat == 3:
					continue
				_add_note("bass", int(chord[0]) + (7 if beat != 0 else 0), start + beat * EIGHTH_SECONDS, 2.6 * EIGHTH_SECONDS, 0.055)
			var pattern: Array = [1, 2, 1, 2] if section % 2 else [1, 2, 2, 1]
			var beats: Array = [1, 2, 4, 5]
			for index: int in range(beats.size()):
				var beat: int = beats[index]
				if bar == 7 and beat >= 3:
					continue
				_add_note("bell", int(chord[pattern[index]]) + 12, start + beat * EIGHTH_SECONDS, 0.7 * EIGHTH_SECONDS, 0.015 if quiet else 0.022)
	score.sort_custom(func(left: Dictionary, right: Dictionary) -> bool: return int(left.start_sample) < int(right.start_sample))


func _add_note(voice: String, midi: int, start: float, duration: float, gain: float) -> void:
	score.append({"voice": voice, "midi": midi, "start": start, "duration": duration, "gain": gain,
		"start_sample": int(round(start * SAMPLE_RATE)), "samples": int(ceil(duration * SAMPLE_RATE)),
		"increment": 440.0 * pow(2.0, float(midi - 69) / 12.0) / SAMPLE_RATE})


func next_sample() -> float:
	if sample_cursor >= int(ceil(MUSIC_DURATION * SAMPLE_RATE)):
		sample_cursor = 0
		_score_cursor = 0
		_voices.clear()
	while _score_cursor < score.size() and int(score[_score_cursor].start_sample) <= sample_cursor:
		var note: Dictionary = score[_score_cursor].duplicate()
		note.age = 0
		note.phase = 0.0
		note.decay = 1.0
		_voices.append(note)
		_score_cursor += 1
	var dry := 0.0
	for index: int in range(_voices.size() - 1, -1, -1):
		var voice: Dictionary = _voices[index]
		if int(voice.age) >= int(voice.samples):
			_voices.remove_at(index)
			continue
		var phase: float = voice.phase
		var wave: float
		if voice.voice == "bass":
			wave = round((1.0 - 4.0 * absf(phase - 0.5)) * 15.0) / 15.0
		elif voice.voice == "bell":
			wave = 0.75 if phase < 0.25 else -0.25
		else:
			wave = 1.0 if phase < 0.5 else -1.0
		var time: float = float(voice.age) / SAMPLE_RATE
		var attack: float = minf(1.0, time / 0.012)
		var release: float = clampf((float(voice.duration) - time) / 0.075, 0.0, 1.0)
		var decay: float = float(voice.decay) if voice.voice == "bell" else 0.82 + 0.18 * float(voice.decay)
		dry += wave * float(voice.gain) * attack * release * decay
		voice.age += 1
		voice.phase = fposmod(phase + float(voice.increment), 1.0)
		voice.decay *= _bell_decay if voice.voice == "bell" else _lead_decay
	var length: int = _delay.size()
	var mixed: float = dry + _delay[posmod(_delay_cursor - _delay_samples, length)] * 0.12 + _delay[posmod(_delay_cursor - _delay_samples * 2, length)] * 0.04
	_delay[_delay_cursor] = dry
	_delay_cursor = (_delay_cursor + 1) % length
	_filtered += _smoothing * (mixed - _filtered)
	sample_cursor += 1
	return clampf(_filtered, -0.5, 0.5)
