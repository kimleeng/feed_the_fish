// One catalogue for arrivals, physical height and complete sprite-sheet layouts.
// The autumn sheets include a ninth, rear-facing pose for watching the pond.
export const OBSERVER_LOOKS = {
  adult: [
    { name: 'Blue jacket', height: 158, watchingInSheet: false },
    { name: 'Green cardigan', height: 153, watchingInSheet: false },
    { name: 'Rust jacket', height: 149, watchingInSheet: false },
    { name: 'Sand coat and blue scarf', height: 157, watchingInSheet: true },
    { name: 'Navy quilted jacket and sage beanie', height: 164, watchingInSheet: true },
    { name: 'Moss raincoat and burgundy scarf', height: 151, watchingInSheet: true },
  ],
  kid: [
    { name: 'Yellow jumper', height: 109, watchingInSheet: false },
    { name: 'Coral top', height: 115, watchingInSheet: false },
    { name: 'Teal top', height: 96, watchingInSheet: false },
    { name: 'Mustard raincoat and wellies', height: 103, watchingInSheet: true },
    { name: 'Teal raincoat and rose beanie', height: 115, watchingInSheet: true },
    { name: 'Brick puffer and corduroys', height: 126, watchingInSheet: true },
  ],
} as const;

export const OBSERVER_DESIGNS = (['adult', 'kid'] as const).flatMap(age =>
  OBSERVER_LOOKS[age].map((look, index) => ({ ...look, age, look: index, design: `observer-${age}-${index}` })));
