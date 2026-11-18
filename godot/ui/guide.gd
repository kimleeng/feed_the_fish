class_name PondGuide
extends Panel

signal dismissed

var page := 0
@onready var portrait: AnimatedSprite2D = %Portrait


func _ready() -> void:
	%Previous.pressed.connect(change_page.bind(-1))
	%Next.pressed.connect(change_page.bind(1))
	%Close.pressed.connect(func(): dismissed.emit())


func open() -> void:
	show()
	change_page(0)
	%Close.grab_focus()


func close() -> void:
	portrait.pause()
	hide()


func change_page(offset: int) -> void:
	page = posmod(page + offset, GardenPond.PROFILES.size())
	var species := GardenPond.PROFILES[page]
	%Name.text = species.display_name
	%Category.text = ("BIRD" if species.bird else "FISH") + "   /   %d in the pond" % species.count
	%Notes.text = species.field_note
	%Feeding.text = "Watches the throw" if species.bird else "Listens for the splash"
	%Chew.text = "Bite   %s pellet     •     Chew   %s s" % [str(species.bite_units / 100.0).trim_suffix(".0"), str(species.chew_seconds).trim_suffix(".0")]
	%Page.text = "%d / %d" % [page + 1, GardenPond.PROFILES.size()]
	portrait.sprite_frames = species.frames
	portrait.speed_scale = species.stroke_rate
	portrait.play(&"plate")
