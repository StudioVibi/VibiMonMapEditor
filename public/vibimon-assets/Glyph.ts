import * as Glyph from "../game/Type/Glyph";
import * as Type from "../game/Type";

export const table: Record<Type.Glyph, Type.GlyphFn> = {
  "   ": Glyph.none,
  "___": Glyph.bigimg("tile_grass", 1, 1, false),
  ",,,": Glyph.bigimg("tile_bush", 1, 1, false),
  "_/\\": Glyph.bigimg("tile_tree_00_00", 3, 3, true),
  "###": Glyph.borded("tile_mountain"),
  "<_>": Glyph.entity("Door", "tile_mountain_door", null, false),
  "_,_": Glyph.bigimg("tile_bricks", 1, 1, false),
  "[+]": Glyph.bigimg("tile_poke_center", 4, 4, false),
  ":::": Glyph.entity("Wall", "wall", null),
  "()>": Glyph.entity("Bird", "icon_bird", [["tweet tweet", "i am a bird", "tweet tweet tweet"]]),
  "RED": Glyph.player
};
