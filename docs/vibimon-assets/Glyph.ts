export const glypth = {
  "HH": {
    kind: "building",
    name: "tile_poke_center",
    width: 4,
    height: 4,
    door: { x: 1, y: 3 },
    wall: true,
    dialog: null
  },
  "TT": {
    kind: "building",
    name: "tile_tree",
    width: 1,
    height: 1,
    door: null,
    wall: true,
    dialog: null
  },
  "%%": {
    kind: "building",
    name: "tile_bush",
    width: 1,
    height: 1,
    door: null,
    wall: false,
    dialog: null
  },
  "BB": {
    kind: "building",
    name: "icon_bird",
    width: 1,
    height: 1,
    door: null,
    wall: true,
    dialog: [["tweet tweet", "i am a bird", "tweet tweet tweet"]]
  },
  "MM": {
    kind: "bordered",
    name: "tile_mountain",
    wall: true
  },
  "DD": {
    kind: "building",
    name: "tile_mountain_door",
    width: 1,
    height: 1,
    door: { x: 0, y: 0 },
    wall: false,
    dialog: null
  },
  "##": {
    kind: "building",
    name: "tile_bricks",
    width: 1,
    height: 1,
    door: null,
    wall: false,
    dialog: null
  },
  "PP": {
    kind: "entity",
    name: "Player",
    sprite: "ent_red",
    specie_id: "minifox"
  }
};
